// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LangProvider } from '../contexts/LangContext'
import DirectoryPage from './DirectoryPage'

// v9.43: COUNT ONCE PER FILTER. PostgREST count:'exact' is a full
// count scan; the 9.37/9.39 chain re-fetched it on EVERY page (9
// scans for Car Rental) and on every background refetch. Now only
// page 0 requests the count; pages > 0 return total: null and the
// apply effect keeps the page-0 total, and hydration reads the
// total from page 0. These tests prove:
//   (i)   count:'exact' is requested ONLY for page 0 across a full
//         cold chain to 172/172;
//   (ii)  after page 1 applies, the total still reads 172 (the ring
//         shows 40/172, not 0);
//   (iii) hydration with seeded pages where pages > 0 carry
//         total: null still shows 172/172 at once;
//   (iv)  9.31 regression — a fresh cached 0 entry still refetches
//         rows to 173;
//   (v)   9.38 regression under the new format — a page refetch
//         failing with cached data still advances (no strip);
//   (vi)  loadSubcategories uses the aggregated RPC (c2) and the
//         chain still completes;
//   (vii) RPC unavailable → per-subcategory fallback still completes.
//
// NOTE: this file has NO filesystem-path comparisons at all (no
// path.relative / path.join / readdir comparisons), so the 9.19/9.25
// backslash-path rule does not apply here — stated explicitly per
// the brief.

const CAT_ID = 'car-parent-id'
const CAR_ID = 'car-rental-sub-id'
const CAT = { id: CAT_ID, icon: '🚗', name: 'Car Rental', name_mm: 'ကားငှားဝန်ဆောင်မှု', parent_id: null }
const CAR_SUB = { id: CAR_ID, icon: '🚗', name: 'Car Rental', name_mm: 'ကားငှားဝန်ဆောင်မှု', parent_id: CAT_ID }
const ALL_CATS = [CAT, CAR_SUB]

const CITIES = ['Taunggyi', 'Kalaw', 'Heho']
function makeRows(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `row-${i}`,
    name: `Car Rental ${i + 1}`,
    name_mm: `Car Rental ${i + 1}`,
    city: CITIES[i % 3],
    rating_avg: 4.5,
    rating_count: 2,
    category_id: CAR_ID,
    category: { name: 'Car Rental', name_mm: 'ကားငှားဝန်ဆောင်မှု', icon: '🚗' },
  }))
}

const { mockFetchCategories, mockDB } = vi.hoisted(() => ({
  mockFetchCategories: vi.fn(),
  mockDB: {
    cats: [], rows: [],
    failPages: {}, hangPages: new Set(), pendingResolves: {},
    listingsCalls: [], countCalls: [], rpcCalls: [], rpcError: false,
  },
}))

const ioConstructed = []
class RecordingIntersectionObserver {
  constructor() { ioConstructed.push(1) }
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', RecordingIntersectionObserver)

vi.mock('../lib/prefetch', async (importOriginal) => {
  const actual = await importOriginal()
  // Only fetchCategories is mocked (the ['categories'] warm path);
  // fetchListingCountsByCategory + sumDescendantCounts stay REAL so
  // loadSubcategories' (c2) RPC path runs against the mocked
  // supabase.rpc below — otherwise the import would be undefined
  // and the RPC path could never be exercised here.
  return { ...actual, fetchCategories: mockFetchCategories }
})

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoggedIn: false }),
}))

vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ cities: ['Taunggyi', 'Kalaw', 'Heho'] }),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    // v9.43: the mock records the count option per listings page
    // fetch (countCalls) and returns count: null when no count
    // option was passed, mirroring PostgREST. The 938 mock returned
    // count on every select, which would hide a total: null leak.
    from(table) {
      const state = { table, head: false, selectCols: '', countOpt: null, eqs: {}, inVals: null, rangeStart: 0, single: false }
      const b = {
        select(cols, opts) { state.selectCols = cols; if (opts?.head) state.head = true; if (opts?.count) state.countOpt = opts.count; return b },
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
              resolve({ count: mockDB.rows.filter(r => state.inVals.includes(r.category_id)).length, data: null, error: null })
              return
            }
            if (state.table === 'listings' && state.eqs.category_id) {
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
              resolve({ data: mockDB.cats, error: null })
              return
            }
            if (state.eqs.parent_id) resolve({ data: mockDB.cats.filter(c => c.parent_id === state.eqs.parent_id), error: null })
            else resolve({ data: mockDB.cats, error: null })
          } else if (state.table === 'listings') {
            const allowed = state.inVals || (state.eqs.category_id ? [state.eqs.category_id] : null)
            let filtered = allowed ? mockDB.rows.filter(r => allowed.includes(r.category_id)) : [...mockDB.rows]
            if (state.eqs.city) filtered = filtered.filter(r => r.city === state.eqs.city)
            const page = Math.floor(state.rangeStart / 20)
            mockDB.listingsCalls.push(page)
            mockDB.countCalls.push({ page, count: state.countOpt })
            // Mirror PostgREST: count is null unless count:'exact'
            // was requested on this select.
            const payload = { data: filtered.slice(state.rangeStart, state.rangeStart + 20), count: state.countOpt === 'exact' ? filtered.length : null, error: null }
            if (mockDB.hangPages.has(page)) {
              mockDB.hangPages.delete(page)
              mockDB.pendingResolves[page] = () => resolve(payload)
              return
            }
            if ((mockDB.failPages[page] || 0) > 0) {
              mockDB.failPages[page]--
              resolve({ data: null, count: null, error: new Error('page failed') })
              return
            }
            resolve(payload)
          } else {
            resolve({ data: [], error: null })
          }
        },
      }
      return b
    },
    rpc(fn) {
      mockDB.rpcCalls.push(fn)
      return {
        then(resolve) {
          if (mockDB.rpcError) {
            resolve({ data: null, error: new Error('rpc unavailable') })
            return
          }
          const byId = {}
          for (const r of mockDB.rows) byId[r.category_id] = (byId[r.category_id] || 0) + 1
          resolve({ data: Object.entries(byId).map(([category_id, listing_count]) => ({ category_id, listing_count })), error: null })
        },
      }
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

async function openCarRental(expectedTotal) {
  await waitFor(() => expect(screen.getByText('ကားငှားဝန်ဆောင်မှု')).toBeTruthy(), { timeout: 5000 })
  fireEvent.click(screen.getByText('ကားငှားဝန်ဆောင်မှု'))
  await waitFor(() => expect(screen.getByText('ကားငှားဝန်ဆောင်မှု')).toBeTruthy(), { timeout: 5000 })
  const rows = screen.getAllByText('ကားငှားဝန်ဆောင်မှု')
  fireEvent.click(rows[rows.length - 1])
  await waitFor(() => expect(screen.getByText(`${expectedTotal} ရလဒ်`)).toBeTruthy(), { timeout: 5000 })
}

const FILTER_KEY = 'car-rental-sub-id|car-rental-sub-id|All|false||rating'
function listingsKey(page) {
  return ['listings', 'directory', 'car-rental-sub-id', 'car-rental-sub-id', 'All', false, '', 'rating', page, false]
}

// Seed EVERY page into the QueryClient in the NEW 9.43 format:
// page 0 carries the total, pages > 0 carry total: null — exactly
// what the count-once queryFn persists to the cache.
function seedListingsCacheNewFormat(client) {
  const total = mockDB.rows.length
  const pages = Math.ceil(total / 20)
  for (let p = 0; p < pages; p++) {
    client.setQueryData(listingsKey(p), {
      rows: mockDB.rows.slice(p * 20, p * 20 + 20),
      total: p === 0 ? total : null,
      page: p,
      filterKey: FILTER_KEY,
    })
  }
}

beforeEach(() => {
  cleanup()
  ioConstructed.length = 0
  mockFetchCategories.mockReset()
  mockFetchCategories.mockResolvedValue([CAT])
  mockDB.cats = [...ALL_CATS]
  mockDB.rows = makeRows(172)
  mockDB.failPages = {}
  mockDB.hangPages = new Set()
  mockDB.pendingResolves = {}
  mockDB.listingsCalls = []
  mockDB.countCalls = []
  mockDB.rpcCalls = []
  mockDB.rpcError = false
})

afterEach(() => { cleanup() })

describe('v9.43 count once per filter', () => {
  it('(i) count:\'exact\' is requested ONLY for page 0 across a full cold chain to 172/172', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    await openCarRental(172)

    await waitFor(() => expect(screen.getByText('172 / 172')).toBeTruthy(), { timeout: 20000 })
    expect(screen.getByText('Car Rental 172')).toBeTruthy()
    expect(mockDB.listingsCalls).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    // One count scan per filter, not nine: only page 0 asked.
    expect(mockDB.countCalls.filter(c => c.count === 'exact').map(c => c.page)).toEqual([0])
    expect(mockDB.countCalls.map(c => c.page)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(ioConstructed.length).toBe(0)
  }, 30000)

  it('(ii) after page 1 applies, the total still reads 172 — the ring shows 40/172, not 0', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    await openCarRental(172)

    // Page 1 returns total: null; if it leaked into setTotal the
    // ring would collapse to 0 and the chain would stop.
    await waitFor(() => expect(screen.getByText('40 / 172')).toBeTruthy(), { timeout: 10000 })
    expect(screen.getByText('Car Rental 21')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('172 / 172')).toBeTruthy(), { timeout: 20000 })
    expect(screen.getByText('Car Rental 172')).toBeTruthy()
  }, 30000)

  it('(iii) hydration with seeded pages where pages > 0 carry total: null still shows 172/172 at once', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    seedListingsCacheNewFormat(client)
    renderDirectory(client)
    await openCarRental(172)

    // The full list shows at once from the cache — the total comes
    // from page 0, not from the last page (which carries null).
    await waitFor(() => expect(screen.getByText('172 / 172')).toBeTruthy(), { timeout: 20000 })
    expect(screen.getByText('Car Rental 172')).toBeTruthy()
    expect(screen.getByText('100%').closest('[data-testid="load-ring"]')).toBeTruthy()
    // Only one quiet background refetch remains on entry (page 0 —
    // v9.44: hydration no longer advances the page past 0, so the
    // last page's background refetch no longer fires).
    expect(mockDB.listingsCalls).toEqual([0])
    await act(async () => { await new Promise(r => setTimeout(r, 300)) })
    expect(mockDB.listingsCalls).toEqual([0])
  }, 30000)

  it('(iv) 9.31 regression — a fresh cached 0 entry still refetches rows to 173', async () => {
    mockDB.rows = makeRows(173)
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    // The persisted cache holds a stale EMPTY page 0 (the v9.31 (B)
    // case: { rows: [], total: 0 }); page 0 always requests the
    // count and always fetches rows, so the refetch lands the real
    // page 0 and the chain climbs to 173.
    client.setQueryData(listingsKey(0), { rows: [], total: 0, page: 0, filterKey: FILTER_KEY })
    renderDirectory(client)
    await openCarRental(173)

    await waitFor(() => expect(screen.getByText('173 / 173')).toBeTruthy(), { timeout: 20000 })
    expect(screen.getByText('Car Rental 173')).toBeTruthy()
    expect(mockDB.listingsCalls).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(mockDB.countCalls.filter(c => c.count === 'exact').map(c => c.page)).toEqual([0])
  }, 30000)

  it('(v) 9.38 regression under the new format — a page refetch failing with cached data still advances, no strip', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    seedListingsCacheNewFormat(client)
    // v9.44: hydration no longer advances the page past 0, so the
    // only background refetch on entry is page 0 — fail THAT one:
    // its data already applied from cache, so no error card / strip.
    mockDB.failPages = { 0: 99 }
    renderDirectory(client)
    await openCarRental(172)

    await waitFor(() => expect(screen.getByText('172 / 172')).toBeTruthy(), { timeout: 20000 })
    expect(screen.getByText('Car Rental 172')).toBeTruthy()
    expect(screen.queryByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeNull()
    expect(screen.queryByText('စာရင်း တစ်ချို့ တင်မရသေးပါ — အဟောင်းပြထားသည်')).toBeNull()
    expect(mockDB.listingsCalls).toEqual([0])
    await act(async () => { await new Promise(r => setTimeout(r, 300)) })
    expect(mockDB.listingsCalls).toEqual([0])
  }, 30000)

  it('(vi) loadSubcategories uses the aggregated RPC (c2) and the chain still completes', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    await openCarRental(172)

    await waitFor(() => expect(screen.getByText('172 / 172')).toBeTruthy(), { timeout: 20000 })
    expect(mockDB.rpcCalls).toContain('get_category_listing_counts')
    expect(screen.getByText('Car Rental 172')).toBeTruthy()
  }, 30000)

  it('(vii) RPC unavailable → per-subcategory fallback still completes the chain', async () => {
    mockDB.rpcError = true
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    await openCarRental(172)

    await waitFor(() => expect(screen.getByText('172 / 172')).toBeTruthy(), { timeout: 20000 })
    expect(mockDB.rpcCalls).toContain('get_category_listing_counts')
    expect(screen.getByText('Car Rental 172')).toBeTruthy()
  }, 30000)
})
