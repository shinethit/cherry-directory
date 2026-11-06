import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deleteListingWithCleanup, deleteListingConfirmMessage } from './deleteListing'

// Admin-only listing delete (v9.20). The helper is tested with a mock
// Supabase client that records the call order — the listing MUST be
// deleted first, then the linked rows (9.17 comment: the old order
// deleted reviews first, so a failure on the listing delete left them
// already gone).

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(srcDir, rel), 'utf8')

function createMock({ failListing = false, failTables = {} } = {}) {
  const calls = []
  const client = {
    calls,
    from(table) {
      return {
        delete() {
          const chain = {
            eq(k, v) {
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
              if (failListing) return Promise.resolve({ data: null, error: { message: 'RLS denied' } })
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
  it('states the points effects accurately per the 9.17 triggers', () => {
    const msg = deleteListingConfirmMessage('စမ်းသပ်')
    expect(msg).toContain('စမ်းသပ်')
    expect(msg).toContain('+10')
    expect(msg).toContain('+20')
    expect(msg).toContain('+5')
    expect(msg).toContain('ပြန်မရနိုင်ပါ')
    expect(msg).toContain('Admin')
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
