// Admin-only listing delete (v9.20) — shared by AdminPage (listings tab)
// and ListingDetailPage (bottom of the page, next to Report).
//
// WHY THIS EXISTS: the Admin panel already had a DELETE button
// (AdminPage handleDelete), but it could never delete a listing the admin
// did not submit themselves — the ONLY listings DELETE policy in the DB
// is "Owner can delete own listing" (submitted_by / owner_id, 9.3.sql).
// No "Admin deletes listings" policy ever existed (other tables have one:
// notices, donations, lost_found, jobs, price_reports), so the button
// failed at RLS for exactly the case the user wants — deleting someone
// else's business that no longer exists. supabase-migration-9.20.sql adds
// the missing policy; this helper is the client half.
//
// WHAT A DELETE DOES (v9.25 — user decision 2026-11-06: deleting must
// NOT deduct points):
//  - the listing row goes first, then linked rows are cleaned up — the
//    old order deleted reviews first, so a failure on the listing delete
//    left them already gone (AdminPage comment, kept here).
//  - reviews: deleted here; each review delete used to fire the 9.17
//    trigger handle_review_deleted_points — a -5 reversal row in
//    user_points and profiles.total_reviews -1 per review. From 9.25 the
//    trigger keeps total_reviews -1 but writes NO -5 reversal row, so
//    reviewers keep their earned +5 (same for standalone review deletes
//    and for reviews cascade-deleted with the listing — the DB cannot
//    tell the two apart, and both keep the points).
//  - points: the 9.17/9.18 trigger handle_listing_deleted_points used to
//    insert -10 (submit_listing) and, if the listing was approved, -20
//    (listing_approved) reversal rows. From 9.25 (supabase-migration-
//    9.25.sql) it writes NO reversal rows — the submitter keeps +10
//    (+20 if approved) — but profiles.total_listings still drops by 1.
//    profiles.points stays in sync via sync_user_points() (9.3).
//  - bookmarks: removed by the 9.17 trigger cleanup_bookmarks_on_target_delete.
//  - reports + edit_suggestions for the listing: deleted here.
//  - photos: the listing's images array dies with the row, so the photos
//    disappear from the app — but the files stay in Cloudinary (there is
//    no signed destroy path in the app; cloudinary.js only uploads).
//  - audit: logged when a log function is passed (AdminPage); the detail
//    page passes its own useAuditLog log the same way.
//  - freshness: after the delete + cleanup succeed, the shared
//    queryClient invalidates ['categories'], ['listings'],
//    ['bookmarks'], ['profile-stats'], ['profile-month-points'],
//    ['leaderboard'] and ['reviews'], so category counts, directory
//    lists, profile points and the leaderboard refresh at once instead
//    of serving the 5-min / 24-h persisted cache. Never invalidated on
//    failure.
//  KNOWN LOOSENING (v9.25, accepted): the award triggers have no
//  dedup, so a write→delete→rewrite cycle nets +5 per review / +10
//  (+20 if re-approved) per listing. Small amounts, visible in Points
//  History; no tombstone/marker mechanism in 9.25.
//
// GATING: Admin only (isAdmin = role 'admin' or 'super_admin'). Moderators
// can open the Admin panel (RequireAdmin admits them) but must NOT see or
// call this — the RLS policy enforces the same rule server-side, so the
// UI gate is not the only defence.
//
// NOTE (9.20 amendment, user decision 2026-11-06 "Admin ပဲဖျက်ခွင့်ပေး"):
// MySubmissionsPage.jsx no longer calls this at all — owner delete was
// removed from MySubmissions (handleDelete + Delete button deleted) and
// the "Owner can delete own listing" policy (9.3.sql) is dropped by
// supabase-migration-9.20.sql. The only callers are AdminPage and
// ListingDetailPage, both isAdmin-gated.

import { queryClient } from './queryClient'

// Query keys invalidated after a successful listing delete, so every
// screen that shows the listing (or its points) refreshes at once.
export const DELETE_INVALIDATE_KEYS = [
  'categories',
  'listings',
  'bookmarks',
  'profile-stats',
  'profile-month-points',
  'leaderboard',
  'reviews',
]

// Shared impact bullets — used by BOTH the single and the bulk confirm,
// so the two confirms cannot drift apart (v9.25: earned points are kept).
const DELETE_IMPACT_BULLETS = `• လုပ်ငန်း၊ ဓာတ်ပုံ၊ review၊ bookmark အားလုံး ပျက်မည်
• တင်သွင်းသူနှင့် review ရေးသူများ၏ ရပြီးသား အမှတ် မနှုတ်ပါ — အမှတ် ဆက်လက်ရှိမည်`

export function deleteListingConfirmMessage(name) {
  return `‘${name || 'ဤလုပ်ငန်း'}’ ကို အပြီးဖျက်မလား? ပြန်မရနိုင်ပါ။
${DELETE_IMPACT_BULLETS}
Admin သာ ဖျက်ခွင့်ရှိသည်။`
}

// Bulk-delete confirm (v9.25) — reuses DELETE_IMPACT_BULLETS, so it
// automatically carries the kept-points wording, never the old
// +10/+20/+5 deduction bullets. `names` is an array of display names
// (or listing rows — name_mm || name is read off them); `count` defaults
// to names.length. Lists up to 5 names, then "…နောက်ထပ် N ခု".
export function deleteBulkConfirmMessage(names, count) {
  const list = Array.isArray(names) ? names : []
  const total = count ?? list.length
  const shown = list.slice(0, 5).map((n) => {
    const label = typeof n === 'string' ? n : (n?.name_mm || n?.name)
    return label || 'ဤလုပ်ငန်း'
  })
  const lines = shown.map((n) => `• ${n}`)
  if (total > 5) lines.push(`…နောက်ထပ် ${total - 5} ခု`)
  return `လုပ်ငန်း ${total} ခု ဖျက်မလား? ပြန်မရနိုင်ပါ။
${lines.join('\n')}
${DELETE_IMPACT_BULLETS}
Admin သာ ဖျက်ခွင့်ရှိသည်။`
}

export async function deleteListingWithCleanup(client, id, { log } = {}) {
  const { data: deleted, error } = await client.from('listings').delete().eq('id', id).select('name, name_mm')
  if (error) throw error
  const name = deleted?.[0]?.name_mm || deleted?.[0]?.name
  // Best-effort cleanup of linked rows — a failure here must not silently
  // block the delete, but it must not be hidden either.
  const cleanupErrors = []
  const cleanups = [
    ['reports', { target_type: 'listing', target_id: id }],
    ['edit_suggestions', { listing_id: id }],
    ['reviews', { listing_id: id }],
  ]
  for (const [table, match] of cleanups) {
    const { error: e } = await client.from(table).delete().match(match)
    if (e) cleanupErrors.push(`${table}: ${e.message}`)
  }
  if (log) {
    try {
      await log({ action: 'delete', table: 'listings', id, name, before: { name } })
    } catch {
      // Audit log is fire-and-forget — it must never delay the toast.
    }
  }
  // Freshness (v9.25): only on success — a failed delete must not
  // invalidate anything. Awaited so the caller navigates / refreshes
  // only after the caches are marked stale; an invalidation failure
  // must never turn a successful delete into an error toast.
  try {
    await Promise.all(
      DELETE_INVALIDATE_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    )
  } catch {
    // Cache invalidation is best-effort — the delete already succeeded.
  }
  return { name, cleanupErrors }
}

// Bulk delete (v9.25, Admin-only) — a sequential loop of the identical
// deleteListingWithCleanup call, so the RLS policy, audit logging,
// cleanup and per-item cache invalidation are exactly the single-delete
// ones; no new policy or SQL is needed. One item failing must not lose
// the rest: failures are collected and the loop continues. Cleanup
// failures are warnings, not failures (they land in cleanupWarnings).
// onProgress(i, total, row) fires at the START of each iteration, so the
// caller can show which row is being deleted (setDeleting + progress).
// Returns { succeeded: [row...], failed: [{ row, error }...],
//           cleanupWarnings: [{ id, cleanupErrors }...] }.
export async function deleteListingsBulk(client, rows, { log, onProgress } = {}) {
  const targets = Array.isArray(rows) ? [...rows] : []
  const succeeded = []
  const failed = []
  const cleanupWarnings = []
  for (let i = 0; i < targets.length; i++) {
    const row = targets[i]
    if (onProgress) onProgress(i + 1, targets.length, row)
    try {
      const { cleanupErrors } = await deleteListingWithCleanup(client, row.id, { log })
      succeeded.push(row)
      if (cleanupErrors?.length) cleanupWarnings.push({ id: row.id, cleanupErrors })
    } catch (error) {
      failed.push({ row, error })
    }
  }
  return { succeeded, failed, cleanupWarnings }
}
