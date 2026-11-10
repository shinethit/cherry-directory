// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LangProvider } from '../contexts/LangContext'
import DirectoryPage from './DirectoryPage'

// v9.38: CACHED DATA MUST ADVANCE THE CHAIN. The 9.37 chain guard
// blocked on `listingsQueryError` — the query's isError — which goes
// true whenever a BACKGROUND refetch fails, even when the page's data
// already applied from the persisted cache. On a flaky network the
// phone sat at 20/172 forever: page 0 applied fine from cache, its
// refetch failed, the guard blocked the chain, and no error card /
// amber strip / retry ever appeared (rows existed, page was 0).
// These tests prove the distinction the fix draws:
//   * refetch failed BUT cached data applied → keep advancing;
//   * fetch failed WITH NO DATA → stop, show the error / strip +
//     retry, never loop; retry resumes the chain.
// Plus: the "Maximum update depth exceeded" stderr warnings from the
// 9.37 chain (test 3 of DirectoryPage937.test.jsx) must be gone, and
// a same-page refetch returning a NEW data object must still advance
// the chain.
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
    listingsCalls: [],
  },
}))

// Recording observer: if the component ever constructs one, the
// test fails. The chain must not need it at all.
const ioConstructed = []
class RecordingIntersectionObserver {
  constructor() { ioConstructed.push(1) }
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', RecordingIntersectionObserver)

vi.mock('../lib/prefetch', () => ({ fetchCategories: mockFetchCategories }))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoggedIn: false }),
}))

vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ cities: ['Taunggyi', 'Kalaw', 'Heho'] }),
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
            const payload = { data: filtered.slice(state.rangeStart, state.rangeStart + 20), count: filtered.length, error: null }
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

// Same clicks as openCarRental but without waiting for a results
// count — for the cold-cache page-0 failure, total stays 0 and the
// error card is the signal instead.
async function openCarRentalNoCount() {
  await waitFor(() => expect(screen.getByText('ကားငှားဝန်ဆောင်မှု')).toBeTruthy(), { timeout: 5000 })
  fireEvent.click(screen.getByText('ကားငှားဝန်ဆောင်မှု'))
  await waitFor(() => expect(screen.getByText('ကားငှားဝန်ဆောင်မှု')).toBeTruthy(), { timeout: 5000 })
  const rows = screen.getAllByText('ကားငှားဝန်ဆောင်မှု')
  fireEvent.click(rows[rows.length - 1])
}

// The listings query key for Car Rental on plain /directory:
// city 'All', verifiedOnly false, q '', sort 'rating' (default),
// featuredOnly false; CAR_SUB has no children so idsKey is its own id.
const FILTER_KEY = 'car-rental-sub-id|car-rental-sub-id|All|false||rating'
function listingsKey(page) {
  return ['listings', 'directory', 'car-rental-sub-id', 'car-rental-sub-id', 'All', false, '', 'rating', page, false]
}

// Seed EVERY page of the current mockDB.rows into the QueryClient,
// exactly as the persisted cache would hold them after a full visit:
// { rows, total, page, filterKey } — the SAME filterKey on all pages,
// so the apply effect appends instead of replacing on a key change.
function seedListingsCache(client) {
  const total = mockDB.rows.length
  const pages = Math.ceil(total / 20)
  for (let p = 0; p < pages; p++) {
    client.setQueryData(listingsKey(p), {
      rows: mockDB.rows.slice(p * 20, p * 20 + 20),
      total,
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
})

afterEach(() => { cleanup() })

describe('v9.38 cached data advances the chain', () => {
  it('(A) THE BUG: warm cache, EVERY refetch fails — the list still climbs to 172/172 from cache, no error card, no strip', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    seedListingsCache(client)
    // Every background refetch fails (high count per page, so the
    // decrementing mock fails on every attempt, not just once).
    mockDB.failPages = { 0: 99, 1: 99, 2: 99, 3: 99, 4: 99, 5: 99, 6: 99, 7: 99, 8: 99 }
    renderDirectory(client)
    await openCarRental(172)

    // On 9.37 this stuck at 20/172: page 0 applied from cache, its
    // refetch failed, listingsQueryError blocked the chain guard,
    // and nothing on screen offered a way forward.
    await waitFor(() => expect(screen.getByText('172 / 172')).toBeTruthy(), { timeout: 20000 })
    expect(screen.getByText('Car Rental 172')).toBeTruthy()
    expect(ioConstructed.length).toBe(0)
    // A failed refetch with applied data is NOT a display failure:
    // no full error card, no amber strip.
    expect(screen.queryByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeNull()
    expect(screen.queryByText('စာရင်း တစ်ချို့ တင်မရသေးပါ — အဟောင်းပြထားသည်')).toBeNull()
    // Each page's refetch was attempted exactly once — the chain
    // advanced through the cache, it did not loop on failing pages.
    expect(mockDB.listingsCalls).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    await act(async () => { await new Promise(r => setTimeout(r, 300)) })
    expect(mockDB.listingsCalls).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(screen.getByText('100%').closest('[data-testid="load-ring"]')).toBeTruthy()
  }, 30000)

  it('(B) TRUE FAILURE, cold cache, page 0 fetch fails — error card shows, chain does NOT advance or loop', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    mockDB.failPages = { 0: 99 }
    renderDirectory(client)
    await openCarRentalNoCount()

    await waitFor(() => expect(screen.getByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('ပြန်ကြိုးစားမည်')).toBeTruthy()
    // No rows at all — the failure really has no data behind it.
    expect(screen.queryByText('Car Rental 1')).toBeNull()
    expect(screen.queryByText('စာရင်း တစ်ချို့ တင်မရသေးပါ — အဟောင်းပြထားသည်')).toBeNull()
    // Exactly one request for page 0, and no loop while the card is up.
    expect(mockDB.listingsCalls).toEqual([0])
    await act(async () => { await new Promise(r => setTimeout(r, 400)) })
    expect(mockDB.listingsCalls).toEqual([0])
    // Retry still fails (page 0 keeps failing) — still the card,
    // still no loop, still no rows.
    fireEvent.click(screen.getByText('ပြန်ကြိုးစားမည်'))
    await act(async () => { await new Promise(r => setTimeout(r, 400)) })
    expect(mockDB.listingsCalls).toEqual([0, 0])
    expect(screen.getByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeTruthy()
    expect(screen.queryByText('Car Rental 1')).toBeNull()
  }, 20000)

  it('(C) TRUE FAILURE mid-chain, cold cache, page 0 OK then page 1 fails with no cached data — chain stops, amber strip + retry, retry resumes to the end', async () => {
    mockDB.rows = makeRows(173)
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    mockDB.failPages = { 1: 1 }
    renderDirectory(client)
    await openCarRental(173)

    // Page 0 landed (20 rows); page 1 failed with no cached data,
    // so the chain stops and the amber strip + retry show.
    await waitFor(() => expect(screen.getByText('စာရင်း တစ်ချို့ တင်မရသေးပါ — အဟောင်းပြထားသည်')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('Car Rental 1')).toBeTruthy()
    expect(screen.getByText('20 / 173')).toBeTruthy()
    expect(screen.getByText('ထပ်တင်ရန် (153 ကျန်)')).toBeTruthy()
    // No loop on the failing page while the strip is up.
    expect(mockDB.listingsCalls.filter(p => p === 1).length).toBe(1)
    await act(async () => { await new Promise(r => setTimeout(r, 300)) })
    expect(mockDB.listingsCalls.filter(p => p === 1).length).toBe(1)

    // Retry from the amber strip: the page lands, strip + button go,
    // and the chain RESUMES past the retried page by itself.
    fireEvent.click(screen.getByText('ပြန်ကြိုးစားမည်'))
    await waitFor(() => expect(screen.getByText('40 / 173')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('Car Rental 21')).toBeTruthy()
    expect(screen.queryByText('စာရင်း တစ်ချို့ တင်မရသေးပါ — အဟောင်းပြထားသည်')).toBeNull()
    expect(screen.queryByText(/ထပ်တင်ရန်/)).toBeNull()
    await waitFor(() => expect(screen.getByText('173 / 173')).toBeTruthy(), { timeout: 20000 })
    expect(screen.getByText('Car Rental 173')).toBeTruthy()
  }, 30000)

  it('(D) no "Maximum update depth exceeded" console.error while a cold-cache chain runs to the end', async () => {
    mockDB.rows = makeRows(173)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const client = makeClient()
      client.setQueryData(['category-map'], ALL_CATS)
      renderDirectory(client)
      await openCarRental(173)
      await waitFor(() => expect(screen.getByText('173 / 173')).toBeTruthy(), { timeout: 20000 })
      expect(screen.getByText('Car Rental 173')).toBeTruthy()
      const depthErrors = errSpy.mock.calls.filter(c => String(c[0]).includes('Maximum update depth'))
      expect(depthErrors).toEqual([])
    } finally {
      errSpy.mockRestore()
    }
  }, 30000)

  it('(E) same-page refetch: a stale empty cached page 0 followed by a fresh refetch object for the SAME page still advances the chain', async () => {
    mockDB.rows = makeRows(173)
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    // The persisted cache holds a stale EMPTY page 0 (the v9.31 (B)
    // case: { rows: [], total: 0 }); the refetch returns the real
    // page 0 as a NEW object for the same page. The apply effect
    // must apply that new object (dedupe is by identity, not page),
    // and the chain must then advance past it by itself.
    client.setQueryData(listingsKey(0), { rows: [], total: 0, page: 0, filterKey: FILTER_KEY })
    renderDirectory(client)
    await openCarRental(173)

    await waitFor(() => expect(screen.getByText('173 / 173')).toBeTruthy(), { timeout: 20000 })
    expect(screen.getByText('Car Rental 173')).toBeTruthy()
    expect(screen.getByText('Car Rental 1')).toBeTruthy()
    // One request per page, in order — the refetched page 0 counted
    // once, and no page was skipped or fetched twice.
    expect(mockDB.listingsCalls).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  }, 30000)
})
