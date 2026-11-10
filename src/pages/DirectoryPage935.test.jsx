// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LangProvider } from '../contexts/LangContext'
import DirectoryPage, { groupListingsByCity } from './DirectoryPage'

// v9.37: CONTINUOUS background loading — no scroll, no tap, no
// sentinel. After each page lands the chain immediately fetches the
// next one until loaded == total, so the ring climbs by itself
// (20/173 → 40/173 → … → 173/173) and ends at 100% — the same 100%
// the Home tile shows. The 9.35 sentinel only advanced on scroll,
// so a list opened and left alone sat at 20/173 forever while the
// tile outside said 100% (user report 2026-11-10, second report of
// the same stall).
//
// The old no-eager-fetch-all test ("a 2,186-row list fetches page 0
// only until the sentinel fires") is WRONG BY DESIGN under the
// chain and is REPLACED below: the chain advances to the next page
// with NO scroll and NO sentinel trigger, and stops exactly at
// total (no over-fetch — request count == ceil(total / 20)).
//
// v9.36: the percentage now lives INSIDE the ring (innerText, e.g.
// "12%") and the beside label is "20 / 173" with no "%" in it.
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

// v9.37: no IntersectionObserver stub any more — the component must
// not need one. (A dedicated test in DirectoryPage937.test.jsx
// asserts the observer is never constructed.)

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
              // Hang only the FIRST fetch of this page: a later
              // fetch of the same page number (e.g. after a filter
              // change starts a new list) resolves normally. The
              // first fetch's resolver is kept so the test can
              // release it on purpose.
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

async function openCarRental() {
  await waitFor(() => expect(screen.getByText('ကားငှားဝန်ဆောင်မှု')).toBeTruthy(), { timeout: 5000 })
  fireEvent.click(screen.getByText('ကားငှားဝန်ဆောင်မှု'))
  await waitFor(() => expect(screen.getByText('ကားငှားဝန်ဆောင်မှု')).toBeTruthy(), { timeout: 5000 })
  // The subcategory picker lists the subcategory; tap it to reach
  // the listings level. (The category row and the subcategory row
  // share the name — getAllByText, tap the last one = picker row.)
  const rows = screen.getAllByText('ကားငှားဝန်ဆောင်မှု')
  fireEvent.click(rows[rows.length - 1])
  await waitFor(() => expect(screen.getByText('173 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
}

beforeEach(() => {
  cleanup()
  mockFetchCategories.mockReset()
  mockFetchCategories.mockResolvedValue([CAT])
  mockDB.cats = [...ALL_CATS]
  mockDB.rows = makeRows(173)
  mockDB.failPages = {}
  mockDB.hangPages = new Set()
  mockDB.pendingResolves = {}
  mockDB.listingsCalls = []
})

afterEach(() => { cleanup() })

describe('v9.37 continuous background loading — no scroll, no tap', () => {
  it('(a) the next page appends by itself — no tap, no scroll, no "ထပ်တင်ရန်" button on the normal path', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    // Hang pages 1 AND 2 so the 20 / 173 starting state — and then
    // the 40 / 173 state — are deterministic: without the hangs the
    // chain would already be past them.
    mockDB.hangPages.add(1)
    mockDB.hangPages.add(2)
    await openCarRental()
    // The chain starts page 1 by itself — wait until it is actually
    // hung in flight before asserting the frozen 20 / 173 state.
    await waitFor(() => expect(mockDB.listingsCalls).toContain(1), { timeout: 5000 })

    // Page 0: 20 rows, ring at 20 / 173.
    expect(screen.getByText('Car Rental 1')).toBeTruthy()
    expect(screen.queryByText('Car Rental 21')).toBeNull()
    expect(screen.getByText('20 / 173')).toBeTruthy()
    // v9.36: the % is INSIDE the ring; the beside label carries no "%".
    expect(screen.getByText('12%').closest('[data-testid="load-ring"]')).toBeTruthy()
    expect(screen.getByText('20 / 173').textContent).not.toContain('%')
    expect(screen.queryByText(/ထပ်တင်ရန်/)).toBeNull()
    // v9.37: the sentinel element is gone — nothing to scroll to.
    expect(screen.queryByTestId('load-more-sentinel')).toBeNull()

    // Release page 1: it lands with NO trigger of any kind.
    await act(async () => { mockDB.pendingResolves[1]() })
    await waitFor(() => expect(screen.getByText('40 / 173')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('23%').closest('[data-testid="load-ring"]')).toBeTruthy()
    expect(screen.getByText('Car Rental 21')).toBeTruthy()
    expect(screen.getByText('Car Rental 40')).toBeTruthy()
    // Still no tap button — the page arrived by itself.
    expect(screen.queryByText(/ထပ်တင်ရန်/)).toBeNull()
  }, 20000)

  it('(b) the ring fills with real counts and STAYS VISIBLE at 100% with the final count', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    await openCarRental()

    // The chain runs the whole list by itself — no sentinel trigger,
    // no tap. Wait for the end: 173 / 173.
    await waitFor(() => expect(screen.getByText('173 / 173')).toBeTruthy(), { timeout: 20000 })
    // 100% — the ring AND the final count REMAIN visible (user
    // correction 2026-11-10: it must not disappear). Full ring:
    // dashoffset 0, aria-valuenow 100.
    expect(screen.queryByTestId('load-ring')).toBeTruthy()
    expect(screen.getByText('173 / 173')).toBeTruthy()
    expect(screen.getByText('100%').closest('[data-testid="load-ring"]')).toBeTruthy()
    expect(screen.getByText('Car Rental 173')).toBeTruthy()
    await waitFor(() => {
      const arc = screen.getByTestId('load-ring-arc')
      expect(parseFloat(arc.getAttribute('stroke-dashoffset'))).toBe(0)
    }, { timeout: 5000 })
    expect(screen.getByTestId('load-ring').getAttribute('aria-valuenow')).toBe('100')
    expect(screen.queryByText(/ထပ်တင်ရန်/)).toBeNull()
    // Exactly 9 requests (ceil(173 / 20)) — the chain stopped at
    // total, it did not over-fetch.
    expect(mockDB.listingsCalls).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  }, 30000)

  it('(c) changing the filter aborts the in-flight page and resets progress to the new filter', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    // Page 1 hangs in flight (the chain starts it by itself as soon
    // as page 0 lands — no trigger needed).
    mockDB.hangPages.add(1)
    await openCarRental()
    expect(screen.getByText('20 / 173')).toBeTruthy()
    await waitFor(() => expect(mockDB.listingsCalls).toContain(1), { timeout: 5000 })

    // …then the user switches city to Kalaw: progress resets (the
    // old 20 / 173 is gone) and the new filter's page 0 loads.
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'Kalaw' } })
    await waitFor(() => expect(screen.getByText('20 / 58')).toBeTruthy(), { timeout: 5000 })
    expect(screen.queryByText('20 / 173')).toBeNull()

    // The new filter's own chain runs to the end by itself: 58 / 58.
    await waitFor(() => expect(screen.getByText('58 / 58')).toBeTruthy(), { timeout: 10000 })

    // The hung old-filter page 1 finally resolves — it must NOT land
    // on the new filter's list (page guard / key change drops it).
    await act(async () => { mockDB.pendingResolves[1]() })
    await waitFor(() => expect(screen.getByText('58 / 58')).toBeTruthy(), { timeout: 5000 })
    // Still Kalaw rows only: no Taunggyi row from the stale page.
    expect(screen.queryByText('Car Rental 1')).toBeNull() // row 1 is Taunggyi
    expect(screen.getByText('Car Rental 2')).toBeTruthy() // row 2 is Kalaw
  }, 20000)

  it('(d) a failed background page keeps the loaded rows and offers retry — and does not auto-retry in a loop', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    // Page 1 fails once; the chain fetches it by itself.
    mockDB.failPages = { 1: 1 }
    await openCarRental()
    await waitFor(() => expect(screen.getByText('စာရင်း တစ်ချို့ တင်မရသေးပါ — အဟောင်းပြထားသည်')).toBeTruthy(), { timeout: 5000 })
    // Loaded rows stay; ring stays at the real 20 / 173.
    expect(screen.getByText('Car Rental 1')).toBeTruthy()
    expect(screen.getByText('20 / 173')).toBeTruthy()
    // The manual button survives ONLY as the retry control.
    expect(screen.getByText('ထပ်တင်ရန် (153 ကျန်)')).toBeTruthy()
    // The chain must not loop on the failing page: no further
    // request for page 1 while the strip is up (no trigger exists
    // any more — the chain itself is what must stay quiet).
    const callsBefore = mockDB.listingsCalls.filter(p => p === 1).length
    expect(callsBefore).toBe(1)
    await act(async () => { await new Promise(r => setTimeout(r, 300)) })
    expect(mockDB.listingsCalls.filter(p => p === 1).length).toBe(1)

    // Retry from the amber strip: the page lands, strip + button go,
    // and the chain RESUMES past the retried page by itself.
    fireEvent.click(screen.getByText('ပြန်ကြိုးစားမည်'))
    await waitFor(() => expect(screen.getByText('40 / 173')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('Car Rental 21')).toBeTruthy()
    expect(screen.queryByText('စာရင်း တစ်ချို့ တင်မရသေးပါ — အဟောင်းပြထားသည်')).toBeNull()
    expect(screen.queryByText(/ထပ်တင်ရန်/)).toBeNull()
    await waitFor(() => expect(screen.getByText('60 / 173')).toBeTruthy(), { timeout: 5000 })
  }, 20000)

  it('(e) town groups stay correct as pages append', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    // Hang pages 1 and 2 so the page-0 groups — and then the
    // pages-0+1 groups — are deterministic (otherwise the chain
    // would run on to 60 rows before the assertions land).
    mockDB.hangPages.add(1)
    mockDB.hangPages.add(2)
    await openCarRental()
    // Wait until page 1 is hung in flight (the chain starts it by
    // itself) so the page-0 groups below are deterministic.
    await waitFor(() => expect(mockDB.listingsCalls).toContain(1), { timeout: 5000 })

    const headings = () =>
      screen.getAllByRole('heading')
        .map(h => h.textContent.replace(/\s+/g, ' ').trim())
        .filter(t => /\(\d+\)$/.test(t))
    // Page 0 (rows 1–20, cities cycle Taunggyi/Kalaw/Heho):
    // Taunggyi 7, Kalaw 7, Heho 6. (Heho has no cityLabels entry, so
    // its heading renders the raw name 'Heho', not 'ဟဲဟိုး'.)
    expect(headings()).toEqual(['တောင်ကြီး (7)', 'ကလော (7)', 'Heho (6)'])
    await act(async () => { mockDB.pendingResolves[1]() })
    await waitFor(() => expect(screen.getByText('40 / 173')).toBeTruthy(), { timeout: 5000 })
    // Pages 0+1: Taunggyi 14, Kalaw 13, Heho 13 — groups grow in place.
    // (Tie at 13 sorts by raw city code A-Z: 'Heho' before 'Kalaw'.)
    expect(headings()).toEqual(['တောင်ကြီး (14)', 'Heho (13)', 'ကလော (13)'])
    expect(screen.getByText('Car Rental 40')).toBeTruthy()
  }, 20000)

  it('chain replaces no-eager-fetch-all: a 173-row list advances with NO scroll/sentinel trigger and stops exactly at total', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    await openCarRental()

    // No scroll, no tap, no sentinel trigger anywhere in this test —
    // the chain alone must carry the list to the end.
    await waitFor(() => expect(screen.getByText('173 / 173')).toBeTruthy(), { timeout: 20000 })
    expect(screen.getByText('Car Rental 173')).toBeTruthy()
    // Stops exactly at total: 9 requests, one per page, no
    // over-fetch — and quiet afterwards.
    expect(mockDB.listingsCalls).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    await act(async () => { await new Promise(r => setTimeout(r, 300)) })
    expect(mockDB.listingsCalls).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  }, 30000)
})

describe('v9.35 groupListingsByCity still holds (regression pin)', () => {
  it('groups loaded rows only, most first', () => {
    const L = (id, city) => ({ id, name: id, name_mm: id, city })
    expect(groupListingsByCity([L('a', 'Taunggyi'), L('b', 'Kalaw'), L('c', 'Taunggyi')]).map(g => [g.city, g.items.length]))
      .toEqual([['Taunggyi', 2], ['Kalaw', 1]])
  })
})
