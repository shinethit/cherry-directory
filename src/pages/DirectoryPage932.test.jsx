// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LangProvider } from '../contexts/LangContext'
import DirectoryPage from './DirectoryPage'
import { collectDescendantIds, mergeTreeRows, resolveListingCategoryIds } from '../lib/categoryTree'

// v9.32: the picker badge counts a subcategory + ALL descendants, but
// the listings query filtered with .eq('category_id', subId) — direct
// only. Delivery Service showed a badge of 5 (1 direct + 4 under its
// child Custom Clearance) and a list of 1. The fix resolves the
// subcategory + all descendants (shared with the badge counts) and
// queries .in('category_id', ids), with the id set baked into the
// listings query key so a tree arriving late refetches with the full
// set. The direct ("အားလုံး") path stays direct-only.
//
// Live ids (verified 2026-11-08 — Custom Clearance is …4fb7…, NOT
// …4df7… as an earlier brief had it) and live names.
const POST_ID = '8aa3312f-d14a-4df0-8e7c-de578cc5ec1d'
const DELIVERY_ID = '9f6de725-cacd-4107-ac90-9c4158f76679'
const CUSTOM_ID = '9ef4a201-42dc-4fb7-9f09-29639de19080' // LIVE id — NOT 4df7
const LEAF_ID = 'leaf-express-1' // invented leaf child of Post & Delivery, 2 direct listings
const POST_CAT = { id: POST_ID, icon: '📮', name: 'Post & Delivery', name_mm: 'စာတိုက်နှင့် ပို့ဆောင်ရေး', listing_count: 6, parent_id: null }
const DELIVERY_SUB = { id: DELIVERY_ID, icon: '🚚', name: 'Delivery Service', name_mm: 'အိမ်တိုင်ရာရောက် ပို့ဆောင်ရေး', listing_count: 5, parent_id: POST_ID }
const LEAF_SUB = { id: LEAF_ID, icon: '📦', name: 'Express Delivery', name_mm: 'အမြန်ပို့ဆောင်ရေး', listing_count: 2, parent_id: POST_ID }
const CUSTOM_SUB = { id: CUSTOM_ID, icon: '🛃', name: 'Custom Clearance', name_mm: 'အကောက်ခွန်ရှင်းလင်းရေး', listing_count: 4, parent_id: DELIVERY_ID }
const ALL_CATS = [POST_CAT, DELIVERY_SUB, LEAF_SUB, CUSTOM_SUB]
// Minimal id/parent_id-only tree rows, as loadSubcategories' tree
// fetch returns them.
const TREE_ROWS = ALL_CATS.map(c => ({ id: c.id, parent_id: c.parent_id }))

const CHERRY = 'Cherry Land Delivery Taunggyi'
const CUSTOM_NAMES = [
  'Pale Nadi Services Co., Ltd.',
  'Ruby Lion Agency',
  'Silver Moon Agency',
  'T & T Export Import Service Agency',
]
const LEAF_NAMES = ['Leaf Express 1', 'Leaf Express 2']
// DEVIATION from the investigator's brief (b): the brief says the
// direct ("အားလုံး") tap shows "1 ရလဒ် — only Cherry Land". That
// cannot be: Cherry Land is filed under Delivery Service
// (category_id DELIVERY_ID), while the "အားလုံး" button under Post &
// Delivery queries the parent's own direct listings (category_id
// POST_ID) — a row Cherry Land can never match, by design. The
// direct path therefore needs its own real direct row to prove it
// stays direct-only, so the mock carries one: Taunggyi Post Office,
// filed directly under Post & Delivery. Test (b) asserts that row
// (and that Cherry Land + all 4 Custom Clearance rows are absent),
// which is exactly the direct-only behaviour the brief meant to pin.
const POST_OFFICE = 'Taunggyi Post Office'

function makeRow(id, name, categoryId) {
  return {
    id,
    name,
    name_mm: name,
    city: 'Taunggyi',
    rating_avg: 4.5,
    rating_count: 2,
    category_id: categoryId,
    category: { name: 'Post & Delivery', name_mm: 'စာတိုက်နှင့် ပို့ဆောင်ရေး', icon: '📮' },
  }
}
const ALL_ROWS = [
  makeRow('row-cherry', CHERRY, DELIVERY_ID),
  ...CUSTOM_NAMES.map((n, i) => makeRow(`row-custom-${i}`, n, CUSTOM_ID)),
  ...LEAF_NAMES.map((n, i) => makeRow(`row-leaf-${i}`, n, LEAF_ID)),
  makeRow('row-post-office', POST_OFFICE, POST_ID),
]

const { mockFetchCategories, mockDB } = vi.hoisted(() => ({
  mockFetchCategories: vi.fn(),
  mockDB: { cats: [], rows: [], failTree: false, failCounts: false, lastListingsInVals: null },
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
            // Subcategory counts (.in) and the direct count (.eq) —
            // counted from the mock rows, so the picker badges are
            // real counts, not stubs.
            if (state.table === 'listings' && state.inVals) {
              if (mockDB.failCounts) { resolve({ count: null, data: null, error: new Error('count failed') }); return }
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
            // The tree fetch (id/parent_id only) is the one the late-
            // tree / offline tests fail on purpose.
            if (state.selectCols === 'id, parent_id') {
              if (mockDB.failTree) { resolve({ data: null, error: new Error('tree failed') }); return }
              resolve({ data: mockDB.cats, error: null })
              return
            }
            if (state.eqs.parent_id) resolve({ data: mockDB.cats.filter(c => c.parent_id === state.eqs.parent_id), error: null })
            else resolve({ data: mockDB.cats, error: null })
          } else if (state.table === 'listings') {
            // Category-aware: only rows whose category_id is in the
            // request's .in() set (fall back to the .eq value when
            // there is no .in), sliced to the requested page.
            const allowed = state.inVals || (state.eqs.category_id ? [state.eqs.category_id] : null)
            mockDB.lastListingsInVals = state.inVals ? [...state.inVals] : allowed
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

// Same defaults as the app's QueryClient (src/lib/queryClient.js):
// staleTime 5 min, gcTime 24 h.
function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 5 * 60 * 1000, gcTime: 24 * 60 * 60 * 1000 },
    },
  })
}

function renderDirectory(client, entry = '/directory') {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <LangProvider>
          <DirectoryPage />
        </LangProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// Tap Post & Delivery on the category list, wait for the picker.
async function tapCategory() {
  await waitFor(() => expect(screen.getByText('စာတိုက်နှင့် ပို့ဆောင်ရေး')).toBeTruthy(), { timeout: 5000 })
  fireEvent.click(screen.getByText('စာတိုက်နှင့် ပို့ဆောင်ရေး'))
  await waitFor(
    () => expect(screen.getByText('အိမ်တိုင်ရာရောက် ပို့ဆောင်ရေး')).toBeTruthy(),
    { timeout: 5000 },
  )
}

function expectNoEmptyState() {
  expect(screen.queryByText('လုပ်ငန်း မတွေ့ပါ')).toBeNull()
  expect(screen.queryByText('0 ရလဒ်')).toBeNull()
}

async function expectFiveResults() {
  await waitFor(() => expect(screen.getByText('5 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
  expect(screen.getByText(CHERRY)).toBeTruthy()
  for (const name of CUSTOM_NAMES) {
    expect(screen.getByText(name)).toBeTruthy()
  }
  expectNoEmptyState()
}

async function expectTwoResults() {
  await waitFor(() => expect(screen.getByText('2 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
  for (const name of LEAF_NAMES) {
    expect(screen.getByText(name)).toBeTruthy()
  }
  expect(screen.queryByText(CHERRY)).toBeNull()
  expectNoEmptyState()
}

beforeEach(() => {
  cleanup()
  mockFetchCategories.mockReset()
  mockFetchCategories.mockResolvedValue([POST_CAT])
  mockDB.cats = [...ALL_CATS]
  mockDB.rows = [...ALL_ROWS]
  mockDB.failTree = false
  mockDB.failCounts = false
  mockDB.lastListingsInVals = null
})

afterEach(() => { cleanup() })

describe('v9.32 subcategory listings include descendants', () => {
  it('(a) subcategory with child listings (reported case): badge 5 at the parent; drill shows Custom Clearance 4 + direct 1', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)

    await tapCategory()
    // Picker badges are the real counts: Delivery Service 5 (1 direct
    // + 4 Custom Clearance), leaf 2, "အားလုံး" 1 direct under the parent.
    expect(screen.getByText('5 လုပ်ငန်း')).toBeTruthy()
    expect(screen.getByText('2 လုပ်ငန်း')).toBeTruthy()
    expect(screen.getByText('1 လုပ်ငန်း')).toBeTruthy()

    // v9.40: Delivery Service HAS a child, so tapping it drills to
    // its children picker instead of its listings (the old tap opened
    // the 5 listings directly). The drilled level shows Custom
    // Clearance (4) and the direct row (1).
    fireEvent.click(screen.getByText('အိမ်တိုင်ရာရောက် ပို့ဆောင်ရေး'))
    await waitFor(() => expect(screen.getByText('4 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    expect(screen.queryByText(/ရလဒ်/)).toBeNull()

    // Custom Clearance (leaf) shows only its 4 listings.
    fireEvent.click(screen.getByText('အကောက်ခွန်ရှင်းလင်းရေး'))
    await waitFor(() => expect(screen.getByText('4 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
    for (const name of CUSTOM_NAMES) {
      expect(screen.getByText(name)).toBeTruthy()
    }
    expect(screen.queryByText(CHERRY)).toBeNull()
    expectNoEmptyState()
    expect(mockDB.lastListingsInVals).toEqual([CUSTOM_ID])

    // Back to the drilled level, then the direct ("အားလုံး") row
    // shows only Delivery Service's own direct listing.
    fireEvent.click(screen.getByText('နောက်သို့'))
    await waitFor(() => expect(screen.getByText('4 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    fireEvent.click(screen.getByRole('button', { name: /အားလုံး/ }))
    await waitFor(() => expect(screen.getByText('1 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText(CHERRY)).toBeTruthy()
    for (const name of CUSTOM_NAMES) {
      expect(screen.queryByText(name)).toBeNull()
    }
    expectNoEmptyState()
    expect(mockDB.lastListingsInVals).toEqual([DELIVERY_ID])
  }, 20000)

  it('(b) direct path unchanged: "အားလုံး" shows only the parent\'s own direct listings', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)

    await tapCategory()
    fireEvent.click(screen.getByRole('button', { name: /အားလုံး/ }))
    await waitFor(() => expect(screen.getByText('1 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText(POST_OFFICE)).toBeTruthy()
    // Direct-only: neither the subcategory's own row nor any
    // descendant row leaks in.
    expect(screen.queryByText(CHERRY)).toBeNull()
    for (const name of CUSTOM_NAMES) {
      expect(screen.queryByText(name)).toBeNull()
    }
    expectNoEmptyState()
    expect(mockDB.lastListingsInVals).toEqual([POST_ID])
  }, 20000)

  it('(c) leaf subcategory: badge 2, list 2', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)

    await tapCategory()
    expect(screen.getByText('2 လုပ်ငန်း')).toBeTruthy()
    fireEvent.click(screen.getByText('အမြန်ပို့ဆောင်ရေး'))
    await waitFor(() => expect(screen.getByText('2 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
    for (const name of LEAF_NAMES) {
      expect(screen.getByText(name)).toBeTruthy()
    }
    expect(screen.queryByText(CHERRY)).toBeNull()
    expectNoEmptyState()
    expect(mockDB.lastListingsInVals).toEqual([LEAF_ID])
  }, 20000)
})

describe('v9.32 subcategory-path strand: a cached 0 entry must not swallow the refetch', () => {
  // v9.40: retargeted at the LEAF sub (Express Delivery) — tapping a
  // parent sub (Delivery Service) now drills to its children picker
  // instead of opening its listings, so the strand scenario lives on
  // the leaf tap. The descendant-inclusive 5-listing case is pinned
  // by the direct ?cat= link in test (e) below.
  const LEAF_LISTINGS_KEY = ['listings', 'directory', LEAF_ID, LEAF_ID, 'All', false, '', 'rating', 0, false]
  const LEAF_FILTER_KEY = `${LEAF_ID}|${LEAF_ID}|All|false||rating`
  function seedZeroEntry(client, ageMs) {
    client.setQueryData(
      LEAF_LISTINGS_KEY,
      { rows: [], total: 0, page: 0, filterKey: LEAF_FILTER_KEY },
      { updatedAt: Date.now() - ageMs },
    )
  }

  it.each([
    ['stale (>5 min) cached 0 entry', 6 * 60 * 1000],
    ['fresh (<5 min) cached 0 entry', 60 * 1000],
  ])('%s: background refetch applies, 2 results show', async (_label, ageMs) => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    client.setQueryData(['category-tree'], TREE_ROWS)
    seedZeroEntry(client, ageMs)
    renderDirectory(client)

    await tapCategory()
    fireEvent.click(screen.getByText('အမြန်ပို့ဆောင်ရေး'))
    await expectTwoResults()
    expect(mockDB.lastListingsInVals).toEqual([LEAF_ID])
  }, 20000)
})

describe('v9.32 tree arrives late / offline degradation', () => {
  it('(e) tree arrives late: direct-only first, then the full 5 with no re-tap', async () => {
    const client = makeClient()
    // No map, no tree, and both the tree fetch and the count calls
    // fail — the picker shows '–' badges and the first listings
    // fetch can only be direct-only.
    // v9.40: reached via a direct ?cat= link now — tapping Delivery
    // Service in the picker drills to its children instead of opening
    // its listings, so the late-tree upgrade (the only path that still
    // opens a parent sub's listings) is pinned on the deep link.
    mockDB.failTree = true
    mockDB.failCounts = true
    renderDirectory(client, '/directory?cat=' + DELIVERY_ID)

    await waitFor(() => expect(screen.getByText('1 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText(CHERRY)).toBeTruthy()
    for (const name of CUSTOM_NAMES) {
      expect(screen.queryByText(name)).toBeNull()
    }
    expect(mockDB.lastListingsInVals).toEqual([DELIVERY_ID])

    // The tree arrives (as loadSubcategories' write would deliver
    // it): the key changes, the query refetches, all 5 show.
    await act(async () => {
      client.setQueryData(['category-tree'], TREE_ROWS)
    })
    await expectFiveResults()
    expect(mockDB.lastListingsInVals).toEqual([DELIVERY_ID, CUSTOM_ID])
  }, 20000)

  it('(f) offline degradation: no map/tree, tree fetch fails — the drill still works, direct row shows the 1 direct result, no crash', async () => {
    const client = makeClient()
    mockDB.failTree = true
    mockDB.failCounts = true
    renderDirectory(client)

    await tapCategory()
    expect(screen.getAllByText('–').length).toBe(2)
    // v9.40: tapping Delivery Service drills (the child count
    // succeeds even though the tree fetch fails) — the drilled picker
    // degrades to '–' badges + the retry strip, and its direct row
    // still shows the 1 direct listing.
    fireEvent.click(screen.getByText('အိမ်တိုင်ရာရောက် ပို့ဆောင်ရေး'))
    await waitFor(() => expect(screen.getByText('အကောက်ခွန်ရှင်းလင်းရေး')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getAllByText('–').length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: /အားလုံး/ }))
    await waitFor(() => expect(screen.getByText('1 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText(CHERRY)).toBeTruthy()
    for (const name of CUSTOM_NAMES) {
      expect(screen.queryByText(name)).toBeNull()
    }
    expectNoEmptyState()
    expect(mockDB.lastListingsInVals).toEqual([DELIVERY_ID])
  }, 20000)
})

describe('v9.32 resolveListingCategoryIds / collectDescendantIds (pure)', () => {
  it('empty tree -> [subId] (direct-only degradation, never a crash)', () => {
    expect(resolveListingCategoryIds({ subId: DELIVERY_ID, isDirect: false, isFeatured: false, mapRows: [], treeRows: [] }))
      .toEqual([DELIVERY_ID])
  })

  it('map-only tree -> [subId, child]', () => {
    expect(resolveListingCategoryIds({ subId: DELIVERY_ID, isDirect: false, isFeatured: false, mapRows: ALL_CATS, treeRows: [] }))
      .toEqual([DELIVERY_ID, CUSTOM_ID])
  })

  it('3-level chain -> root-first BFS order', () => {
    const chain = [
      { id: 'a', parent_id: null },
      { id: 'b', parent_id: 'a' },
      { id: 'b2', parent_id: 'a' },
      { id: 'c', parent_id: 'b' },
      { id: 'd', parent_id: 'c' },
    ]
    expect(collectDescendantIds(chain, 'a')).toEqual(['a', 'b', 'b2', 'c', 'd'])
    expect(resolveListingCategoryIds({ subId: 'a', isDirect: false, isFeatured: false, mapRows: chain, treeRows: [] }))
      .toEqual(['a', 'b', 'b2', 'c', 'd'])
  })

  it('isDirect / isFeatured -> [subId] even with a full tree', () => {
    const args = { subId: DELIVERY_ID, mapRows: ALL_CATS, treeRows: TREE_ROWS }
    expect(resolveListingCategoryIds({ ...args, isDirect: true, isFeatured: false })).toEqual([DELIVERY_ID])
    expect(resolveListingCategoryIds({ ...args, isDirect: false, isFeatured: true })).toEqual([DELIVERY_ID])
    expect(resolveListingCategoryIds({ subId: null, isDirect: false, isFeatured: false, mapRows: ALL_CATS, treeRows: TREE_ROWS }))
      .toEqual([null])
  })

  it('union dedupes map+tree overlaps, map rows win on conflict', () => {
    const treeOnly = [{ id: DELIVERY_ID, parent_id: POST_ID }, { id: CUSTOM_ID, parent_id: DELIVERY_ID }]
    const mapOnly = [{ id: CUSTOM_ID, parent_id: DELIVERY_ID, name: 'Custom Clearance', name_mm: 'အကောက်ခွန်ရှင်းလင်းရေး', icon: '🛃' }]
    const merged = mergeTreeRows(mapOnly, treeOnly)
    expect(merged.map(c => c.id)).toEqual([DELIVERY_ID, CUSTOM_ID])
    expect(merged.find(c => c.id === CUSTOM_ID).name).toBe('Custom Clearance')
    expect(resolveListingCategoryIds({ subId: DELIVERY_ID, isDirect: false, isFeatured: false, mapRows: mapOnly, treeRows: treeOnly }))
      .toEqual([DELIVERY_ID, CUSTOM_ID])
  })
})
