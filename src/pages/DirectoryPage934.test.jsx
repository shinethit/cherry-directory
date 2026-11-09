// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LangProvider } from '../contexts/LangContext'
import DirectoryPage from './DirectoryPage'

// v9.34 (Bug 2): the Employment picker showed '–' for all 3
// subcategories and stayed there after Back. Deterministic cause:
// goBack() clears only selectedSubcategory, so the count-loading
// effect (deps [selectedCategory, featuredOnly]) never re-ran — and
// the ?cat= change made directNavigate's map-first branch overwrite
// the good counts with listing_count null. The fix adds
// selectedSubcategory to the effect's deps and reloads whenever the
// picker is shown (selectedCategory set, no subcategory). Secondary
// hardening: when ALL per-count allSettled entries reject, the
// retry strip now appears (it used to stay invisible because the
// error flag was only set when the subcategory LIST fetch failed).
//
// Live ids + counts (verified 2026-11-09): Employment Services
// 87995bcc-c256-4862-8f13-cd8b461e4198 (parent, 0 direct approved),
// Oversea f63d3b66-62e5-4afc-afd9-56213453fbce = 81, Local
// 22fff112-bdc6-41a6-b79a-529f201fb5a8 = 37, Seaman
// 5fe31f10-b7c9-4024-b45f-81a604e1824d = 32.
const EMP_ID = '87995bcc-c256-4862-8f13-cd8b461e4198'
const OVERSEA_ID = 'f63d3b66-62e5-4afc-afd9-56213453fbce'
const LOCAL_ID = '22fff112-bdc6-41a6-b79a-529f201fb5a8'
const SEAMAN_ID = '5fe31f10-b7c9-4024-b45f-81a604e1824d'
const EMP_CAT = { id: EMP_ID, icon: '💼', name: 'Employment Services', name_mm: 'အလုပ်အကိုင် ဝန်ဆောင်မှု', parent_id: null }
const OVERSEA_SUB = { id: OVERSEA_ID, icon: '🌍', name: 'Oversea', name_mm: 'ပြည်ပ အလုပ်အကိုင်', parent_id: EMP_ID }
const LOCAL_SUB = { id: LOCAL_ID, icon: '🏠', name: 'Local', name_mm: 'ပြည်တွင်း အလုပ်အကိုင်', parent_id: EMP_ID }
const SEAMAN_SUB = { id: SEAMAN_ID, icon: '⚓', name: 'Seaman', name_mm: 'သင်္ဘောသား', parent_id: EMP_ID }
const ALL_CATS = [EMP_CAT, OVERSEA_SUB, LOCAL_SUB, SEAMAN_SUB]
const TREE_ROWS = ALL_CATS.map(c => ({ id: c.id, parent_id: c.parent_id }))

function makeRow(id, name, categoryId) {
  return {
    id,
    name,
    name_mm: name,
    city: 'Taunggyi',
    rating_avg: 4.5,
    rating_count: 2,
    category_id: categoryId,
    category: { name: 'Employment Services', name_mm: 'အလုပ်အကိုင် ဝန်ဆောင်မှု', icon: '💼' },
  }
}
const ALL_ROWS = [
  ...Array.from({ length: 81 }, (_, i) => makeRow(`row-oversea-${i}`, `Oversea Agency ${i + 1}`, OVERSEA_ID)),
  ...Array.from({ length: 37 }, (_, i) => makeRow(`row-local-${i}`, `Local Agency ${i + 1}`, LOCAL_ID)),
  ...Array.from({ length: 32 }, (_, i) => makeRow(`row-seaman-${i}`, `Seaman Agency ${i + 1}`, SEAMAN_ID)),
]

const { mockFetchCategories, mockDB } = vi.hoisted(() => ({
  mockFetchCategories: vi.fn(),
  mockDB: { cats: [], rows: [], failTree: false, failCountsTimes: 0, countCalls: 0 },
}))

vi.mock('../lib/prefetch', () => ({ fetchCategories: mockFetchCategories }))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoggedIn: false }),
}))

vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ cities: ['Taunggyi', 'Kalaw'] }),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from(table) {
      const state = { table, head: false, selectCols: '', eqs: {}, inVals: null, rangeStart: 0, single: false }
      const b = {
        select(cols, opts) { state.selectCols = cols; if (opts?.head) state.head = true; return b },
        eq(k, v) { state.eqs[k] = v; return b },
        is() { return b },
        order() { return b },
        range(a) { state.rangeStart = a; return b },
        limit() { return b },
        in(k, v) { state.inVals = v; return b },
        or() { return b },
        abortSignal() { return b },
        single() { state.single = true; return b },
        then(resolve) {
          if (state.single) {
            if (state.table === 'categories') {
              resolve({ data: mockDB.cats.find(c => String(c.id) === String(state.eqs.id)) || null, error: null })
            } else {
              resolve({ data: null, error: null })
            }
            return
          }
          if (state.head) {
            if (state.table === 'listings' && state.inVals) {
              // Subcategory counts. failCountsTimes fails the first N
              // count attempts, then succeeds — the "fails once" case.
              mockDB.countCalls++
              if (mockDB.failCountsTimes > 0) { mockDB.failCountsTimes--; resolve({ count: null, data: null, error: new Error('count failed') }); return }
              resolve({ count: mockDB.rows.filter(r => state.inVals.includes(r.category_id)).length, data: null, error: null })
              return
            }
            if (state.table === 'listings' && state.eqs.category_id) {
              mockDB.countCalls++
              resolve({ count: mockDB.rows.filter(r => r.category_id === state.eqs.category_id).length, data: null, error: null })
              return
            }
            if (state.table === 'categories' && state.eqs.parent_id) {
              resolve({ count: mockDB.cats.filter(c => c.parent_id === state.eqs.parent_id).length, data: null, error: null })
              return
            }
            resolve({ count: 0, data: null, error: null })
            return
          }
          if (state.table === 'categories') {
            if (state.selectCols === 'id, parent_id') {
              if (mockDB.failTree) { resolve({ data: null, error: new Error('tree failed') }); return }
              resolve({ data: mockDB.cats, error: null })
              return
            }
            if (state.eqs.parent_id) resolve({ data: mockDB.cats.filter(c => c.parent_id === state.eqs.parent_id), error: null })
            else resolve({ data: mockDB.cats, error: null })
          } else if (state.table === 'listings') {
            const allowed = state.inVals || (state.eqs.category_id ? [state.eqs.category_id] : null)
            const filtered = allowed ? mockDB.rows.filter(r => allowed.includes(r.category_id)) : [...mockDB.rows]
            resolve({ data: filtered.slice(state.rangeStart, state.rangeStart + 20), count: filtered.length, error: null })
          } else {
            resolve({ data: [], error: null })
          }
        },
      }
      return b
    },
  },
}))

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 5 * 60 * 1000, gcTime: 24 * 60 * 60 * 1000 },
    },
  })
}

function renderDirectory(client) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/directory']}>
        <LangProvider>
          <DirectoryPage />
        </LangProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

async function tapCategory() {
  await waitFor(() => expect(screen.getByText('အလုပ်အကိုင် ဝန်ဆောင်မှု')).toBeTruthy(), { timeout: 5000 })
  fireEvent.click(screen.getByText('အလုပ်အကိုင် ဝန်ဆောင်မှု'))
  await waitFor(
    () => expect(screen.getByText('ပြည်တွင်း အလုပ်အကိုင်')).toBeTruthy(),
    { timeout: 5000 },
  )
}

beforeEach(() => {
  cleanup()
  mockFetchCategories.mockReset()
  mockFetchCategories.mockResolvedValue([EMP_CAT])
  mockDB.cats = [...ALL_CATS]
  mockDB.rows = [...ALL_ROWS]
  mockDB.failTree = false
  mockDB.failCountsTimes = 0
  mockDB.countCalls = 0
})

afterEach(() => { cleanup() })

describe('v9.34 Employment picker: counts failing once then succeeding', () => {
  it('first load shows – + retry strip; retry shows the real counts (81/37/32)', async () => {
    // The first load's 3 count queries all fail once.
    mockDB.failCountsTimes = 3
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)

    await tapCategory()
    // Stranded state before the fix: '–' on every row and NO retry
    // UI (the error flag was only set when the subcategory LIST
    // fetch failed, not when the counts failed).
    expect(screen.getAllByText('–')).toHaveLength(3)
    expect(screen.getByText('ပြန်ကြိုးစားမည်')).toBeTruthy()

    fireEvent.click(screen.getByText('ပြန်ကြိုးစားမည်'))
    await waitFor(() => expect(screen.getByText('81 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('37 လုပ်ငန်း')).toBeTruthy()
    expect(screen.getByText('32 လုပ်ငန်း')).toBeTruthy()
    expect(screen.queryByText('–')).toBeNull()
  }, 20000)
})

describe('v9.34 Employment picker: Back from listings re-fetches counts', () => {
  it('Back wipes counts to null via directNavigate, then the picker reloads them', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)

    await tapCategory()
    await waitFor(() => expect(screen.getByText('81 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('37 လုပ်ငန်း')).toBeTruthy()
    expect(screen.getByText('32 လုပ်ငန်း')).toBeTruthy()
    const callsAfterFirstLoad = mockDB.countCalls
    expect(callsAfterFirstLoad).toBeGreaterThanOrEqual(3)

    fireEvent.click(screen.getByText('ပြည်တွင်း အလုပ်အကိုင်'))
    await waitFor(() => expect(screen.getByText('37 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('Local Agency 1')).toBeTruthy()

    // In-app Back: goBack clears the subcategory and sets ?cat= to
    // the parent — before the fix the picker came back with '–' on
    // every row and never retried.
    fireEvent.click(screen.getByText('နောက်သို့'))
    await waitFor(() => expect(screen.getByText('81 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('37 လုပ်ငန်း')).toBeTruthy()
    expect(screen.getByText('32 လုပ်ငန်း')).toBeTruthy()
    expect(screen.queryByText('–')).toBeNull()
    // The counts were actually re-fetched, not just left over.
    expect(mockDB.countCalls).toBeGreaterThanOrEqual(callsAfterFirstLoad + 3)
  }, 20000)
})
