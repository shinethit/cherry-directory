// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LangProvider } from '../contexts/LangContext'
import DirectoryPage from './DirectoryPage'

// v9.25 regen #2 (slow-network): categories must not flash skeletons on
// a background refetch, a failed refetch with cached data must show the
// small amber strip (not the error card), the ?cat= deep link must
// resolve from the cached ['categories'] entry offline, and the listings
// query must keep previous data across filter/page changes.

const { mockFetchCategories, mockDB } = vi.hoisted(() => ({
  mockFetchCategories: vi.fn(),
  mockDB: {
    cats: [],
    listings: [],
    singleCategoryCalls: [],
    // v9.25 regen #5: true offline — every supabase call RESOLVES
    // with { data: null, error }, the way supabase-js fails on a
    // dead connection (it does NOT throw). The old mock rejected,
    // which exercised only the catch path production never takes
    // for a network failure.
    offline: false,
  },
}))

vi.mock('../lib/prefetch', () => ({ fetchCategories: mockFetchCategories }))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoggedIn: false }),
}))

vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ cities: ['Taunggyi', 'Kalaw'] }),
}))

// Chainable supabase builder. Records .single() calls so the deep-link
// test can prove the target category was NOT fetched directly.
vi.mock('../lib/supabase', () => ({
  supabase: {
    from(table) {
      const state = { table, head: false, selectCols: '', eqs: {}, single: false }
      const b = {
        select(cols, opts) { state.selectCols = cols; if (opts?.head) state.head = true; return b },
        eq(k, v) { state.eqs[k] = v; return b },
        is() { return b },
        order() { return b },
        range() { return b },
        limit() { return b },
        in() { return b },
        or() { return b },
        abortSignal() { return b },
        single() { state.single = true; return b },
        then(resolve, reject) {
          if (mockDB.offline) {
            // v9.25 regen #5: production supabase-js does NOT throw on
            // a dead connection — it RESOLVES with { data: null,
            // error }. A mock that rejects exercises only the catch
            // path production never takes for a network failure.
            resolve({ data: null, count: null, error: new Error('TypeError: fetch failed') })
            return
          }
          if (state.single) {
            mockDB.singleCategoryCalls.push({ table: state.table })
            // .single() returns ONE row, not the whole table — the
            // direct-navigate fetch path reads target.parent_id off it.
            if (state.table === 'categories') {
              resolve({ data: mockDB.cats.find(c => String(c.id) === String(state.eqs.id)) || null, error: null })
            } else {
              resolve({ data: null, error: null })
            }
            return
          }
          if (state.head) {
            // v9.25 regen #3: a head-count on categories must return
            // the REAL child count — the fix counts children with a
            // real query instead of counting in the top-level-only
            // cache, so a stub count of 0 would hide the bug.
            if (state.table === 'categories') {
              resolve({ count: mockDB.cats.filter(c => c.parent_id === state.eqs.parent_id).length, data: null, error: null })
            } else {
              resolve({ count: state.table === 'listings' ? 1 : 0, data: null, error: null })
            }
            return
          }
          if (state.table === 'categories') {
            if (state.eqs.parent_id) resolve({ data: mockDB.cats.filter(c => c.parent_id === state.eqs.parent_id), error: null })
            else resolve({ data: mockDB.cats, error: null })
          } else if (state.table === 'listings') {
            resolve({ data: mockDB.listings, count: mockDB.listings.length, error: null })
          } else {
            resolve({ data: [], error: null })
          }
        },
      }
      return b
    },
  },
}))

const CATS = [
  { id: 'c1', icon: '🍜', name: 'Food', name_mm: 'အစား', listing_count: 3, parent_id: null },
  { id: 'c2', icon: '🍜', name: 'Noodles', name_mm: 'ခေါက်ဆွဲ', listing_count: 2, parent_id: 'c1' },
]

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })
}

function renderDirectory(client, initialEntries = ['/directory']) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <LangProvider>
          <DirectoryPage />
        </LangProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  // No auto-cleanup in this repo (vitest globals off) — unmount the
  // previous test's tree, and reset mock implementations (clearAllMocks
  // only clears call history, so test 1's pending-promise impl would
  // leak into test 2).
  cleanup()
  mockFetchCategories.mockReset()
  mockDB.cats = [...CATS]
  mockDB.listings = []
  mockDB.singleCategoryCalls = []
  mockDB.offline = false
})

afterEach(() => {
  cleanup()
})

describe('v9.25 slow: categories background refetch', () => {
  it('does not flash skeletons while refetching with cached data, and shows the amber strip (not the error card) when the refetch fails', async () => {
    const client = makeClient()
    // Production-realistic: ['categories'] holds top-level rows only.
    client.setQueryData(['categories'], [CATS[0]])
    let rejectFetch
    mockFetchCategories.mockImplementation(
      () => new Promise((_resolve, reject) => { rejectFetch = reject })
    )

    const { container } = renderDirectory(client)

    // Cached categories render immediately…
    await waitFor(() => expect(screen.getByText('အစား')).toBeTruthy())
    // …while the background refetch is still in flight: no skeletons.
    expect(mockFetchCategories).toHaveBeenCalled()
    expect(container.querySelectorAll('.shimmer').length).toBe(0)
    expect(screen.queryByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeNull()

    // The refetch fails (slow network) — old list stays, amber strip appears.
    await act(async () => { rejectFetch(new Error('offline')) })
    await waitFor(() =>
      expect(screen.getByText('အဟောင်းပြထားသည် — အင်တာနက် နှေးနေသည်')).toBeTruthy()
    )
    expect(screen.getByText('အစား')).toBeTruthy()
    expect(screen.queryByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeNull()
    expect(container.querySelectorAll('.shimmer').length).toBe(0)
    // The strip's retry button is the only "ပြန်ကြိုးစားမည်" on screen.
    expect(screen.getAllByText('ပြန်ကြိုးစားမည်').length).toBe(1)
  })

  it('still shows the full error card when there are no cached categories at all', async () => {
    const client = makeClient()
    mockFetchCategories.mockRejectedValue(new Error('offline'))

    renderDirectory(client)

    await waitFor(() =>
      expect(screen.getByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeTruthy()
    )
    expect(screen.queryByText('အဟောင်းပြထားသည် — အင်တာနက် နှေးနေသည်')).toBeNull()
    expect(screen.queryByText('အစား')).toBeNull()
  })
})

describe('v9.25 slow: ?cat= deep link resolves from cache', () => {
  it('resolves a cached subcategory offline without fetching the target directly, and shows the cached listings', async () => {
    const client = makeClient()
    // v9.25 regen #4: production-realistic seeding — ['categories']
    // holds TOP-LEVEL rows only (a subcategory inside it is a cache
    // state production never produces); the parent link comes from
    // the ['category-map'] entry instead.
    client.setQueryData(['categories'], [CATS[0]])
    client.setQueryData(['category-map'], CATS)
    client.setQueryData(['listings', 'directory', 'c2', 'All', false, '', 'rating', 0, false],
      { rows: [
        { id: 'l1', name: 'Shop 1', name_mm: 'ဆိုင် ၁', city: 'Taunggyi', rating_avg: 4.5, rating_count: 2, category: { name: 'Noodles', name_mm: 'ခေါက်ဆွဲ', icon: '🍜' } },
      ], total: 1, page: 0, filterKey: 'c2|All|false||rating' })
    mockFetchCategories.mockRejectedValue(new Error('offline'))
    mockDB.offline = true
    mockDB.listings = [
      { id: 'l1', name: 'Shop 1', name_mm: 'ဆိုင် ၁', city: 'Taunggyi', rating_avg: 4.5, rating_count: 2, category: { name: 'Noodles', name_mm: 'ခေါက်ဆွဲ', icon: '🍜' } },
    ]

    renderDirectory(client, ['/directory?cat=c2'])

    // The listings level renders from cache — no spinner, no direct fetch.
    await waitFor(() => expect(screen.getByText('ဆိုင် ၁')).toBeTruthy(), { timeout: 5000 })
    expect(screen.queryByText('ရှာဖွေနေသည်...')).toBeNull()
    expect(mockDB.singleCategoryCalls.filter(c => c.table === 'categories').length).toBe(0)
  })
})

describe('v9.25 regen #3: ?cat= deep-link root causes', () => {
  const TOP_ONLY = [CATS[0]]
  const LISTING = { id: 'l1', name: 'Shop 1', name_mm: 'ဆိုင် ၁', city: 'Taunggyi', rating_avg: 4.5, rating_count: 2, category: { name: 'Noodles', name_mm: 'ခေါက်ဆွဲ', icon: '🍜' } }

  it('(a) warm cache (top-level only) + ?cat=<subcategory> resolves the parent from cache and renders listings', async () => {
    const client = makeClient()
    // Production-realistic warm cache: fetchCategories returns
    // top-level rows ONLY, so the subcategory id is a cache miss
    // and directNavigate takes the fetch path.
    client.setQueryData(['categories'], TOP_ONLY)
    // The categories query never resolves here — the gate must fire
    // on the warm cache while local `categories` state is still the
    // empty first-render closure (root cause 1: the old fetch path
    // read the parent from that empty state and stranded the page
    // on the top-level picker).
    mockFetchCategories.mockImplementation(() => new Promise(() => {}))
    mockDB.listings = [LISTING]

    renderDirectory(client, ['/directory?cat=c2'])

    await waitFor(() => expect(screen.getByText('ဆိုင် ၁')).toBeTruthy(), { timeout: 5000 })
    // The listings level renders only when BOTH are set: without
    // selectedCategory the top-level picker wins, without
    // selectedSubcategory the subcategory picker wins.
    expect(screen.queryByText(/အမျိုးအစားများ/)).toBeNull()
    expect(screen.queryByText('အမျိုးအစားခွဲကို ရွေးပါ')).toBeNull()
    expect(screen.queryByText('ရှာဖွေနေသည်...')).toBeNull()
    // The fetch path ran once for the uncached subcategory id.
    expect(mockDB.singleCategoryCalls.filter(c => c.table === 'categories').length).toBe(1)
  })

  it('(b) warm cache (top-level only) + ?cat=<top-level> shows the subcategory picker WITH children', async () => {
    const client = makeClient()
    client.setQueryData(['categories'], TOP_ONLY)
    mockFetchCategories.mockResolvedValue(TOP_ONLY)
    mockDB.listings = []

    renderDirectory(client, ['/directory?cat=c1'])

    // Subcategory picker level — the child is listed, not a direct
    // jump to the parent's own (empty) listings (root cause 2: the
    // old code counted children in the top-level-only cache, always
    // 0, and every top-level ?cat= rendered "0 results").
    await waitFor(() => expect(screen.getByText('အမျိုးအစားခွဲကို ရွေးပါ')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('ခေါက်ဆွဲ')).toBeTruthy()
    expect(screen.queryByText(/အမျိုးအစားများ/)).toBeNull()
    expect(screen.queryByText('ရှာဖွေနေသည်...')).toBeNull()
    expect(screen.queryByText('လုပ်ငန်းမရှိသေး')).toBeNull()
  })

  it('(c) cold cache + ?cat=<subcategory> still resolves and renders listings', async () => {
    const client = makeClient()
    mockFetchCategories.mockResolvedValue(TOP_ONLY)
    mockDB.listings = [LISTING]

    renderDirectory(client, ['/directory?cat=c2'])

    await waitFor(() => expect(screen.getByText('ဆိုင် ၁')).toBeTruthy(), { timeout: 5000 })
    expect(screen.queryByText(/အမျိုးအစားများ/)).toBeNull()
    expect(screen.queryByText('ရှာဖွေနေသည်...')).toBeNull()
  })

  // v9.25 regen #4: (d) REPLACED — the old version seeded CATS (a
  // subcategory inside ['categories']), a cache state production
  // NEVER produces: fetchCategories returns top-level rows only, so
  // the cache-first path hit and the test passed with zero direct
  // fetches while the real browser path failed. Production-realistic
  // seeding is mandatory now: ['categories'] top-level ONLY, the
  // parent link from ['category-map'], listings from their own key.
  // v9.25 regen #5: (d) is scenario (iii) — the offline subcategory
  // deep link — now under the resolve-with-error mock: the listings
  // queryFn already threw on `error`, so the cached listings stay;
  // this test proves the map-first path needs no network at all.
  it('(d) offline + warm cache (top-level only + category-map) + ?cat=<subcategory> renders cached listings with zero direct category fetches', async () => {
    const client = makeClient()
    client.setQueryData(['categories'], TOP_ONLY)
    client.setQueryData(['category-map'], CATS)
    // Warm listings cache for the exact query key the page reads.
    client.setQueryData(['listings', 'directory', 'c2', 'All', false, '', 'rating', 0, false],
      { rows: [LISTING], total: 1, page: 0, filterKey: 'c2|All|false||rating' })
    // Offline: every fetch fails — the deep link must still resolve
    // from the map + cache, with no direct category fetch.
    mockFetchCategories.mockRejectedValue(new Error('offline'))
    mockDB.offline = true
    mockDB.listings = [LISTING]

    renderDirectory(client, ['/directory?cat=c2'])

    await waitFor(() => expect(screen.getByText('ဆိုင် ၁')).toBeTruthy(), { timeout: 5000 })
    // The listings level renders only when BOTH are set: without
    // selectedCategory the top-level picker wins, without
    // selectedSubcategory the subcategory picker wins.
    expect(screen.queryByText(/အမျိုးအစားများ/)).toBeNull()
    expect(screen.queryByText('အမျိုးအစားခွဲကို ရွေးပါ')).toBeNull()
    expect(screen.queryByText('ရှာဖွေနေသည်...')).toBeNull()
    expect(mockDB.singleCategoryCalls.filter(c => c.table === 'categories').length).toBe(0)
  })

  // v9.25 regen #5: (e) is scenario (v) — the offline TOP-LEVEL deep
  // link. Under the old rejecting mock this passed via the catch
  // path; under the resolve-with-error mock production actually
  // takes, the unfixed loadSubcategories ran its success path with
  // data null and wiped the map-seeded children (EmptyState, no
  // amber strip). The fix throws on `error` so the catch seeds the
  // picker from the map AND sets the error state (amber strip).
  it('(e) offline + warm cache (top-level only + category-map) + ?cat=<top-level> shows the subcategory picker WITH children', async () => {
    const client = makeClient()
    client.setQueryData(['categories'], TOP_ONLY)
    client.setQueryData(['category-map'], CATS)
    mockFetchCategories.mockRejectedValue(new Error('offline'))
    mockDB.offline = true
    mockDB.listings = []

    renderDirectory(client, ['/directory?cat=c1'])

    // Subcategory picker level — the child comes from the map, not
    // the network: offline, loadSubcategories fails and the map
    // fallback seeds the picker (counts unknown, badge '–').
    await waitFor(() => expect(screen.getByText('အမျိုးအစားခွဲကို ရွေးပါ')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('ခေါက်ဆွဲ')).toBeTruthy()
    expect(screen.queryByText(/အမျိုးအစားများ/)).toBeNull()
    expect(screen.queryByText('ရှာဖွေနေသည်...')).toBeNull()
    expect(screen.queryByText('လုပ်ငန်းမရှိသေး')).toBeNull()
    // The failed load is an error state, not a silent empty: the
    // amber strip shows above the map-seeded children.
    expect(screen.getByText('အဟောင်းပြထားသည် — အင်တာနက် နှေးနေသည်')).toBeTruthy()
    expect(mockDB.singleCategoryCalls.filter(c => c.table === 'categories').length).toBe(0)
  })

  // v9.25 regen #5: (g) — same offline top-level link, but NO
  // category-map entry, so there is nothing to seed the picker
  // with. The failed load must surface the error card, never the
  // "လုပ်ငန်းမရှိသေး" EmptyState (which would claim the category is
  // genuinely empty). Against the unfixed code the resolve-with-error
  // load ran the success path, set no error, and rendered the
  // EmptyState. The head-count in the cache-first branch must also
  // stay "unknown" on a count error — never 0 (direct listings).
  it('(g) offline + warm cache but NO category-map + ?cat=<top-level> shows the error card, not the EmptyState', async () => {
    const client = makeClient()
    client.setQueryData(['categories'], TOP_ONLY)
    mockFetchCategories.mockRejectedValue(new Error('offline'))
    mockDB.offline = true
    mockDB.listings = []

    renderDirectory(client, ['/directory?cat=c1'])

    await waitFor(() => expect(screen.getByText('အမျိုးအစားခွဲကို ရွေးပါ')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('Data တင်မရသေးပါ — ပြန်ကြိုးစားမည်')).toBeTruthy()
    expect(screen.queryByText('လုပ်ငန်းမရှိသေး')).toBeNull()
    expect(screen.queryByText('ခေါက်ဆွဲ')).toBeNull()
    expect(screen.queryByText(/အမျိုးအစားများ/)).toBeNull()
    expect(screen.queryByText('ရှာဖွေနေသည်...')).toBeNull()
  })

  // v9.25 regen #5: (h) — tap navigation hits the same trap, not
  // just ?cat=: offline, cached categories, tap the top-level
  // category, and the picker must still show its map-seeded
  // children with the amber strip (not the EmptyState).
  it('(h) offline + warm cache + tap top-level category shows the subcategory picker WITH children', async () => {
    const client = makeClient()
    client.setQueryData(['categories'], TOP_ONLY)
    client.setQueryData(['category-map'], CATS)
    mockFetchCategories.mockRejectedValue(new Error('offline'))
    mockDB.offline = true
    mockDB.listings = []

    renderDirectory(client, ['/directory'])

    await waitFor(() => expect(screen.getByText('အစား')).toBeTruthy(), { timeout: 5000 })
    await act(async () => { fireEvent.click(screen.getByText('အစား')) })

    await waitFor(() => expect(screen.getByText('အမျိုးအစားခွဲကို ရွေးပါ')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('ခေါက်ဆွဲ')).toBeTruthy()
    expect(screen.queryByText('လုပ်ငန်းမရှိသေး')).toBeNull()
    expect(screen.getByText('အဟောင်းပြထားသည် — အင်တာနက် နှေးနေသည်')).toBeTruthy()
  })

  it('(f) offline + warm cache but NO category-map + ?cat=<subcategory> stays unresolved gracefully (top-level picker, no crash, no listings hallucinated)', async () => {
    const client = makeClient()
    client.setQueryData(['categories'], TOP_ONLY)
    // No ['category-map'] entry at all — the map-first path must
    // fall back to the fetch path, which fails offline, and the
    // link stays unresolved instead of guessing.
    mockFetchCategories.mockRejectedValue(new Error('offline'))
    mockDB.offline = true
    mockDB.listings = [LISTING]

    renderDirectory(client, ['/directory?cat=c2'])

    await waitFor(() => expect(screen.getByText(/အမျိုးအစားများ/)).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('အစား')).toBeTruthy()
    expect(screen.queryByText('ဆိုင် ၁')).toBeNull()
    expect(screen.queryByText('ရှာဖွေနေသည်...')).toBeNull()
  })
})

describe('v9.25 slow: listings keepPreviousData (source)', () => {
  it('the listings query keeps previous data across filter/page changes and the deep link reads the query cache first', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'DirectoryPage.jsx'), 'utf8'
    )
    expect(src).toContain('placeholderData: keepPreviousData')
    expect(src).toContain('keepPreviousData')
    expect(src).toContain("queryClient.getQueryData(['categories'])")
    expect(src).toContain('const cachedTarget')
    // Skeletons only on first load, never on a background refetch.
    expect(src).toContain('setCategoryLoading(categoryQueryLoading && !categoriesData)')
    expect(src).not.toContain('setCategoryLoading(categoryQueryLoading || categoryQueryFetching)')
    // Error card only when the list is empty; otherwise the amber strip.
    expect(src).toContain('categoryError && categories.length === 0')
    expect(src).toContain('subcategoryError && subcategories.length === 0 && !hasDirectListings')
    // Stale pill while a background listings refetch is in flight.
    expect(src).toContain('အသစ်ရယူနေသည်…')
    expect(src).toContain('listingsQueryFetching')
    // v9.25 regen #3: the fetch-path parent lookup must read the
    // cached ['categories'] entry (populated), not only the possibly
    // empty `categories` state closure; and children must never be
    // counted in the top-level-only cache (always 0).
    expect(src).toContain('cachedCats.find(c => c.id === target.parent_id)')
    expect(src).not.toContain('cachedCats.filter(c => c.parent_id === cachedTarget.id)')
    // v9.25 regen #4: the map-first path resolves a subcategory id
    // offline (the ['categories'] cache holds top-level rows only),
    // and the subcategory loader falls back to the map when its
    // fetch fails — no test may seed a subcategory inside
    // ['categories'] to fake this (see test (d) above).
    expect(src).toContain("queryClient.getQueryData(['category-map'])")
    expect(src).toContain('const mapTarget')
    expect(src).toContain('mapRows.find(c => c.id === mapTarget.parent_id)')
    // v9.25 regen #5: the resolve-with-error trap — supabase-js
    // resolves with { error } on a dead connection, it never throws,
    // so every data path that destructured only { data } / { count }
    // silently ran its success path with null data. The mock models
    // this (offline branch resolves with error), and the loaders
    // must throw / bail on `error`:
    // loadSubcategories main fetch + per-sub counts + both
    // directNavigate head-counts, fetchCategories' counts, and
    // HomePage loadFavorites (which must keep the last good list).
    expect(src).toContain('if (error) throw error')
    expect(src).toContain('if (countError) throw countError')
    expect(src).toContain('if (!countError && (count || 0) === 0)')
    expect(src).toContain('const treeCats = treeError ? [] : (allCats || [])')
    const prefetchSrc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'prefetch.js'), 'utf8'
    )
    expect(prefetchSrc).toContain("queryClient.setQueryData(['category-map']")
    expect(prefetchSrc).toContain('if (countError) throw countError')
    const homeSrc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'HomePage.jsx'), 'utf8'
    )
    // HomePage useQuery fetchers already throw on error
    // (throwIfError / explicit l.error / p.error checks) — the only
    // resolve-with-error traps there were loadFavorites' two
    // fetches, which must return without wiping the last good list.
    expect(homeSrc).toContain('throwIfError')
    expect(homeSrc).toContain('if (bmarksError) return')
    expect(homeSrc).toContain('if (listingsError) return')
    // The test file's own offline mock must model production:
    // resolve with { data: null, error }, never reject.
    const testSrc = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'DirectoryPage925slow.test.jsx'), 'utf8'
    )
    expect(testSrc).toContain("resolve({ data: null, count: null, error:")
    // (No negative assertion on the old rejecting mock line here:
    // the literal would appear in this very assertion and defeat
    // itself — the behavioural tests (d)/(e)/(g)/(h) above are the
    // proof the mock resolves instead of rejecting.)
  })
})
