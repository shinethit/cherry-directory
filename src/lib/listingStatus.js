// One approve path for listings (v9.20, E8).
//
// AdminPage.handleApprove and EditListingPage's Admin Controls status
// select used to disagree: approving from Admin set status='approved'
// AND is_verified=true + verify_type='cherry', while approving from
// Edit set only status='approved' — the same action had two different
// outcomes depending on where it was done. Both screens now build the
// update through here, so the outcome is identical.
//
// NOTE (A5, open intent question — flagged for the user, not decided
// here): whether approval SHOULD imply Cherry verification at all.
// This helper only makes the two screens agree on the current Admin
// behaviour; it does not decide the policy.
export function buildListingStatusUpdate(newStatus) {
  if (newStatus === 'approved') {
    return { status: 'approved', is_verified: true, verify_type: 'cherry' }
  }
  return { status: newStatus }
}

// Bulk approve (v9.28) — mirrors deleteListingsBulk in deleteListing.js:
// the SAME per-row update handleApprove uses (buildListingStatusUpdate
// ('approved')), so the +20 approval trigger fires once per row. NEVER
// a single bulk UPDATE — that would skip the per-row trigger. Rows are
// processed in chunks of 20 with Promise.allSettled; one row failing
// must never abort the rest. Audit log entries are fire-and-forget
// (like handleApprove) and must never delay the summary.
// Returns { succeeded: [row...], failed: [{ row, error }...] }.
export const APPROVE_CHUNK_SIZE = 20

export function approveAllConfirmMessage(count) {
  return `ဆိုင်းငံ့ထားတဲ့ လုပ်ငန်း အားလုံး (${count} ခု) ကို အတည်ပြုမလား?
အတည်ပြုလိုက်တဲ့ လုပ်ငန်း တစ်ဆိုင်ချင်းစီအတွက် တင်သွင်းသူကို +20 အမှတ် ရမည်။`
}

export function approveSelectedConfirmMessage(names, count) {
  const list = Array.isArray(names) ? names : []
  const total = count ?? list.length
  const shown = list.slice(0, 5).map((n) => {
    const label = typeof n === 'string' ? n : (n?.name_mm || n?.name)
    return label || 'ဤလုပ်ငန်း'
  })
  const lines = shown.map((n) => `• ${n}`)
  if (total > 5) lines.push(`…နောက်ထပ် ${total - 5} ခု`)
  return `ရွေးထားတဲ့ လုပ်ငန်း ${total} ခု ကို အတည်ပြုမလား?
${lines.join('\n')}
အတည်ပြုလိုက်တဲ့ လုပ်ငန်း တစ်ဆိုင်ချင်းစီအတွက် တင်သွင်းသူကို +20 အမှတ် ရမည်။`
}

export async function approveListingsBulk(client, rows, { log, onProgress } = {}) {
  const targets = Array.isArray(rows) ? [...rows] : []
  const succeeded = []
  const failed = []
  let done = 0
  for (let start = 0; start < targets.length; start += APPROVE_CHUNK_SIZE) {
    const chunk = targets.slice(start, start + APPROVE_CHUNK_SIZE)
    const settled = await Promise.allSettled(chunk.map(async (row) => {
      const { data: updated, error } = await client
        .from('listings')
        .update(buildListingStatusUpdate('approved'))
        .eq('id', row.id)
        .select('name, name_mm')
      if (error) throw error
      const name = updated?.[0]?.name_mm || updated?.[0]?.name || row.name_mm || row.name
      // Audit log is fire-and-forget — it must never delay the summary.
      if (log) {
        try {
          const maybePromise = log({ action: 'approve', table: 'listings', id: row.id, name, after: { status: 'approved' } })
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then((ok) => { if (!ok) console.warn('Audit log failed for listing approve') }).catch(() => {})
          }
        } catch {
          // Audit log must never turn a successful approve into an error.
        }
      }
      return row
    }))
    for (let i = 0; i < settled.length; i++) {
      done++
      if (settled[i].status === 'fulfilled') succeeded.push(settled[i].value)
      else failed.push({ row: chunk[i], error: settled[i].reason })
      if (onProgress) onProgress(done, targets.length, chunk[i])
    }
  }
  return { succeeded, failed }
}
