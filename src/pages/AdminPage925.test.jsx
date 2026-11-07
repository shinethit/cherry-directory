// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminPage from './AdminPage'

// v9.25 REGENERATION — bulk delete render tests (Admin listings tab).
// As admin the tab shows per-row checkboxes + select-all + bulk button;
// selecting 2 rows enables the bulk button with count 2; as moderator
// (isAdmin false) no checkbox/select-all/bulk button renders while
// VIEW/EDIT still do; a declined confirm deletes nothing.
// Follows the ProfilePage922.test.jsx mocking pattern.

const { mockAuth, mockConfirm, mockToast, mockDB } = vi.hoisted(() => ({
  mockAuth: {
    user: { id: 'admin-1' },
    loading: false,
    isAdmin: true,
    isModerator: false,
    isSuperAdmin: false,
  },
  mockConfirm: { value: false, calls: [] },
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockDB: {
    listings: [
      { id: 'l1', name_mm: 'ဆိုင် ၁', name: 'Shop 1', status: 'approved', city: 'Taunggyi', address: 'လိပ်စာ ၁', category: { name_mm: 'စား', name: 'Food' }, submitter: { full_name: 'A' } },
      { id: 'l2', name_mm: 'ဆိုင် ၂', name: 'Shop 2', status: 'approved', city: 'Taunggyi', address: 'လိပ်စာ ၂', category: { name_mm: 'စား', name: 'Food' }, submitter: { full_name: 'B' } },
    ],
    deletedIds: [],
  },
}))

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockAuth }))
vi.mock('../hooks/useAuditLog', () => ({ useAuditLog: () => ({ log: vi.fn(async () => true) }) }))
vi.mock('../lib/confirmDialog', () => ({
  confirmDialog: vi.fn(async (...args) => { mockConfirm.calls.push(args); return mockConfirm.value }),
}))
vi.mock('../lib/toast', () => ({ showError: (...a) => mockToast.error(...a), showSuccess: (...a) => mockToast.success(...a) }))

// Chainable supabase builder: listings load returns the 2 rows, count
// queries return 0, report counts return [], and a listing-row delete
// records the id (cleanup deletes resolve { error: null }).
vi.mock('../lib/supabase', () => ({
  supabase: {
    from(table) {
      let mode = null
      let head = false
      let selected = false
      let eqId = null
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
        update() { return b },
        insert() { return b },
        single() { return b },
        maybeSingle() { return b },
        then(resolve) {
          if (mode === 'delete' && selected) {
            if (table === 'listings' && eqId) mockDB.deletedIds.push(eqId)
            resolve({ data: [{ name_mm: 'ဆိုင်', name: 'Shop' }], error: null })
          } else if (mode === 'delete') {
            resolve({ error: null })
          } else if (head) {
            resolve({ count: 0, data: null, error: null })
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

describe('v9.25 bulk delete: Admin listings tab renders', () => {
  beforeEach(() => {
    mockAuth.isAdmin = true
    mockAuth.isModerator = false
    mockConfirm.value = false
    mockConfirm.calls.length = 0
    mockDB.deletedIds.length = 0
    mockToast.success.mockClear()
    mockToast.error.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('as admin shows checkboxes + select-all + bulk button; selecting 2 enables it with count 2', async () => {
    const { container } = renderAdmin()
    await waitForRows()
    // 2 row checkboxes + 1 select-all checkbox.
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(3)
    expect(screen.getByText(/စာရင်းပါ 2 ခု အားလုံး ရွေးမည်/)).toBeTruthy()
    expect(screen.getByText('0 ခု ရွေးထားသည်')).toBeTruthy()
    const bulkBtn = screen.getByText(/ရွေးထားတာ ဖျက်မည် \(0\)/)
    expect(bulkBtn.disabled).toBe(true)

    const rowBoxes = container.querySelectorAll('input[type="checkbox"]')
    // Row checkboxes are the last two (select-all is rendered first in the bar).
    fireEvent.click(rowBoxes[1])
    fireEvent.click(rowBoxes[2])
    await waitFor(() => expect(screen.getByText('2 ခု ရွေးထားသည်')).toBeTruthy())
    const enabledBtn = screen.getByText(/ရွေးထားတာ ဖျက်မည် \(2\)/)
    expect(enabledBtn.disabled).toBe(false)
  })

  it('confirm declined → zero deletes, no success toast', async () => {
    mockConfirm.value = false
    const { container } = renderAdmin()
    await waitForRows()
    const rowBoxes = container.querySelectorAll('input[type="checkbox"]')
    fireEvent.click(rowBoxes[1])
    await waitFor(() => expect(screen.getByText('1 ခု ရွေးထားသည်')).toBeTruthy())
    fireEvent.click(screen.getByText(/ရွေးထားတာ ဖျက်မည် \(1\)/))
    await waitFor(() => expect(mockConfirm.calls.length).toBe(1))
    // Let any delete settle, then assert nothing was deleted.
    await new Promise((r) => setTimeout(r, 50))
    expect(mockDB.deletedIds).toEqual([])
    expect(mockToast.success).not.toHaveBeenCalled()
  })

  it('confirm accepted → both rows deleted, one summary toast', async () => {
    mockConfirm.value = true
    const { container } = renderAdmin()
    await waitForRows()
    const rowBoxes = container.querySelectorAll('input[type="checkbox"]')
    fireEvent.click(rowBoxes[1])
    fireEvent.click(rowBoxes[2])
    await waitFor(() => expect(screen.getByText('2 ခု ရွေးထားသည်')).toBeTruthy())
    fireEvent.click(screen.getByText(/ရွေးထားတာ ဖျက်မည် \(2\)/))
    await waitFor(() => expect(mockDB.deletedIds).toEqual(['l1', 'l2']))
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('🗑️ 2 ခု ဖျက်ပြီးပါပြီ'))
  })

  it('as moderator no checkbox/select-all/bulk button anywhere, while VIEW/EDIT still render', async () => {
    mockAuth.isAdmin = false
    mockAuth.isModerator = true
    const { container } = renderAdmin()
    await waitForRows()
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
    expect(screen.queryByText(/စာရင်းပါ .* ခု အားလုံး ရွေးမည်/)).toBeNull()
    expect(screen.queryByText(/ရွေးထားတာ ဖျက်မည်/)).toBeNull()
    expect(screen.queryByText('DELETE')).toBeNull()
    expect(screen.getAllByText('VIEW').length).toBeGreaterThan(0)
    expect(screen.getAllByText('EDIT').length).toBeGreaterThan(0)
  })
})

describe('Admin secondary counts: resolve-with-error keeps the old badge/counts (v9.25 regen #5)', () => {
  // These counts run inside loadListings/loadPendingClaimCount with a
  // mocked supabase in this file, so the throw-into-catch guards are
  // asserted on the source: a resolve-with-error must not zero them.
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'AdminPage.jsx'), 'utf8')

  it('pending listings badge count throws on error', () => {
    expect(src).toContain('const { count: pendingCount, error: countErr }')
    expect(src).toContain('if (countErr) throw countErr')
  })

  it('per-listing report counts throw on error', () => {
    expect(src).toContain('const { data: repRows, error: repErr }')
    expect(src).toContain('if (repErr) throw repErr')
  })

  it('pending claims badge count throws on error', () => {
    expect(src).toContain('const { count, error: claimsErr }')
    expect(src).toContain('if (claimsErr) throw claimsErr')
  })
})
