// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LangProvider } from '../contexts/LangContext'
import DirectoryPage from './DirectoryPage'

// v9.37: CONTINUOUS background loading — the chain. These tests
// prove the mechanism itself, distinct from the behaviour tests in
// DirectoryPage935.test.jsx:
//   1. the chain advances with NO scroll and NO sentinel trigger —
//      and an IntersectionObserver is never even constructed;
//   2. a short last page stops the chain exactly at total;
//   3. the full 2,186-row "အားလုံး" list fetches every page exactly
//      once (no double-fetch, no over-fetch).
//
// The chain must FAIL on the old (9.35/9.36) code: there the next
// page only arrived when the sentinel fired, and jsdom has no
// IntersectionObserver — so without any trigger the list would sit
// at 20 / 173 forever.
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

beforeEach(() => {
  cleanup()
  ioConstructed.length = 0
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

describe('v9.37 chain mechanism', () => {
  it('(1) chain advances with NO scroll and NO sentinel trigger — and an IntersectionObserver is never constructed', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    await openCarRental(173)

    // No trigger of any kind in this test: no scroll event, no
    // sentinel intersection, no tap. The chain alone must move the
    // list from 20 to 40 — and then to the end.
    await waitFor(() => expect(screen.getByText('40 / 173')).toBeTruthy(), { timeout: 5000 })
    expect(ioConstructed.length).toBe(0)
    expect(screen.queryByTestId('load-more-sentinel')).toBeNull()
    await waitFor(() => expect(screen.getByText('173 / 173')).toBeTruthy(), { timeout: 20000 })
    // Still no observer after the whole chain ran.
    expect(ioConstructed.length).toBe(0)
    expect(screen.getByText('Car Rental 173')).toBeTruthy()
  }, 30000)

  it('(2) short last page: chain stops exactly at total — 45 rows, 3 requests, no over-fetch', async () => {
    mockDB.rows = makeRows(45)
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    await openCarRental(45)

    // Pages 0 (20) + 1 (20) + 2 (5, short) — the short last page
    // ends the chain even though a naive loaded<total check would
    // keep going only while rows remain; here loaded == total at
    // the same moment, and no page 3 is ever requested.
    await waitFor(() => expect(screen.getByText('45 / 45')).toBeTruthy(), { timeout: 20000 })
    expect(screen.getByText('Car Rental 45')).toBeTruthy()
    expect(mockDB.listingsCalls).toEqual([0, 1, 2])
    await act(async () => { await new Promise(r => setTimeout(r, 300)) })
    expect(mockDB.listingsCalls).toEqual([0, 1, 2])
    expect(screen.getByText('100%').closest('[data-testid="load-ring"]')).toBeTruthy()
  }, 30000)

  it('(3) no double-fetch on the full 2,186-row "အားလုံး" list — each of the 110 pages requested exactly once', async () => {
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
    await waitFor(() => expect(screen.getByText('20 / 2186')).toBeTruthy(), { timeout: 10000 })

    // The uniform chain runs the whole 2,186-row list by itself —
    // 110 sequential pages, no cap, no scroll, no tap. Wait on the
    // request log, NOT on a DOM text scan: polling getByText over a
    // 2,186-card DOM every 50ms starves the chain's own renders.
    // NOTE (test-env speed, not an app stall): each page append
    // re-renders the whole growing list in jsdom, so the tail pages
    // cost ~1s each here — the chain reached 104/110 inside the
    // first 120s and finishes with a longer budget. A real browser
    // renders the same cards natively, far faster.
    await waitFor(() => expect(mockDB.listingsCalls.length).toBe(110), { timeout: 300000, interval: 500 })
    await waitFor(() => expect(screen.getByText('2186 / 2186')).toBeTruthy(), { timeout: 30000 })
    expect(screen.getByText('100%').closest('[data-testid="load-ring"]')).toBeTruthy()
    expect(screen.getByText('Car Rental 2186')).toBeTruthy()
    // Exactly one request per page, in order, 0..109 — no page
    // fetched twice, no page skipped, no over-fetch past the end.
    const expected = Array.from({ length: 110 }, (_, i) => i)
    expect(mockDB.listingsCalls).toEqual(expected)
    await act(async () => { await new Promise(r => setTimeout(r, 300)) })
    expect(mockDB.listingsCalls).toEqual(expected)
  }, 360000)
})
