// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LangProvider } from '../contexts/LangContext'
import DirectoryPage, { groupListingsByCity } from './DirectoryPage'

// v9.35 (A): Directory list auto background loading — no tap.
// User report 2026-11-10 (iOS, Car Rental "ကားငှားဝန်ဆောင်မှု", 173
// total): the list showed "ထပ်တင်ရန် (112 ကျန်)" and only grew 20
// rows per tap. Now pages load themselves as the user scrolls
// (IntersectionObserver sentinel + 800px prefetch rootMargin), the
// shared LoadRing shows the real X / total · Y% at the top of the
// list area and STAYS visible at 100% (user correction 2026-11-10:
// "why would it disappear?"), a failed background page keeps the
// loaded rows with an amber strip + retry, and the manual button
// survives ONLY as that retry control. Sequential pages only — a
// 2,186-row "အားလုံး" list still fetches page 0 only until the
// sentinel fires.
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

// Controllable IntersectionObserver: every instance's callback is
// recorded; triggerSentinel() fires all of them (the component's own
// guards — fetching / failed / pageRef — make sure one trigger can
// only advance one page).
const ioCallbacks = []
class MockIntersectionObserver {
  constructor(cb) { this.cb = cb; ioCallbacks.push(cb) }
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
function triggerSentinel() {
  act(() => { for (const cb of [...ioCallbacks]) cb([{ isIntersecting: true }]) })
}

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
  ioCallbacks.length = 0
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

describe('v9.35 (A) auto background loading — no tap', () => {
  it('(a) the next page appends when the sentinel intersects — no tap, no "ထပ်တင်ရန်" button on the normal path', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    await openCarRental()

    // Page 0: 20 rows, ring at 20 / 173.
    expect(screen.getByText('Car Rental 1')).toBeTruthy()
    expect(screen.queryByText('Car Rental 21')).toBeNull()
    expect(screen.getByText('20 / 173 · 12%')).toBeTruthy()
    expect(screen.queryByText(/ထပ်တင်ရန်/)).toBeNull()
    expect(screen.getByTestId('load-more-sentinel')).toBeTruthy()

    triggerSentinel()
    await waitFor(() => expect(screen.getByText('40 / 173 · 23%')).toBeTruthy(), { timeout: 5000 })
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

    const ring = screen.getByTestId('load-ring')
    expect(ring.getAttribute('aria-valuenow')).toBe('12')
    // The arc starts empty and sweeps to the real fill (animated on
    // load): after settling, its dashoffset is > 0 at 12%.
    await waitFor(() => {
      const arc = screen.getByTestId('load-ring-arc')
      expect(parseFloat(arc.getAttribute('stroke-dashoffset'))).toBeGreaterThan(0)
    }, { timeout: 5000 })

    // Drive all 9 pages (20, 40, …, 160, 173) via the sentinel only.
    const expected = ['40 / 173 · 23%', '60 / 173 · 35%', '80 / 173 · 46%', '100 / 173 · 58%', '120 / 173 · 69%', '140 / 173 · 81%', '160 / 173 · 92%', '173 / 173 · 100%']
    for (const text of expected) {
      triggerSentinel()
      await waitFor(() => expect(screen.getByText(text)).toBeTruthy(), { timeout: 5000 })
    }
    // 100% — the ring AND the final count REMAIN visible (user
    // correction 2026-11-10: it must not disappear). Full ring:
    // dashoffset 0, aria-valuenow 100.
    expect(screen.queryByTestId('load-ring')).toBeTruthy()
    expect(screen.getByText('173 / 173 · 100%')).toBeTruthy()
    expect(screen.getByText('Car Rental 173')).toBeTruthy()
    await waitFor(() => {
      const arc = screen.getByTestId('load-ring-arc')
      expect(parseFloat(arc.getAttribute('stroke-dashoffset'))).toBe(0)
    }, { timeout: 5000 })
    expect(screen.getByTestId('load-ring').getAttribute('aria-valuenow')).toBe('100')
    expect(screen.queryByText(/ထပ်တင်ရန်/)).toBeNull()
  }, 30000)

  it('(c) changing the filter aborts the in-flight page and resets progress to the new filter', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    await openCarRental()
    expect(screen.getByText('20 / 173 · 12%')).toBeTruthy()

    // Page 1 hangs in flight…
    mockDB.hangPages.add(1)
    triggerSentinel()
    await waitFor(() => expect(mockDB.listingsCalls).toContain(1), { timeout: 5000 })

    // …then the user switches city to Kalaw: progress resets (the
    // old 20 / 173 is gone) and the new filter's page 0 loads.
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'Kalaw' } })
    await waitFor(() => expect(screen.getByText('20 / 58 · 34%')).toBeTruthy(), { timeout: 5000 })
    expect(screen.queryByText('20 / 173 · 12%')).toBeNull()

    // The hung old-filter page 1 finally resolves — it must NOT land
    // on the new filter's list (page guard / key change drops it).
    await act(async () => { mockDB.pendingResolves[1]() })
    await waitFor(() => expect(screen.getByText('20 / 58 · 34%')).toBeTruthy(), { timeout: 5000 })
    // Still 20 Kalaw rows only: no Taunggyi row from the stale page,
    // and no append to 40.
    expect(screen.queryByText('Car Rental 1')).toBeNull() // row 1 is Taunggyi
    expect(screen.getByText('Car Rental 2')).toBeTruthy() // row 2 is Kalaw
    expect(screen.queryByText('40 / 58')).toBeNull()
  }, 20000)

  it('(d) a failed background page keeps the loaded rows and offers retry — and does not auto-retry in a loop', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    await openCarRental()
    expect(screen.getByText('20 / 173 · 12%')).toBeTruthy()

    mockDB.failPages = { 1: 1 }
    triggerSentinel()
    await waitFor(() => expect(screen.getByText('စာရင်း တစ်ချို့ တင်မရသေးပါ — အဟောင်းပြထားသည်')).toBeTruthy(), { timeout: 5000 })
    // Loaded rows stay; ring stays at the real 20 / 173.
    expect(screen.getByText('Car Rental 1')).toBeTruthy()
    expect(screen.getByText('20 / 173 · 12%')).toBeTruthy()
    // The manual button survives ONLY as the retry control.
    expect(screen.getByText('ထပ်တင်ရန် (153 ကျန်)')).toBeTruthy()
    // The sentinel must not loop on the failing page.
    const callsBefore = mockDB.listingsCalls.filter(p => p === 1).length
    triggerSentinel()
    await act(async () => { await new Promise(r => setTimeout(r, 200)) })
    expect(mockDB.listingsCalls.filter(p => p === 1).length).toBe(callsBefore)

    // Retry from the amber strip: the page lands, strip + button go.
    fireEvent.click(screen.getByText('ပြန်ကြိုးစားမည်'))
    await waitFor(() => expect(screen.getByText('40 / 173 · 23%')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('Car Rental 21')).toBeTruthy()
    expect(screen.queryByText('စာရင်း တစ်ချို့ တင်မရသေးပါ — အဟောင်းပြထားသည်')).toBeNull()
    expect(screen.queryByText(/ထပ်တင်ရန်/)).toBeNull()
  }, 20000)

  it('(e) town groups stay correct as pages append', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    await openCarRental()

    const headings = () =>
      screen.getAllByRole('heading')
        .map(h => h.textContent.replace(/\s+/g, ' ').trim())
        .filter(t => /\(\d+\)$/.test(t))
    // Page 0 (rows 1–20, cities cycle Taunggyi/Kalaw/Heho):
    // Taunggyi 7, Kalaw 7, Heho 6. (Heho has no cityLabels entry, so
    // its heading renders the raw name 'Heho', not 'ဟဲဟိုး'.)
    expect(headings()).toEqual(['တောင်ကြီး (7)', 'ကလော (7)', 'Heho (6)'])
    triggerSentinel()
    await waitFor(() => expect(screen.getByText('40 / 173 · 23%')).toBeTruthy(), { timeout: 5000 })
    // Pages 0+1: Taunggyi 14, Kalaw 13, Heho 13 — groups grow in place.
    // (Tie at 13 sorts by raw city code A-Z: 'Heho' before 'Kalaw'.)
    expect(headings()).toEqual(['တောင်ကြီး (14)', 'Heho (13)', 'ကလော (13)'])
    expect(screen.getByText('Car Rental 40')).toBeTruthy()
  }, 20000)

  it('no-eager-fetch-all: a 2,186-row "အားလုံး" list fetches page 0 only until the sentinel fires', async () => {
    // Direct ("အားလုံး") rows live under the PARENT category id, so
    // all 2,186 rows are filed there for this test.
    mockDB.rows = makeRows(2186).map(r => ({ ...r, category_id: CAT_ID }))
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    // The "အားလုံး" view is the direct path: open the category, tap
    // "အားလုံး" (direct listings under the parent).
    await waitFor(() => expect(screen.getByText('ကားငှားဝန်ဆောင်မှု')).toBeTruthy(), { timeout: 5000 })
    fireEvent.click(screen.getByText('ကားငှားဝန်ဆောင်မှု'))
    await waitFor(() => expect(screen.getByRole('button', { name: /အားလုံး/ })).toBeTruthy(), { timeout: 5000 })
    fireEvent.click(screen.getByRole('button', { name: /အားလုံး/ }))
    await waitFor(() => expect(screen.getByText('20 / 2186 · 1%')).toBeTruthy(), { timeout: 10000 })
    // Only page 0 was ever requested — no page 1, 2, … storm, and no
    // attempt to fetch/render thousands of cards at once.
    expect(mockDB.listingsCalls.length).toBeGreaterThanOrEqual(1)
    expect(mockDB.listingsCalls.every(p => p === 0)).toBe(true)
    // The sentinel is the only thing that may fetch page 1.
    triggerSentinel()
    await waitFor(() => expect(screen.getByText('40 / 2186 · 2%')).toBeTruthy(), { timeout: 10000 })
    expect(mockDB.listingsCalls).toContain(1)
  }, 20000)
})

describe('v9.35 groupListingsByCity still holds (regression pin)', () => {
  it('groups loaded rows only, most first', () => {
    const L = (id, city) => ({ id, name: id, name_mm: id, city })
    expect(groupListingsByCity([L('a', 'Taunggyi'), L('b', 'Kalaw'), L('c', 'Taunggyi')]).map(g => [g.city, g.items.length]))
      .toEqual([['Taunggyi', 2], ['Kalaw', 1]])
  })
})
