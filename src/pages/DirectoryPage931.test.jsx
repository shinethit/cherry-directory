// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LangProvider } from '../contexts/LangContext'
import DirectoryPage from './DirectoryPage'

// v9.31 (B): "173 count but 0 results". The listings apply effect used
// to dedupe by filterKey+page (appliedKeyRef): a background refetch
// delivering a NEW listingsData object for the SAME key was dropped,
// so a stale cached {rows: [], total: 0} entry stayed on screen as
// "0 ရလဒ်" + EmptyState while the picker badge (fresh count call)
// showed 173. The fix dedupes by data identity (appliedDataRef) and
// adds refetchOnMount: 'always' to the listings query, so even a
// FRESH (<5 min) cached 0 entry is refetched on mount.
//
// The bug strand, reproduced here end to end: Car Rental category ->
// tap "အားလုံး" (direct listings) -> the seeded 0 entry applies ->
// the background refetch returns 20 rows / 173 total -> the page
// must show "173 ရလဒ်" and the 20 cards, never "0 ရလဒ်".

const CAR_ID = '5f8eeb71-fbb2-435f-9e61-847bafc70ba5'
const CAR_CAT = { id: CAR_ID, icon: '🚗', name: 'Car Rental', name_mm: 'ကားငှားခြင်း', listing_count: 173, parent_id: null }
// One real subcategory, so the picker (not a direct jump) renders:
// handleCategorySelect writes ?cat=<CAR_ID>, and directNavigate's
// child-count query must see a child — a 0 there would jump straight
// to the parent's direct listings and the picker would never show.
const SUB_CAT = { id: 'sub1', icon: '🚗', name: 'Car Hire', name_mm: 'ကားငှားဝန်ဆောင်မှု', listing_count: 173, parent_id: CAR_ID }
const LISTINGS_KEY = ['listings', 'directory', CAR_ID, CAR_ID, 'All', false, '', 'rating', 0, false]
const FILTER_KEY = `${CAR_ID}|${CAR_ID}|All|false||rating`

const { mockFetchCategories, mockDB } = vi.hoisted(() => ({
  mockFetchCategories: vi.fn(),
  mockDB: { cats: [], pages: {}, total: 0 },
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
      const state = { table, head: false, eqs: {}, inVals: null, rangeStart: 0, single: false }
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
            // checkDirectListings: direct listings under Car Rental = 173;
            // subcategory counts (via .in('category_id', [sub1])) = 173;
            // directNavigate's child-count for Car Rental = 1 child.
            let count = 0
            if (state.table === 'listings' && (state.eqs.category_id === CAR_ID || (state.inVals || []).includes(SUB_CAT.id))) count = 173
            else if (state.table === 'categories' && state.eqs.parent_id === CAR_ID) count = 1
            resolve({ count, data: null, error: null })
            return
          }
          if (state.table === 'categories') {
            if (state.eqs.parent_id) resolve({ data: mockDB.cats.filter(c => c.parent_id === state.eqs.parent_id), error: null })
            else resolve({ data: mockDB.cats, error: null })
          } else if (state.table === 'listings') {
            // v9.32: the listings query now filters with .in('category_id',
            // ids) — return the mock pages only when the requested id set
            // covers this test's category (direct "အားလုံး" path, or the
            // subcategory); any other id set is a different view: 0 rows.
            const allowed = state.inVals || (state.eqs.category_id ? [state.eqs.category_id] : null)
            if (allowed && !allowed.includes(CAR_ID) && !allowed.includes(SUB_CAT.id)) {
              resolve({ data: [], count: 0, error: null })
            } else {
              const page = Math.floor(state.rangeStart / 20)
              resolve({ data: mockDB.pages[page] || [], count: mockDB.total, error: null })
            }
          } else {
            resolve({ data: [], error: null })
          }
        },
      }
      return b
    },
  },
}))

const makeRows = (page, n) => Array.from({ length: n }, (_, i) => ({
  id: `car-${page}-${i}`,
  name: `Car ${page}-${i}`,
  name_mm: `ကားဆိုင် p${page}n${i}`,
  city: 'Taunggyi',
  rating_avg: 4.5,
  rating_count: 2,
  category: { name: 'Car Rental', name_mm: 'ကားငှားခြင်း', icon: '🚗' },
}))

// Same defaults as the app's QueryClient (src/lib/queryClient.js):
// staleTime 5 min, gcTime 24 h.
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

// Plant the persisted cached 0 entry for the exact listings key, aged
// `ageMs` (setQueryData's updatedAt option — the persisted cache
// restores dataUpdatedAt from storage the same way).
function seedZeroEntry(client, ageMs) {
  client.setQueryData(
    LISTINGS_KEY,
    { rows: [], total: 0, page: 0, filterKey: FILTER_KEY },
    { updatedAt: Date.now() - ageMs },
  )
}

// Tap Car Rental, then tap the "အားလုံး" direct-listings button.
async function tapDirectListings() {
  await waitFor(() => expect(screen.getByText('ကားငှားခြင်း')).toBeTruthy(), { timeout: 5000 })
  fireEvent.click(screen.getByText('ကားငှားခြင်း'))
  await waitFor(
    () => expect(screen.getByRole('button', { name: /အားလုံး/ })).toBeTruthy(),
    { timeout: 5000 },
  )
  // The picker badges are the fresh count calls — 173 on the direct
  // button and 173 on the subcategory, like the live report.
  expect(screen.getAllByText('173 လုပ်ငန်း')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: /အားလုံး/ }))
}

async function expectRefetchApplied(rows) {
  await waitFor(() => expect(screen.getByText('173 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
  for (const row of rows) {
    expect(screen.getByText(row.name_mm)).toBeTruthy()
  }
  expect(screen.queryByText('လုပ်ငန်း မတွေ့ပါ')).toBeNull()
  expect(screen.queryByText('0 ရလဒ်')).toBeNull()
}

beforeEach(() => {
  cleanup()
  mockFetchCategories.mockReset()
  mockFetchCategories.mockResolvedValue([CAR_CAT])
  mockDB.cats = [CAR_CAT, SUB_CAT]
  mockDB.pages = {}
  mockDB.total = 0
})

afterEach(() => { cleanup() })

describe('v9.31 (B) stale cached 0 must not swallow the refetch', () => {
  it('stale (>5 min) cached 0 entry: background refetch applies, 173 results show', async () => {
    const client = makeClient()
    const page0 = makeRows(0, 20)
    mockDB.pages = { 0: page0 }
    mockDB.total = 173
    seedZeroEntry(client, 6 * 60 * 1000)
    renderDirectory(client)

    await tapDirectListings()
    await expectRefetchApplied(page0)
  }, 20000)

  it('fresh (<5 min) cached 0 entry: refetchOnMount still refetches, 173 results show', async () => {
    const client = makeClient()
    const page0 = makeRows(0, 20)
    mockDB.pages = { 0: page0 }
    mockDB.total = 173
    seedZeroEntry(client, 60 * 1000)
    renderDirectory(client)

    await tapDirectListings()
    await expectRefetchApplied(page0)
  }, 20000)

  it('Load more still appends: page-1 delivery applies on top of page 0', async () => {
    const client = makeClient()
    const page0 = makeRows(0, 20)
    const page1 = makeRows(1, 20)
    mockDB.pages = { 0: page0, 1: page1 }
    mockDB.total = 173
    renderDirectory(client)

    await tapDirectListings()
    await expectRefetchApplied(page0)

    fireEvent.click(screen.getByRole('button', { name: /ထပ်တင်ရန်/ }))
    await waitFor(() => expect(screen.getByText(page1[0].name_mm)).toBeTruthy(), { timeout: 5000 })
    // Page-0 rows stay (append, not replace) and the count stays 173.
    for (const row of page0) {
      expect(screen.getByText(row.name_mm)).toBeTruthy()
    }
    for (const row of page1) {
      expect(screen.getByText(row.name_mm)).toBeTruthy()
    }
    expect(screen.getByText('173 ရလဒ်')).toBeTruthy()
  }, 20000)
})
