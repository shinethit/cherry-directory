import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deleteListingWithCleanup, deleteListingConfirmMessage, deleteBulkConfirmMessage, deleteListingsBulk } from './deleteListing'

// Admin-only listing delete (v9.20). The helper is tested with a mock
// Supabase client that records the call order — the listing MUST be
// deleted first, then the linked rows (9.17 comment: the old order
// deleted reviews first, so a failure on the listing delete left them
// already gone).

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(srcDir, rel), 'utf8')

function createMock({ failListing = false, failTables = {}, failIds = [] } = {}) {
  const calls = []
  const client = {
    calls,
    from(table) {
      return {
        delete() {
          let eqId = null
          const chain = {
            eq(k, v) {
              if (k === 'id') eqId = v
              calls.push({ table, op: 'eq', k, v })
              return chain
            },
            match(m) {
              calls.push({ table, op: 'match', m })
              const err = failTables[table] ? { message: failTables[table] } : null
              return Promise.resolve({ error: err })
            },
            select(cols) {
              calls.push({ table, op: 'select', cols })
              if (failListing || failIds.includes(eqId)) return Promise.resolve({ data: null, error: { message: 'RLS denied' } })
              return Promise.resolve({ data: [{ name: 'Test', name_mm: 'စမ်းသပ်' }], error: null })
            },
          }
          return chain
        },
      }
    },
  }
  return client
}

describe('deleteListingWithCleanup', () => {
  it('deletes the listing first, then reports, edit_suggestions and reviews — in order', async () => {
    const client = createMock()
    const logs = []
    const res = await deleteListingWithCleanup(client, 'id-1', { log: async (e) => { logs.push(e) } })
    expect(res).toEqual({ name: 'စမ်းသပ်', cleanupErrors: [] })
    expect(client.calls.map((c) => `${c.table}:${c.op}`)).toEqual([
      'listings:eq',
      'listings:select',
      'reports:match',
      'edit_suggestions:match',
      'reviews:match',
    ])
    expect(client.calls[2].m).toEqual({ target_type: 'listing', target_id: 'id-1' })
    expect(client.calls[4].m).toEqual({ listing_id: 'id-1' })
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ action: 'delete', table: 'listings', id: 'id-1' })
  })

  it('a listing-delete failure throws and runs NO cleanup', async () => {
    const client = createMock({ failListing: true })
    await expect(deleteListingWithCleanup(client, 'id-1', {})).rejects.toThrow('RLS denied')
    expect(client.calls.map((c) => `${c.table}:${c.op}`)).toEqual(['listings:eq', 'listings:select'])
  })

  it('a cleanup failure is reported, not hidden, and does not fail the delete', async () => {
    const client = createMock({ failTables: { reviews: 'boom' } })
    const res = await deleteListingWithCleanup(client, 'id-1', {})
    expect(res.name).toBe('စမ်းသပ်')
    expect(res.cleanupErrors).toEqual(['reviews: boom'])
  })

  it('works without a log function (detail page passes its own log; helper must not require it)', async () => {
    const client = createMock()
    const res = await deleteListingWithCleanup(client, 'id-1')
    expect(res.cleanupErrors).toEqual([])
  })
})

describe('deleteListingConfirmMessage (full-impact warning)', () => {
  it('states the v9.25 kept-points behaviour — no deduction bullets', () => {
    const msg = deleteListingConfirmMessage('စမ်းသပ်')
    expect(msg).toContain('စမ်းသပ်')
    expect(msg).toContain('တင်သွင်းသူနှင့် review ရေးသူများ၏ ရပြီးသား အမှတ် မနှုတ်ပါ — အမှတ် ဆက်လက်ရှိမည်')
    expect(msg).not.toContain('ပြန်နှုတ်မည်')
    expect(msg).not.toContain('+10')
    expect(msg).not.toContain('+20')
    expect(msg).not.toContain('+5')
    expect(msg).toContain('ပြန်မရနိုင်ပါ')
    expect(msg).toContain('Admin')
  })

  it('falls back to ဤလုပ်ငန်း for an empty name', () => {
    expect(deleteListingConfirmMessage('')).toContain('ဤလုပ်ငန်း')
  })
})

describe('deleteBulkConfirmMessage (v9.25)', () => {
  it('N=1 lists the one name and the count', () => {
    const msg = deleteBulkConfirmMessage(['ဆိုင်တစ်ခု'], 1)
    expect(msg).toContain('ဆိုင်တစ်ခု')
    expect(msg).toContain('လုပ်ငန်း 1 ခု')
    expect(msg).not.toContain('နောက်ထပ်')
  })

  it('N=3 lists all three names', () => {
    const msg = deleteBulkConfirmMessage(['တစ်', 'နှစ်', 'သုံး'], 3)
    expect(msg).toContain('တစ်')
    expect(msg).toContain('နှစ်')
    expect(msg).toContain('သုံး')
    expect(msg).toContain('လုပ်ငန်း 3 ခု')
  })

  it('N=8 lists 5 names + "နောက်ထပ် 3 ခု"', () => {
    const msg = deleteBulkConfirmMessage(['၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈'], 8)
    for (const n of ['၁', '၂', '၃', '၄', '၅']) expect(msg).toContain(n)
    expect(msg).not.toContain('• ၆')
    expect(msg).toContain('နောက်ထပ် 3 ခု')
  })

  it('carries the kept-points line, NOT the deduction bullets', () => {
    const msg = deleteBulkConfirmMessage(['ဆိုင်တစ်ခု'], 1)
    expect(msg).toContain('တင်သွင်းသူနှင့် review ရေးသူများ၏ ရပြီးသား အမှတ် မနှုတ်ပါ — အမှတ် ဆက်လက်ရှိမည်')
    expect(msg).not.toContain('ပြန်နှုတ်မည်')
    expect(msg).not.toContain('+10')
    expect(msg).not.toContain('+20')
    expect(msg).not.toContain('+5')
  })

  it('empty-name fallback is ဤလုပ်ငန်း, and rows work as input too', () => {
    expect(deleteBulkConfirmMessage([''], 1)).toContain('ဤလုပ်ငန်း')
    expect(deleteBulkConfirmMessage([{ name_mm: 'မြန်မာ', name: 'English' }], 1)).toContain('မြန်မာ')
    expect(deleteBulkConfirmMessage([{ name: 'English Only' }], 1)).toContain('English Only')
  })
})

describe('deleteListingsBulk (v9.25)', () => {
  const rows = (n) => Array.from({ length: n }, (_, i) => ({ id: `id-${i + 1}`, name_mm: `ဆိုင် ${i + 1}` }))

  it('all succeed: N deletes in order, one log call per item, onProgress N times', async () => {
    const client = createMock()
    const logs = []
    const progress = []
    const res = await deleteListingsBulk(client, rows(5), {
      log: async (e) => { logs.push(e) },
      onProgress: (i, total, row) => { progress.push([i, total, row.id]) },
    })
    expect(res.succeeded.map(r => r.id)).toEqual(['id-1', 'id-2', 'id-3', 'id-4', 'id-5'])
    expect(res.failed).toEqual([])
    expect(res.cleanupWarnings).toEqual([])
    // Listing deletes happen in row order (eq calls for listings only).
    expect(client.calls.filter(c => c.table === 'listings' && c.op === 'eq').map(c => c.v))
      .toEqual(['id-1', 'id-2', 'id-3', 'id-4', 'id-5'])
    expect(logs).toHaveLength(5)
    expect(logs.map(l => l.id)).toEqual(['id-1', 'id-2', 'id-3', 'id-4', 'id-5'])
    expect(progress).toEqual([[1, 5, 'id-1'], [2, 5, 'id-2'], [3, 5, 'id-3'], [4, 5, 'id-4'], [5, 5, 'id-5']])
  })

  it('partial failure: the 2nd item failing does not lose items 1, 3-5', async () => {
    const client = createMock({ failIds: ['id-2'] })
    const progress = []
    const res = await deleteListingsBulk(client, rows(5), {
      onProgress: (i, total) => { progress.push([i, total]) },
    })
    expect(res.succeeded.map(r => r.id)).toEqual(['id-1', 'id-3', 'id-4', 'id-5'])
    expect(res.failed).toHaveLength(1)
    expect(res.failed[0].row.id).toBe('id-2')
    expect(res.failed[0].error.message).toBe('RLS denied')
    expect(progress).toHaveLength(5)
    expect(client.calls.filter(c => c.table === 'listings' && c.op === 'eq').map(c => c.v))
      .toEqual(['id-1', 'id-2', 'id-3', 'id-4', 'id-5'])
  })

  it('a cleanup failure is a warning, not a bulk failure', async () => {
    const client = createMock({ failTables: { reviews: 'boom' } })
    const res = await deleteListingsBulk(client, rows(2), {})
    expect(res.succeeded).toHaveLength(2)
    expect(res.failed).toEqual([])
    expect(res.cleanupWarnings).toHaveLength(2)
    expect(res.cleanupWarnings[0]).toEqual({ id: 'id-1', cleanupErrors: ['reviews: boom'] })
  })

  it('empty input makes zero client calls', async () => {
    const client = createMock()
    const res = await deleteListingsBulk(client, [], {})
    expect(res).toEqual({ succeeded: [], failed: [], cleanupWarnings: [] })
    expect(client.calls).toEqual([])
  })
})

describe('delete gating: Admin only (v9.20)', () => {
  it('AdminPage DELETE button renders only for isAdmin, and handleDelete guards on isAdmin', () => {
    const admin = read('pages/AdminPage.jsx')
    expect(admin).toContain('{isAdmin && (')
    expect(admin).toContain('if (!isAdmin) return')
    // Moderators open the panel (RequireAdmin) but must not get the button:
    // the button lives inside the isAdmin block, not beside it.
    const btnIdx = admin.indexOf("DELETE'")
    expect(btnIdx).toBeGreaterThan(0)
    const gateIdx = admin.lastIndexOf('{isAdmin && (', btnIdx)
    expect(gateIdx).toBeGreaterThan(0)
  })

  it('ListingDetailPage delete button renders only for isAdmin', () => {
    const detail = read('pages/ListingDetailPage.jsx')
    expect(detail).toContain('လုပ်ငန်းဖျက်မည် (Admin သာ)')
    const btnIdx = detail.indexOf('လုပ်ငန်းဖျက်မည် (Admin သာ)')
    const gateIdx = detail.lastIndexOf('{isAdmin && (', btnIdx)
    expect(gateIdx).toBeGreaterThan(0)
    expect(detail).toContain('if (!isAdmin || deletingListing) return')
  })

  it('no listing-delete UI exists for owners/guests (Edit page has none)', () => {
    expect(read('pages/EditListingPage.jsx')).not.toMatch(/deleteListing|handleDelete|Trash2/)
  })

  it('migration 9.20 adds the Admin-only RLS policy (idempotent)', () => {
    const sql = readFileSync(join(srcDir, '..', 'supabase', 'supabase-migration-9.20.sql'), 'utf8')
    expect(sql).toContain('"Admin deletes listings"')
    expect(sql).toContain("role in ('admin', 'super_admin')")
    expect(sql).toContain('drop policy if exists "Admin deletes listings"')
  })
})
