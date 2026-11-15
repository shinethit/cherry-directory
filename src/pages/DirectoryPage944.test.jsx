// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LangProvider } from '../contexts/LangContext'
import DirectoryPage from './DirectoryPage'

// v9.44 — STALE ROW AFTER A CATEGORY MOVE (promoted from the
// scratch repro DirectoryPage944repro.test.jsx, plus three extra
// cases). User report (2026-11-15 ~10:28 MMT): one Pharmacy listing
// was moved from Health's direct "အားလုံး" list (38 rows) to the
// "ဆေးဆိုင်" (Pharmacy) sub-category (2 rows). The picker counts
// updated at once (38 -> 37, 2 -> 3) but re-entering "အားလုံး" the
// shop was STILL listed, its Sub Cat already showing "ဆေးဆိုင်".
//
// Exact user path reproduced here, in-place, same component instance:
//   (a) warm QueryClient cache: list pages seeded + picker counts;
//   (b) render the list, assert X renders;
//   (c) simulate the move OUTSIDE DirectoryPage (Admin/Edit save):
//       the underlying mock data now has X under the new category, so
//       the server response excludes X from the old list and the
//       picker counts read the new numbers — exactly as the live DB
//       behaves;
//   (d) Back to the picker (goBack) and back into the SAME row
//       (handleDirectListings / handleSubcategorySelect) WITHOUT
//       unmounting — same filterKey, same query key;
//   (e) assert X is NO LONGER rendered in the old list.
//
// Cases:
//   (1) direct -> sub (the reported case): X leaves the direct list.
//   (2) sub -> direct (reverse): X leaves Pharmacy, appears direct.
//   (3) between subs: X leaves Pharmacy for Hospital, appears there.
//   (4) single-page self-heal (<= 20 rows): re-entry heals by itself
//       even on unmodified code (hydration never advances past
//       page 0), kept as a regression guard.
//
// NOTE: this file has NO filesystem-path comparisons at all, so the
// 9.19/9.25 backslash-path rule does not apply here.

const HEALTH_ID = 'health-id'
const PHARM_ID = 'pharmacy-id'
const HOSP_ID = 'hospital-id'
const HEALTH_CAT = { id: HEALTH_ID, icon: '🏥', name: 'Health', name_mm: 'ကျန်းမာရေး', parent_id: null }
const PHARM_SUB = { id: PHARM_ID, icon: '💊', name: 'Pharmacy', name_mm: 'ဆေးဆိုင်', parent_id: HEALTH_ID }
const HOSP_SUB = { id: HOSP_ID, icon: '🏨', name: 'Hospital', name_mm: 'ဆေးရုံ', parent_id: HEALTH_ID }
const ALL_CATS = [HEALTH_CAT, PHARM_SUB]

const SHOP_X_ID = 'shop-x'
const SHOP_X_NAME = 'X Pharmacy Test Shop'

const CITIES = ['Taunggyi', 'Kalaw', 'Heho']
function makeHealthRows() {
  const x = {
    id: SHOP_X_ID,
    name: SHOP_X_NAME,
    name_mm: SHOP_X_NAME,
    city: 'Taunggyi',
    rating_avg: 4.5,
    rating_count: 2,
    category_id: HEALTH_ID,
    category: { name: 'Health', name_mm: 'ကျန်းမာရေး', icon: '🏥' },
  }
  const others = Array.from({ length: 37 }, (_, i) => ({
    id: `health-row-${i}`,
    name: `Health Shop ${i + 1}`,
    name_mm: `Health Shop ${i + 1}`,
    city: CITIES[i % 3],
    rating_avg: 4.5,
    rating_count: 2,
    category_id: HEALTH_ID,
    category: { name: 'Health', name_mm: 'ကျန်းမာရေး', icon: '🏥' },
  }))
  return [x, ...others]
}
function makePharmRows() {
  return Array.from({ length: 2 }, (_, i) => ({
    id: `pharm-row-${i}`,
    name: `Pharmacy Shop ${i + 1}`,
    name_mm: `Pharmacy Shop ${i + 1}`,
    city: CITIES[i % 3],
    rating_avg: 4.5,
    rating_count: 2,
    category_id: PHARM_ID,
    category: { name: 'Pharmacy', name_mm: 'ဆေးဆိုင်', icon: '💊' },
  }))
}
function makeHospRows() {
  return [{
    id: 'hosp-row-0',
    name: 'Hospital Shop 1',
    name_mm: 'Hospital Shop 1',
    city: 'Taunggyi',
    rating_avg: 4.5,
    rating_count: 2,
    category_id: HOSP_ID,
    category: { name: 'Hospital', name_mm: 'ဆေးရုံ', icon: '🏨' },
  }]
}
function moveShopX(toId, toCategory) {
  const x = mockDB.rows.find(r => r.id === SHOP_X_ID)
  x.category_id = toId
  x.category = toCategory
}

const { mockFetchCategories, mockDB } = vi.hoisted(() => ({
  mockFetchCategories: vi.fn(),
  mockDB: { cats: [], rows: [], lastListingsInVals: null, listingsCalls: [] },
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
  return { ...actual, fetchCategories: mockFetchCategories }
})

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoggedIn: false, profile: null, isAdmin: false, isModerator: false, signOut: vi.fn() }),
}))

vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ cities: ['Taunggyi', 'Kalaw', 'Heho'], app_name: 'Cherry Directory', app_city: 'တောင်ကြီးမြို့' }),
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
            mockDB.lastListingsInVals = state.inVals ? [...state.inVals] : allowed
            let filtered = allowed ? mockDB.rows.filter(r => allowed.includes(r.category_id)) : [...mockDB.rows]
            if (state.eqs.city) filtered = filtered.filter(r => r.city === state.eqs.city)
            const page = Math.floor(state.rangeStart / 20)
            mockDB.listingsCalls.push(page)
            resolve({ data: filtered.slice(state.rangeStart, state.rangeStart + 20), count: filtered.length, error: null, page })
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

// Query key / filterKey for a single-id filter (direct-only and
// single sub-category lists share this shape: subId = idsKey).
function listingsKey(subId, idsKey, page) {
  return ['listings', 'directory', subId, idsKey, 'All', false, '', 'rating', page, false]
}
function filterKeyFor(subId, idsKey) {
  return `${subId}|${idsKey}|All|false||rating`
}

// Seed contiguous pages for one filter exactly as the persisted cache
// would hold them after a full visit.
function seedCache(client, subId, idsKey, rows, total) {
  const pages = Math.ceil(rows.length / 20)
  for (let p = 0; p < pages; p++) {
    client.setQueryData(listingsKey(subId, idsKey, p), {
      rows: rows.slice(p * 20, p * 20 + 20),
      total,
      page: p,
      filterKey: filterKeyFor(subId, idsKey),
    })
  }
}
function rowsFor(catId) {
  return mockDB.rows.filter(r => r.category_id === catId)
}

async function enterHealthPicker(directBadge = '38 လုပ်ငန်း', pharmBadge = '2 လုပ်ငန်း') {
  await waitFor(() => expect(screen.getByText('ကျန်းမာရေး')).toBeTruthy(), { timeout: 5000 })
  fireEvent.click(screen.getByText('ကျန်းမာရေး'))
  await waitFor(() => expect(screen.getByText(directBadge)).toBeTruthy(), { timeout: 5000 })
  if (pharmBadge) expect(screen.getByText(pharmBadge)).toBeTruthy()
}

// v9.44 rename: the direct row is labelled 'အမျိုးအစားခွဲ မရှိ'
// (was 'အားလုံး'); the selectors below use the new label, and the
// English label is 'No sub-category' (see Fixes944.test.jsx).
async function openDirectAll(expectedTotal) {
  fireEvent.click(screen.getByRole('button', { name: /အမျိုးအစားခွဲ မရှိ/ }))
  await waitFor(() => expect(screen.getByText(`${expectedTotal} ရလဒ်`)).toBeTruthy(), { timeout: 5000 })
}

async function openSub(nameMm, expectedTotal) {
  fireEvent.click(screen.getByText(nameMm))
  await waitFor(() => expect(screen.getByText(`${expectedTotal} ရလဒ်`)).toBeTruthy(), { timeout: 5000 })
}

// Post-move re-entry: do NOT wait for the fresh total here — on the
// buggy code the list settles on the STALE total and never reaches
// the fresh one, so waiting for it would fail before the ghost (X)
// assertion. Just wait for the list view, then let the caller's
// X / ring assertions do the checking.
async function openDirectNoWait() {
  fireEvent.click(screen.getByRole('button', { name: /အမျိုးအစားခွဲ မရှိ/ }))
  await waitFor(() => expect(screen.getByText(/ရလဒ်/)).toBeTruthy(), { timeout: 5000 })
}

async function openSubNoWait(nameMm) {
  fireEvent.click(screen.getByText(nameMm))
  await waitFor(() => expect(screen.getByText(/ရလဒ်/)).toBeTruthy(), { timeout: 5000 })
}

async function backToPicker() {
  fireEvent.click(screen.getByText('နောက်သို့'))
  await waitFor(() => expect(screen.getByText('ကျန်းမာရေး')).toBeTruthy(), { timeout: 5000 })
}

beforeEach(() => {
  cleanup()
  ioConstructed.length = 0
  mockFetchCategories.mockReset()
  // Top-level tile: descendant-inclusive Health total 40 (38 + 2).
  mockFetchCategories.mockResolvedValue([{ ...HEALTH_CAT, listing_count: 40 }])
  mockDB.cats = [...ALL_CATS]
  mockDB.rows = [...makeHealthRows(), ...makePharmRows()]
  mockDB.lastListingsInVals = null
  mockDB.listingsCalls = []
  window.localStorage.clear()
})

afterEach(() => { cleanup() })

describe('v9.44 — moved listing must leave the old list on re-entry', () => {
  it('(1) shop X moved Health-direct -> Pharmacy: re-entering the direct row must NOT show X', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    seedCache(client, HEALTH_ID, HEALTH_ID, rowsFor(HEALTH_ID), 38)
    expect(rowsFor(HEALTH_ID).length).toBe(38)
    renderDirectory(client)

    // (b) Open the direct list; X renders, 38/38, direct-only query.
    await enterHealthPicker()
    expect(screen.getByText('2 လုပ်ငန်း')).toBeTruthy()
    await openDirectAll(38)
    await waitFor(() => expect(screen.getByText('38 / 38')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText(SHOP_X_NAME)).toBeTruthy()
    expect(mockDB.lastListingsInVals).toEqual([HEALTH_ID])
    const callsBeforeMove = [...mockDB.listingsCalls]

    // (c) Simulate the move as the live DB would show it after the
    // Admin/Edit save: X now belongs to Pharmacy (category_id +
    // joined category), so the direct-list server response excludes
    // it and the picker counts read 37 / 3. The seeded QueryClient
    // cache is deliberately NOT touched — it still holds the old
    // 38-row pages, exactly like the phone's persisted cache.
    moveShopX(PHARM_ID, { name: 'Pharmacy', name_mm: 'ဆေးဆိုင်', icon: '💊' })
    expect(rowsFor(HEALTH_ID).length).toBe(37)
    expect(rowsFor(PHARM_ID).length).toBe(3)

    // (d) Back to the picker in-place, then into the SAME direct row.
    await backToPicker()
    // Picker counts re-read live: 38 -> 37 direct, 2 -> 3 Pharmacy.
    // (This is the part the user saw update correctly.)
    await waitFor(() => expect(screen.getByText('37 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('3 လုပ်ငန်း')).toBeTruthy()
    // Re-enter the SAME direct row. Do NOT pre-assert the fresh total
    // here: on the buggy code the list settles on the STALE total
    // ('38 / 38') and never reaches 37, so asserting 37 first would
    // fail before the X assertion — the X assertion is the repro.
    // Settle on whichever ring total the list lands on, then log the
    // fetches that fired, then assert X is gone.
    fireEvent.click(screen.getByRole('button', { name: /အမျိုးအစားခွဲ မရှိ/ }))
    await waitFor(() => {
      const settled = screen.queryByText('38 / 38') || screen.queryByText('37 / 37')
      expect(settled).toBeTruthy()
    }, { timeout: 5000 })
    // eslint-disable-next-line no-console
    console.log('[944repro] after re-entry settle: listingsCalls=', JSON.stringify(mockDB.listingsCalls),
      'newCalls=', JSON.stringify(mockDB.listingsCalls.slice(callsBeforeMove.length)),
      'ring=', screen.queryByText('38 / 38') ? '38 / 38' : '37 / 37',
      'xRendered=', !!screen.queryByText(SHOP_X_NAME))

    // (e) THE assertion: X must be gone from the direct list.
    // The re-entry refetch (staleTime 0) returns the fresh 37-row
    // page 0; the apply effect must replace the hydrated stale rows.
    // If the bug reproduces, this waitFor times out with X still on
    // screen — the exact user report.
    await waitFor(() => expect(screen.queryByText(SHOP_X_NAME)).toBeNull(), { timeout: 8000 })
    await waitFor(() => expect(screen.getByText('37 / 37')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('37 ရလဒ်')).toBeTruthy()
    expect(screen.getByText('Health Shop 1')).toBeTruthy()
    expect(ioConstructed.length).toBe(0)
    // Diagnostic: the re-entry refetches DID fire (page 0, then page 1
    // after hydration) — the failure, if any, is not a missing fetch
    // but the fresh page-0 data being dropped on apply (see report).
    expect(mockDB.listingsCalls.length).toBeGreaterThan(callsBeforeMove.length)
    expect(mockDB.listingsCalls.slice(callsBeforeMove.length)).toEqual([0, 1])

    // Cross-check: X now lives under Pharmacy, not nowhere.
    await backToPicker()
    await waitFor(() => expect(screen.getByText('3 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    fireEvent.click(screen.getByText('ဆေးဆိုင်'))
    await waitFor(() => expect(screen.getByText('3 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText(SHOP_X_NAME)).toBeTruthy()
  }, 30000)

  it('(2) reverse: shop X moved Pharmacy -> Health-direct: re-entering Pharmacy must NOT show X, and the direct row gains X', async () => {
    // Initial state: X already under Pharmacy — and Pharmacy is
    // MULTI-PAGE (25 rows: X + 24), so the ghost reproduces there
    // too: a 3-row Pharmacy list would self-heal on 9.43 (hydration
    // never advances past page 0) and the ghost assertion would pass
    // for the wrong reason. Direct has 37 rows (2 pages).
    moveShopX(PHARM_ID, { name: 'Pharmacy', name_mm: 'ဆေးဆိုင်', icon: '💊' })
    const manyPharm = Array.from({ length: 22 }, (_, i) => ({
      id: `pharm-many-${i}`,
      name: `Pharmacy Many ${i + 1}`,
      name_mm: `Pharmacy Many ${i + 1}`,
      city: CITIES[i % 3],
      rating_avg: 4.5,
      rating_count: 2,
      category_id: PHARM_ID,
      category: { name: 'Pharmacy', name_mm: 'ဆေးဆိုင်', icon: '💊' },
    }))
    mockDB.rows = [...rowsFor(HEALTH_ID), ...rowsFor(PHARM_ID), ...manyPharm]
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    seedCache(client, PHARM_ID, PHARM_ID, rowsFor(PHARM_ID), 25)
    seedCache(client, HEALTH_ID, HEALTH_ID, rowsFor(HEALTH_ID), 37)
    expect(rowsFor(PHARM_ID).length).toBe(25)
    expect(rowsFor(HEALTH_ID).length).toBe(37)
    renderDirectory(client)

    await enterHealthPicker('37 လုပ်ငန်း', '25 လုပ်ငန်း')
    await openSub('ဆေးဆိုင်', 25)
    await waitFor(() => expect(screen.getByText('25 / 25')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText(SHOP_X_NAME)).toBeTruthy()
    const callsBeforeMove = [...mockDB.listingsCalls]

    // Move X out of Pharmacy into the direct list.
    moveShopX(HEALTH_ID, { name: 'Health', name_mm: 'ကျန်းမာရေး', icon: '🏥' })
    expect(rowsFor(PHARM_ID).length).toBe(24)
    expect(rowsFor(HEALTH_ID).length).toBe(38)

    await backToPicker()
    await waitFor(() => expect(screen.getByText('38 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('24 လုပ်ငန်း')).toBeTruthy()
    await openSubNoWait('ဆေးဆိုင်')
    await waitFor(() => expect(screen.queryByText(SHOP_X_NAME)).toBeNull(), { timeout: 8000 })
    await waitFor(() => expect(screen.getByText('24 / 24')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('Pharmacy Shop 1')).toBeTruthy()
    expect(mockDB.listingsCalls.length).toBeGreaterThan(callsBeforeMove.length)

    // Cross-check: X now lives in the direct list, not nowhere.
    // (The fresh direct page 0 has the SAME first 20 rows as the
    // stale one — X lands last, on page 1 — so only the TOTAL
    // differs (37 -> 38); the fix must catch that too.)
    await backToPicker()
    await waitFor(() => expect(screen.getByText('38 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    await openDirectNoWait()
    await waitFor(() => expect(screen.getByText(SHOP_X_NAME)).toBeTruthy(), { timeout: 8000 })
    await waitFor(() => expect(screen.getByText('38 / 38')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('38 ရလဒ်')).toBeTruthy()
    expect(ioConstructed.length).toBe(0)
  }, 30000)

  it('(3) between subs: shop X moved Pharmacy -> Hospital: ghost in the old sub, missing from the new one', async () => {
    // Initial state: X under Pharmacy (25 rows, multi-page, so the
    // ghost reproduces); Hospital has 21 rows (also multi-page, so
    // the "missing from the new list" half reproduces too — a
    // single-page Hospital list would self-heal on 9.43).
    moveShopX(PHARM_ID, { name: 'Pharmacy', name_mm: 'ဆေးဆိုင်', icon: '💊' })
    mockDB.cats = [...ALL_CATS, HOSP_SUB]
    const manyPharm = Array.from({ length: 22 }, (_, i) => ({
      id: `pharm-many-${i}`,
      name: `Pharmacy Many ${i + 1}`,
      name_mm: `Pharmacy Many ${i + 1}`,
      city: CITIES[i % 3],
      rating_avg: 4.5,
      rating_count: 2,
      category_id: PHARM_ID,
      category: { name: 'Pharmacy', name_mm: 'ဆေးဆိုင်', icon: '💊' },
    }))
    const manyHosp = Array.from({ length: 20 }, (_, i) => ({
      id: `hosp-many-${i}`,
      name: `Hospital Many ${i + 1}`,
      name_mm: `Hospital Many ${i + 1}`,
      city: CITIES[i % 3],
      rating_avg: 4.5,
      rating_count: 2,
      category_id: HOSP_ID,
      category: { name: 'Hospital', name_mm: 'ဆေးရုံ', icon: '🏨' },
    }))
    mockDB.rows = [...rowsFor(HEALTH_ID), ...rowsFor(PHARM_ID), ...manyPharm, ...makeHospRows(), ...manyHosp]
    const client = makeClient()
    client.setQueryData(['category-map'], mockDB.cats)
    seedCache(client, PHARM_ID, PHARM_ID, rowsFor(PHARM_ID), 25)
    seedCache(client, HOSP_ID, HOSP_ID, rowsFor(HOSP_ID), 21)
    expect(rowsFor(PHARM_ID).length).toBe(25)
    expect(rowsFor(HOSP_ID).length).toBe(21)
    renderDirectory(client)

    await enterHealthPicker('37 လုပ်ငန်း', '25 လုပ်ငန်း')
    expect(screen.getByText('21 လုပ်ငန်း')).toBeTruthy()
    await openSub('ဆေးဆိုင်', 25)
    await waitFor(() => expect(screen.getByText('25 / 25')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText(SHOP_X_NAME)).toBeTruthy()
    const callsBeforeMove = [...mockDB.listingsCalls]

    // Move X from Pharmacy to Hospital.
    moveShopX(HOSP_ID, { name: 'Hospital', name_mm: 'ဆေးရုံ', icon: '🏨' })
    expect(rowsFor(PHARM_ID).length).toBe(24)
    expect(rowsFor(HOSP_ID).length).toBe(22)

    await backToPicker()
    await waitFor(() => expect(screen.getByText('24 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('22 လုပ်ငန်း')).toBeTruthy()
    await openSubNoWait('ဆေးဆိုင်')
    await waitFor(() => expect(screen.queryByText(SHOP_X_NAME)).toBeNull(), { timeout: 8000 })
    await waitFor(() => expect(screen.getByText('24 / 24')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('Pharmacy Shop 1')).toBeTruthy()
    expect(mockDB.listingsCalls.length).toBeGreaterThan(callsBeforeMove.length)

    // Cross-check: X now lives under Hospital, not nowhere.
    await backToPicker()
    await waitFor(() => expect(screen.getByText('22 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    await openSubNoWait('ဆေးရုံ')
    await waitFor(() => expect(screen.getByText(SHOP_X_NAME)).toBeTruthy(), { timeout: 8000 })
    await waitFor(() => expect(screen.getByText('22 / 22')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('22 ရလဒ်')).toBeTruthy()
    expect(ioConstructed.length).toBe(0)
  }, 30000)

  it('(4) single-page self-heal: <= 20 rows, re-entry heals by itself', async () => {
    // Only 5 direct rows (X + 4) — hydration never advances past
    // page 0, so the fresh page-0 refetch applies through the normal
    // page guard. This passed on unmodified 9.43 code and guards the
    // fix against breaking the small-list path.
    const keepHealth = rowsFor(HEALTH_ID).slice(1, 5)
    mockDB.rows = [mockDB.rows[0], ...keepHealth, ...rowsFor(PHARM_ID)]
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    seedCache(client, HEALTH_ID, HEALTH_ID, rowsFor(HEALTH_ID), 5)
    expect(rowsFor(HEALTH_ID).length).toBe(5)
    renderDirectory(client)

    await enterHealthPicker('5 လုပ်ငန်း', '2 လုပ်ငန်း')
    await openDirectAll(5)
    await waitFor(() => expect(screen.getByText('5 / 5')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText(SHOP_X_NAME)).toBeTruthy()
    const callsBeforeMove = [...mockDB.listingsCalls]

    moveShopX(PHARM_ID, { name: 'Pharmacy', name_mm: 'ဆေးဆိုင်', icon: '💊' })
    expect(rowsFor(HEALTH_ID).length).toBe(4)
    expect(rowsFor(PHARM_ID).length).toBe(3)

    await backToPicker()
    await waitFor(() => expect(screen.getByText('4 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('3 လုပ်ငန်း')).toBeTruthy()
    await openDirectAll(4)
    await waitFor(() => expect(screen.queryByText(SHOP_X_NAME)).toBeNull(), { timeout: 8000 })
    await waitFor(() => expect(screen.getByText('4 / 4')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('Health Shop 1')).toBeTruthy()
    expect(mockDB.listingsCalls.length).toBeGreaterThan(callsBeforeMove.length)
    expect(mockDB.listingsCalls.slice(callsBeforeMove.length)).toEqual([0])
    expect(ioConstructed.length).toBe(0)
  }, 30000)
})
