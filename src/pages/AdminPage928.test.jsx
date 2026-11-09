// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminPage from './AdminPage'
import { approveListingsBulk, approveAllConfirmMessage, approveSelectedConfirmMessage } from '../lib/listingStatus'

// v9.28 — bulk approve (Admin-only, same gate as bulk delete) + the
// bulk-delete label fix ("အပြီးဖျက်မည်" — the old "ဖျက်မည်" label was
// misread as bulk deselect). CORRECTION to the first 9.28 brief: the
// isAuthorized restructure is CANCELLED — the user DOES see the
// isAdmin-gated bulk bar, so approve buttons stay isAdmin-gated and
// the checkboxes/select-all stay isAdmin-only. Moderators therefore
// see NO bulk UI at all (same as bulk delete today).
// Follows the AdminPage925.test.jsx mocking pattern.

const { mockAuth, mockConfirm, mockToast, mockDB, mockLog } = vi.hoisted(() => ({
  mockAuth: {
    user: { id: 'admin-1' },
    loading: false,
    isAdmin: true,
    isModerator: false,
    isSuperAdmin: false,
  },
  mockConfirm: { value: false, calls: [] },
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockLog: vi.fn(async () => true),
  mockDB: {
    listings: [
      { id: 'l1', name_mm: 'ဆိုင် ၁', name: 'Shop 1', status: 'pending', city: 'Taunggyi', address: 'လိပ်စာ ၁', category: { name_mm: 'စား', name: 'Food' }, submitter: { full_name: 'A' } },
      { id: 'l2', name_mm: 'ဆိုင် ၂', name: 'Shop 2', status: 'pending', city: 'Taunggyi', address: 'လိပ်စာ ၂', category: { name_mm: 'စား', name: 'Food' }, submitter: { full_name: 'B' } },
    ],
    pendingCount: 2,
    updatedIds: [],
    updatePayloads: [],
    failIds: [],
    deletedIds: [],
  },
}))

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockAuth }))
vi.mock('../hooks/useAuditLog', () => ({ useAuditLog: () => ({ log: mockLog }) }))
vi.mock('../lib/confirmDialog', () => ({
  confirmDialog: vi.fn(async (...args) => { mockConfirm.calls.push(args); return mockConfirm.value }),
}))
vi.mock('../lib/toast', () => ({ showError: (...a) => mockToast.error(...a), showSuccess: (...a) => mockToast.success(...a) }))

// Chainable supabase builder: listings load returns the 2 pending rows,
// head-count queries return mockDB.pendingCount, an update records the
// id + payload (or errors for ids in failIds), a listing-row delete
// records the id (cleanup deletes resolve { error: null }).
vi.mock('../lib/supabase', () => ({
  supabase: {
    from(table) {
      let mode = null
      let head = false
      let selected = false
      let eqId = null
      let payload = null
      const b = {
        select(_cols, opts) { if (opts?.head) head = true; selected = true; return b },
        eq(k, v) { if (k === 'id') eqId = v; return b },
        neq() { return b },
        order() { return b },
        range() { return b },
        in() { return b },
        limit() { return b },
        delete() { mode = 'delete'; return b },
        match() { return b },
        update(p) { mode = 'update'; payload = p; return b },
        insert() { return b },
        single() { return b },
        maybeSingle() { return b },
        then(resolve) {
          if (mode === 'update') {
            if (mockDB.failIds.includes(eqId)) {
              resolve({ data: null, error: { message: 'update failed' } })
            } else {
              mockDB.updatedIds.push(eqId)
              mockDB.updatePayloads.push(payload)
              resolve({ data: [{ name_mm: 'ဆိုင်', name: 'Shop' }], error: null })
            }
          } else if (mode === 'delete' && selected) {
            if (table === 'listings' && eqId) mockDB.deletedIds.push(eqId)
            resolve({ data: [{ name_mm: 'ဆိုင်', name: 'Shop' }], error: null })
          } else if (mode === 'delete') {
            resolve({ error: null })
          } else if (head) {
            resolve({ count: mockDB.pendingCount, data: null, error: null })
          } else if (table === 'listings') {
            resolve({ data: mockDB.listings, error: null })
          } else {
            resolve({ data: [], error: null })
          }
        },
      }
      return b
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}))

afterEach(() => { cleanup() })

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin?tab=listings']}>
      <AdminPage />
    </MemoryRouter>,
  )
}

async function waitForRows() {
  await waitFor(() => expect(screen.getByText('ဆိုင် ၁')).toBeTruthy())
  expect(screen.getByText('ဆိုင် ၂')).toBeTruthy()
}

// Fake client for the helper unit tests — records the update payload
// per row and fails only the configured id.
function fakeClient({ failId } = {}) {
  const calls = []
  return {
    calls,
    from() {
      return {
        update(payload) {
          return {
            eq(_k, v) {
              return {
                select() {
                  calls.push({ id: v, payload })
                  if (failId === v) return Promise.resolve({ data: null, error: { message: 'boom' } })
                  return Promise.resolve({ data: [{ name_mm: `ဆိုင် ${v}`, name: `Shop ${v}` }], error: null })
                },
              }
            },
          }
        },
      }
    },
  }
}

const APPROVED_UPDATE = { status: 'approved', is_verified: true, verify_type: 'cherry' }

describe('v9.28 approveListingsBulk helper', () => {
  it('happy path — N rows → N per-row updates with buildListingStatusUpdate(approved), audit log per row', async () => {
    const client = fakeClient()
    const log = vi.fn(async () => true)
    const rows = [
      { id: 'l1', name_mm: 'ဆိုင် ၁', name: 'Shop 1' },
      { id: 'l2', name_mm: 'ဆိုင် ၂', name: 'Shop 2' },
    ]
    const result = await approveListingsBulk(client, rows, { log })
    expect(result.succeeded.map((r) => r.id)).toEqual(['l1', 'l2'])
    expect(result.failed).toEqual([])
    expect(client.calls).toHaveLength(2)
    expect(client.calls[0].payload).toEqual(APPROVED_UPDATE)
    expect(client.calls[1].payload).toEqual(APPROVED_UPDATE)
    expect(log).toHaveBeenCalledTimes(2)
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'approve', table: 'listings', id: 'l1', after: { status: 'approved' } }))
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'approve', table: 'listings', id: 'l2', after: { status: 'approved' } }))
  })

  it('partial failure — one row fails → counted, others still approved, no crash', async () => {
    const client = fakeClient({ failId: 'l2' })
    const log = vi.fn(async () => true)
    const rows = [
      { id: 'l1', name_mm: 'ဆိုင် ၁', name: 'Shop 1' },
      { id: 'l2', name_mm: 'ဆိုင် ၂', name: 'Shop 2' },
      { id: 'l3', name_mm: 'ဆိုင် ၃', name: 'Shop 3' },
    ]
    const result = await approveListingsBulk(client, rows, { log })
    expect(result.succeeded.map((r) => r.id)).toEqual(['l1', 'l3'])
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].row.id).toBe('l2')
    expect(result.failed[0].error.message).toBe('boom')
    // Audit log only for the rows that actually approved.
    expect(log).toHaveBeenCalledTimes(2)
  })

  it('chunking — 25 rows all processed (20-at-a-time chunks, nothing dropped)', async () => {
    const client = fakeClient()
    const rows = Array.from({ length: 25 }, (_, i) => ({ id: `r${i}`, name_mm: `ဆိုင် ${i}`, name: `Shop ${i}` }))
    const result = await approveListingsBulk(client, rows, { log: vi.fn(async () => true) })
    expect(result.succeeded).toHaveLength(25)
    expect(result.failed).toEqual([])
    expect(client.calls).toHaveLength(25)
  })

  it('confirm messages state the exact count and the +20 points note', () => {
    expect(approveAllConfirmMessage(600)).toContain('600')
    expect(approveAllConfirmMessage(600)).toContain('ဆိုင်းငံ့ထားတဲ့ လုပ်ငန်း အားလုံး')
    expect(approveAllConfirmMessage(600)).toContain('+20')
    expect(approveSelectedConfirmMessage(['ဆိုင် ၁', 'ဆိုင် ၂'], 2)).toContain('2')
    expect(approveSelectedConfirmMessage(['ဆိုင် ၁', 'ဆိုင် ၂'], 2)).toContain('+20')
  })
})

describe('v9.28 bulk approve: Admin listings tab', () => {
  beforeEach(() => {
    mockAuth.isAdmin = true
    mockAuth.isModerator = false
    mockConfirm.value = false
    mockConfirm.calls.length = 0
    mockDB.pendingCount = 2
    mockDB.updatedIds.length = 0
    mockDB.updatePayloads.length = 0
    mockDB.failIds.length = 0
    mockDB.deletedIds.length = 0
    mockToast.success.mockClear()
    mockToast.error.mockClear()
    mockLog.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('as admin shows both approve buttons + renamed delete button; Approve-selected disabled with nothing selected', async () => {
    renderAdmin()
    await waitForRows()
    await waitFor(() => expect(screen.getByText(/ဆိုင်းငံ့ထားတာ အားလုံး အတည်ပြုမည် \(2\)/)).toBeTruthy())
    const approveSelected = screen.getByText(/ရွေးထားတာ အတည်ပြုမည် \(0\)/)
    expect(approveSelected.disabled).toBe(true)
    // Delete label is unmistakably DELETE, never a deselect reading.
    expect(screen.getByText(/ရွေးထားတာ အပြီးဖျက်မည် \(0\)/)).toBeTruthy()
    expect(screen.queryByText(/ရွေးထားတာ ဖျက်မည် \(/)).toBeNull()
  })

  it('Approve all: confirm shows the exact pending count + points note; on accept both rows approved, one summary toast', async () => {
    mockConfirm.value = true
    renderAdmin()
    await waitForRows()
    fireEvent.click(screen.getByText(/ဆိုင်းငံ့ထားတာ အားလုံး အတည်ပြုမည် \(2\)/))
    await waitFor(() => expect(mockConfirm.calls.length).toBe(1))
    expect(mockConfirm.calls[0][0]).toContain('2')
    expect(mockConfirm.calls[0][0]).toContain('ဆိုင်းငံ့ထားတဲ့ လုပ်ငန်း အားလုံး')
    expect(mockConfirm.calls[0][0]).toContain('+20')
    await waitFor(() => expect(mockDB.updatedIds).toEqual(['l1', 'l2']))
    expect(mockDB.updatePayloads).toEqual([APPROVED_UPDATE, APPROVED_UPDATE])
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('✓ 2 ခု အတည်ပြုပြီးပါပြီ'))
    await waitFor(() => expect(mockLog).toHaveBeenCalledTimes(2))
  })

  it('Approve all: confirm declined → zero updates, no success toast', async () => {
    mockConfirm.value = false
    renderAdmin()
    await waitForRows()
    fireEvent.click(screen.getByText(/ဆိုင်းငံ့ထားတာ အားလုံး အတည်ပြုမည် \(2\)/))
    await waitFor(() => expect(mockConfirm.calls.length).toBe(1))
    await new Promise((r) => setTimeout(r, 50))
    expect(mockDB.updatedIds).toEqual([])
    expect(mockToast.success).not.toHaveBeenCalled()
  })

  it('Approve selected: only checked rows approved, succeeded ids cleared from selection', async () => {
    mockConfirm.value = true
    const { container } = renderAdmin()
    await waitForRows()
    const rowBoxes = container.querySelectorAll('input[type="checkbox"]')
    fireEvent.click(rowBoxes[1]) // l1 only
    await waitFor(() => expect(screen.getByText('1 ခု ရွေးထားသည်')).toBeTruthy())
    fireEvent.click(screen.getByText(/ရွေးထားတာ အတည်ပြုမည် \(1\)/))
    await waitFor(() => expect(mockDB.updatedIds).toEqual(['l1']))
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('✓ 1 ခု အတည်ပြုပြီးပါပြီ'))
    await waitFor(() => expect(screen.getByText('0 ခု ရွေးထားသည်')).toBeTruthy())
  })

  it('Approve selected, partial failure: failed row stays selected for retry, error toast names it', async () => {
    mockConfirm.value = true
    mockDB.failIds.push('l2')
    const { container } = renderAdmin()
    await waitForRows()
    const rowBoxes = container.querySelectorAll('input[type="checkbox"]')
    fireEvent.click(rowBoxes[1])
    fireEvent.click(rowBoxes[2])
    await waitFor(() => expect(screen.getByText('2 ခု ရွေးထားသည်')).toBeTruthy())
    fireEvent.click(screen.getByText(/ရွေးထားတာ အတည်ပြုမည် \(2\)/))
    await waitFor(() => expect(mockDB.updatedIds).toEqual(['l1']))
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('အတည်ပြုမရတာ 1 ခု')))
    expect(mockToast.error.mock.calls[0][0]).toContain('ဆိုင် ၂')
    expect(mockToast.error.mock.calls[0][0]).toContain('1 ခု အတည်ပြုပြီးပါပြီ')
    // Failed l2 stays selected; succeeded l1 is cleared.
    await waitFor(() => expect(screen.getByText('1 ခု ရွေးထားသည်')).toBeTruthy())
  })

  it('0 pending → no Approve-all button, Approve-selected still renders disabled', async () => {
    mockDB.pendingCount = 0
    renderAdmin()
    await waitForRows()
    expect(screen.queryByText(/ဆိုင်းငံ့ထားတာ အားလုံး အတည်ပြုမည်/)).toBeNull()
    expect(screen.getByText(/ရွေးထားတာ အတည်ပြုမည် \(0\)/).disabled).toBe(true)
  })

  it('as moderator no checkbox/select-all/approve/delete bulk UI anywhere, while VIEW/EDIT still render', async () => {
    mockAuth.isAdmin = false
    mockAuth.isModerator = true
    const { container } = renderAdmin()
    await waitForRows()
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
    expect(screen.queryByText(/စာရင်းပါ .* ခု အားလုံး ရွေးမည်/)).toBeNull()
    expect(screen.queryByText(/ရွေးထားတာ အတည်ပြုမည်/)).toBeNull()
    expect(screen.queryByText(/ဆိုင်းငံ့ထားတာ အားလုံး အတည်ပြုမည်/)).toBeNull()
    expect(screen.queryByText(/ရွေးထားတာ အပြီးဖျက်မည်/)).toBeNull()
    expect(screen.queryByText('DELETE')).toBeNull()
    expect(screen.getAllByText('VIEW').length).toBeGreaterThan(0)
    expect(screen.getAllByText('EDIT').length).toBeGreaterThan(0)
  })
})

describe('v9.28 source guards: isAdmin gates, version + changelog', () => {
  const srcDir = dirname(fileURLToPath(import.meta.url))
  const adminSrc = readFileSync(join(srcDir, 'AdminPage.jsx'), 'utf8')
  const headerSrc = readFileSync(join(srcDir, '..', 'components', 'Header.jsx'), 'utf8')
  const pkg = JSON.parse(readFileSync(join(srcDir, '..', '..', 'package.json'), 'utf8'))

  it('both bulk approve handlers are isAdmin-guarded with the mutual-exclusion guard', () => {
    expect(adminSrc).toContain('if (!isAdmin || bulkApproving || bulkDeleting || selectedIds.size === 0) return')
    expect(adminSrc).toContain('if (!isAdmin || bulkApproving || bulkDeleting || pendingListingsCount === 0) return')
  })

  it('bulk bar + checkboxes stay isAdmin-only (no isAuthorized gate on bulk UI)', () => {
    // No line that renders an approve button/checkbox gates on
    // isAuthorized — the bulk bar is the isAdmin block and the
    // approve buttons live inside it.
    const badLines = adminSrc.split('\n').filter((line) =>
      line.includes('isAuthorized') && (line.includes('အတည်ပြုမည်') || line.includes('Approve') || line.includes('checkbox') || line.includes('px-4 mb-4')),
    )
    expect(badLines).toEqual([])
    expect(adminSrc).toContain('handleApproveAllPending')
    expect(adminSrc).toContain('handleBulkApproveSelected')
  })

  it('package.json is 9.28 and the 9.28 changelog entry has zero "Admin"', () => {
    expect(pkg.version).toBe('9.34')
    const entry = headerSrc.split("{ v: '9.28'")[1].split('},')[0]
    expect(entry).toBeTruthy()
    expect(entry.toLowerCase()).not.toContain('admin')
  })

  it('delete label is unmistakably delete in source, approve labels unmistakably approve', () => {
    expect(adminSrc).toContain('ရွေးထားတာ အပြီးဖျက်မည်')
    expect(adminSrc).toContain('✓ ရွေးထားတာ အတည်ပြုမည်')
    expect(adminSrc).toContain('✓ ဆိုင်းငံ့ထားတာ အားလုံး အတည်ပြုမည်')
  })
})
