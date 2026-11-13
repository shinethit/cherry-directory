// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { LangProvider } from '../contexts/LangContext'
import { queryClient } from '../lib/queryClient'
import CategoryManagerPage from './CategoryManagerPage'

// v9.40 — ITEM 1: a category added/edited/deleted/toggled in the
// Manager must show up IMMEDIATELY everywhere (the ['categories'],
// ['home','categories'], ['category-map'] and ['category-tree']
// queries are invalidated), and the duplicate check must read FRESH
// server data instead of the manager's locally loaded list.
//
// Mock split (the whole point of (B)): load()'s select('*') returns a
// STALE snapshot (mockDB.loadRows) while the duplicate-check select
// ('id, name, name_mm, type') returns the LIVE mockDB.cats — exactly
// like a second admin adding a row while this manager page is open.
//
// NOTE: this file has NO filesystem-path comparisons at all, so the
// 9.19/9.25 backslash-path rule does not apply here — stated
// explicitly per the brief.

const HEALTH_CAT = { id: 'health-id', icon: '🏥', name: 'Health', name_mm: 'ကျန်းမာရေး', type: 'directory', sort_order: 0, parent_id: null, is_active: true }
const HOSP_SUB = { id: 'hospital-id', icon: '🏥', name: 'Hospital', name_mm: 'ဆေးရုံ', type: 'directory', sort_order: 0, parent_id: 'health-id', is_active: true }
const CLINIC_CAT = { id: 'clinic-id', icon: '🏥', name: 'Clinic', name_mm: 'ဆေးခန်း', type: 'directory', sort_order: 0, parent_id: null, is_active: true }

const { mockDB } = vi.hoisted(() => ({
  mockDB: { cats: [], loadRows: [], newId: 0, listingCount: 0 },
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from(table) {
      const state = { table, payload: null, op: null, eqs: {}, selectCols: '' }
      const b = {
        select(cols, opts) { state.selectCols = cols; if (opts?.head) state.op = 'count'; return b },
        eq(k, v) { state.eqs[k] = v; return b },
        in() { return b },
        order() { return b },
        insert(payload) {
          state.op = 'insert'
          state.payload = payload
          return b
        },
        update(payload) {
          state.op = 'update'
          state.payload = payload
          return b
        },
        delete() {
          state.op = 'delete'
          return b
        },
        single() { return b },
        then(resolve) {
          if (state.op === 'count') {
            resolve({ count: mockDB.listingCount, data: null, error: null })
            return
          }
          // Mutations apply HERE, not in insert()/update()/delete():
          // the chain calls .eq('id', …) AFTER the mutation call, so
          // state.eqs is only final inside then().
          if (state.op === 'insert') {
            if (state.table === 'categories') {
              const row = { id: `cat-new-${++mockDB.newId}`, ...state.payload }
              mockDB.cats.push(row)
              resolve({ data: row, error: null })
            } else {
              resolve({ data: null, error: null })
            }
            return
          }
          if (state.op === 'update') {
            const row = mockDB.cats.find(c => String(c.id) === String(state.eqs.id))
            if (row) Object.assign(row, state.payload)
            resolve({ error: null })
            return
          }
          if (state.op === 'delete') {
            const idx = mockDB.cats.findIndex(c => String(c.id) === String(state.eqs.id))
            if (idx >= 0) mockDB.cats.splice(idx, 1)
            resolve({ error: null })
            return
          }
          if (state.table === 'categories') {
            // The duplicate-check select reads LIVE data; load()'s
            // select('*') reads the STALE snapshot.
            if (state.selectCols === 'id, name, name_mm, type') resolve({ data: [...mockDB.cats], error: null })
            else resolve({ data: [...mockDB.loadRows], error: null })
            return
          }
          resolve({ data: null, error: null })
        },
      }
      return b
    },
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1' }, isLoggedIn: true, profile: null,
    isAdmin: true, isModerator: false, loading: false, signOut: vi.fn(),
  }),
}))

vi.mock('../lib/confirmDialog', () => ({
  confirmDialog: vi.fn(async () => true),
}))

vi.mock('../lib/toast', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

// Probe: an ACTIVE observer on the shared ['categories'] query, like
// the Directory/Home pages. Its data only refreshes when the query is
// invalidated (staleTime is 5 min) — so it proves the invalidation.
function CategoriesProbe() {
  const { data } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => [...mockDB.cats],
  })
  return <div data-testid="probe">{(data || []).map(c => c.name_mm || c.name).join(',')}</div>
}

function renderManager() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/categories']}>
        <LangProvider>
          <CategoriesProbe />
          <CategoryManagerPage />
        </LangProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// Lucide buttons carry no text — find them by their icon class.
function buttonWithIcon(container, iconClass) {
  return [...container.querySelectorAll('button')].find(b => b.innerHTML.includes(iconClass))
}

const CATEGORY_KEYS = [
  ['categories'],
  ['home', 'categories'],
  ['category-map'],
  ['category-tree'],
]

function expectInvalidated(spy) {
  for (const key of CATEGORY_KEYS) {
    expect(spy).toHaveBeenCalledWith({ queryKey: key })
  }
}

beforeEach(() => {
  cleanup()
  mockDB.cats = [{ ...HEALTH_CAT }, { ...HOSP_SUB }]
  mockDB.loadRows = [{ ...HEALTH_CAT }, { ...HOSP_SUB }]
  mockDB.newId = 0
  mockDB.listingCount = 0
  queryClient.clear()
  window.localStorage.clear()
})

afterEach(() => { cleanup() })

describe('v9.40 (A) CATEGORY INVALIDATION — Manager changes reach the cached queries at once', () => {
  it('add: the [\'categories\'] probe shows the new row immediately after save, without waiting for staleTime', async () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    try {
      const { container } = renderManager()
      await waitFor(() => expect(screen.getByText('ကျန်းမာရေး')).toBeTruthy(), { timeout: 5000 })
      expect(screen.getByTestId('probe').textContent).toContain('ကျန်းမာရေး')

      // Open the Add form (first 'ထည့်မည်' is the header button).
      fireEvent.click(screen.getAllByText('ထည့်မည်')[0])
      fireEvent.change(screen.getByPlaceholderText('ဥပမာ: စားသောက်ဆိုင်'), { target: { value: 'ဆေးခန်း' } })
      fireEvent.change(screen.getByPlaceholderText('e.g. Restaurant & Food'), { target: { value: 'Clinic' } })
      // The form's save is the LAST 'ထည့်မည်' (modal renders last).
      const saveBtns = screen.getAllByText('ထည့်မည်')
      fireEvent.click(saveBtns[saveBtns.length - 1])

      // On 9.39 the Manager never invalidates, so the probe (staleTime
      // 5 min) keeps showing the old list forever and this times out.
      await waitFor(() => expect(screen.getByTestId('probe').textContent).toContain('ဆေးခန်း'), { timeout: 5000 })
      expectInvalidated(spy)
    } finally {
      spy.mockRestore()
    }
  }, 20000)

  it('edit: saving an edit invalidates the category keys', async () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    try {
      const { container } = renderManager()
      await waitFor(() => expect(screen.getByText('ကျန်းမာရေး')).toBeTruthy(), { timeout: 5000 })
      const row = screen.getByText('ကျန်းမာရေး').closest('.rounded-2xl')
      fireEvent.click(buttonWithIcon(row, 'lucide-pencil'))
      await waitFor(() => expect(screen.getByPlaceholderText('ဥပမာ: စားသောက်ဆိုင်')).toBeTruthy(), { timeout: 5000 })
      fireEvent.change(screen.getByPlaceholderText('ဥပမာ: စားသောက်ဆိုင်'), { target: { value: 'ကျန်းမာရေး ပြင်ပြီး' } })
      fireEvent.click(screen.getByText('သိမ်းမည်'))
      await waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 5000 })
      expectInvalidated(spy)
    } finally {
      spy.mockRestore()
    }
  }, 20000)

  it('delete: deleting a category invalidates the category keys', async () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    try {
      const { container } = renderManager()
      await waitFor(() => expect(screen.getByText('ကျန်းမာရေး')).toBeTruthy(), { timeout: 5000 })
      const row = screen.getByText('ကျန်းမာရေး').closest('.rounded-2xl')
      fireEvent.click(buttonWithIcon(row, 'lucide-trash-2'))
      await waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 5000 })
      expectInvalidated(spy)
    } finally {
      spy.mockRestore()
    }
  }, 20000)

  it('toggle: hiding a category invalidates the category keys', async () => {
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    try {
      const { container } = renderManager()
      await waitFor(() => expect(screen.getByText('ကျန်းမာရေး')).toBeTruthy(), { timeout: 5000 })
      const row = screen.getByText('ကျန်းမာရေး').closest('.rounded-2xl')
      fireEvent.click(buttonWithIcon(row, 'lucide-eye'))
      await waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 5000 })
      expectInvalidated(spy)
    } finally {
      spy.mockRestore()
    }
  }, 20000)
})

describe('v9.40 (B) DUPLICATE FRESHNESS — a row added elsewhere is caught', () => {
  it('adding a name that another admin just added (local list stale) shows the duplicate error and does not insert', async () => {
    renderManager()
    await waitFor(() => expect(screen.getByText('ကျန်းမာရေး')).toBeTruthy(), { timeout: 5000 })

    // Another admin adds Clinic AFTER this page loaded — the local
    // list (loadRows) never learns about it.
    mockDB.cats.push({ ...CLINIC_CAT })
    expect(mockDB.loadRows.find(c => c.id === 'clinic-id')).toBeUndefined()

    fireEvent.click(screen.getAllByText('ထည့်မည်')[0])
    fireEvent.change(screen.getByPlaceholderText('ဥပမာ: စားသောက်ဆိုင်'), { target: { value: 'ဆေးခန်း' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. Restaurant & Food'), { target: { value: 'Clinic' } })
    const saveBtns = screen.getAllByText('ထည့်မည်')
    fireEvent.click(saveBtns[saveBtns.length - 1])

    // On 9.39 the check reads only the stale local list, so the save
    // sails through and inserts a second Clinic instead of erroring.
    await waitFor(() => expect(screen.getByText('အမည်တူ Category ရှိပြီးဖြစ်သည်')).toBeTruthy(), { timeout: 5000 })
    expect(mockDB.cats.filter(c => c.name === 'Clinic').length).toBe(1)
  }, 20000)
})
