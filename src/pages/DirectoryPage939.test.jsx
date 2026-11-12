// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LangProvider } from '../contexts/LangContext'
import DirectoryPage from './DirectoryPage'
import UpdatePrompt from '../components/UpdatePrompt'
import Header from '../components/Header'

// v9.39: TWO user-reported failures on live 9.38 (connection GOOD —
// do not blame the network), both about the list not matching what
// the outside already shows:
//   (A) THE SWITCH RACE — in-place switch with a WARM cache shows
//       "0 ရလဒ်": the apply effect runs first in the switch commit
//       and applies the new category's cached rows, then the
//       filter-change reset effect runs and WIPES them (its ref still
//       holds the OLD category's key), and the apply effect never
//       re-runs (same cached object, same page 0). Fresh entry from
//       Home shows the rows (ref starts ''), clean browser shows
//       them (data lands after the reset) — only the warm in-place
//       switch strands at 0.
//   (C) INSTANT ENTRY — opening a list whose pages are all cached
//       must show the FULL list at once (172/172 + all rows), not
//       climb 20 → 40 → … → 172. The background refetch may still
//       run quietly, but it must not gate the display.
//   (D) LONG CHAIN — the 110-page "အားလုံး" list (2,186 rows) must
//       hydrate in ONE update: per-page advances would trip React's
//       "Maximum update depth exceeded" cap on long chains.
//   (F) MODAL — the UpdatePrompt + post-update modal must show the
//       FULL 9.39 change log (all bullets) from version.json
//       changesMy/changesEn, not one generic line.
//
// NOTE: this file has NO filesystem-path comparisons at all (no
// path.relative / path.join / readdir comparisons on file paths —
// the only node:path use is locating version-changes.json /
// Header.jsx source for the static (F3) assertions, read with
// readFileSync, never compared as paths), so the 9.19/9.25
// backslash-path rule does not apply here — stated explicitly per
// the brief.

const CAT_ID = 'car-parent-id'
const CAR_ID = 'car-rental-sub-id'
const HOSP_CAT_ID = 'hospital-parent-id'
const HOSP_ID = 'hospital-sub-id'
const ALL_CAT_ID = 'all-parent-id'
const CAR_CAT = { id: CAT_ID, icon: '🚗', name: 'Car Rental', name_mm: 'ကားငှားဝန်ဆောင်မှု', parent_id: null }
const CAR_SUB = { id: CAR_ID, icon: '🚗', name: 'Car Rental', name_mm: 'ကားငှားဝန်ဆောင်မှု', parent_id: CAT_ID }
const HOSP_CAT = { id: HOSP_CAT_ID, icon: '🏥', name: 'Hospital', name_mm: 'ဆေးရုံ', parent_id: null }
const HOSP_SUB = { id: HOSP_ID, icon: '🏥', name: 'Hospital', name_mm: 'ဆေးရုံ', parent_id: HOSP_CAT_ID }
const ALL_CAT = { id: ALL_CAT_ID, icon: '📂', name: 'All Shops', name_mm: 'ဆိုင်အားလုံး', parent_id: null }
const ALL_CATS = [CAR_CAT, CAR_SUB, HOSP_CAT, HOSP_SUB, ALL_CAT]

const CITIES = ['Taunggyi', 'Kalaw', 'Heho']
function makeRows(n, catId, prefix) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}-row-${i}`,
    name: `${prefix} ${i + 1}`,
    name_mm: `${prefix} ${i + 1}`,
    city: CITIES[i % 3],
    rating_avg: 4.5,
    rating_count: 2,
    category_id: catId,
    category: { name: prefix, name_mm: prefix, icon: '🏢' },
  }))
}

// The 9.39 change log — the SAME strings live in version-changes.json
// (changesMy/changesEn) and in the Header.jsx 9.39 entry (Burmese).
// Tests (F1)/(F2) assert the modals render every one of them.
const CHANGES_MY_939 = [
  'အမျိုးအစားတစ်ခုကနေ နောက်တစ်ခုကို ပြောင်းကြည့်ရင် စာရင်း "၀ ရလဒ်" ပြနေတာ ပြင်ပြီး — ဒေါင်းထားပြီးသား စာရင်း ချက်ချင်း ပေါ်မည်',
  'အပြင်မှာ 172/172 ပြရင် အထဲဖွင့်လိုက်တာနဲ့ စာရင်း အပြည့် ချက်ချင်း ပေါ်ပြီ — တစ်ခုချင်း ထပ်တင်နေတာ စောင့်စရာ မလိုတော့ပါ',
  'Version အသစ် ရရင် ပြောင်းလဲထားတာတွေ အားလုံး တစ်ခါတည်း ပေါ်ပြီ — အပ်ဒိတ်လုပ်ဖို့ နှိပ်ခိုင်းတဲ့ စာမှာ အပြည့်အစုံ ပါမည်',
  'လုပ်ငန်းကတ် ပြတာ ပိုမြန်လာပြီ — စာရင်း ရှည်လည်း ချောချောမွေ့မွေ့ ပွတ်ဆွဲနိုင်မည်',
]
const CHANGES_EN_939 = [
  'Switching from one category to another no longer shows "0 results" — the downloaded list appears instantly',
  'When the tile outside shows 172/172, opening the list shows all rows at once — no more waiting for it to climb page by page',
  'The update prompt now shows the full list of changes for the new version all at once',
  'Listing cards render faster — long lists scroll more smoothly',
]

const { mockFetchCategories, mockDB, swMock } = vi.hoisted(() => ({
  mockFetchCategories: vi.fn(),
  mockDB: {
    cats: [], rows: [],
    failPages: {}, hangPages: new Set(), pendingResolves: {},
    listingsCalls: [],
  },
  swMock: {
    applyUpdate: vi.fn(),
    updateAvailable: true,
    updating: false,
    serverVersion: null,
    serverChanges: null,
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

vi.mock('../lib/prefetch', () => ({ fetchCategories: mockFetchCategories }))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoggedIn: false, profile: null, isAdmin: false, isModerator: false, signOut: vi.fn() }),
}))

vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ cities: ['Taunggyi', 'Kalaw', 'Heho'], app_name: 'Cherry Directory', app_city: 'တောင်ကြီးမြို့' }),
}))

vi.mock('../hooks/useServiceWorker', () => ({
  useServiceWorker: () => swMock,
}))

vi.mock('../hooks/useNotifications', () => ({
  useUnreadNotificationCount: () => 0,
  useNotificationSubscription: () => {},
}))

vi.mock('../lib/manualSync', () => ({
  useManualSync: () => ({ sync: vi.fn(), busy: false, syncing: false, progress: null, status: null }),
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

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={['/directory']}>
      <LangProvider>
        <Header />
      </LangProvider>
    </MemoryRouter>
  )
}

const CAR_FILTER_KEY = 'car-rental-sub-id|car-rental-sub-id|All|false||rating'
const HOSP_FILTER_KEY = 'hospital-sub-id|hospital-sub-id|All|false||rating'
const ALL_FILTER_KEY = 'all-parent-id|all-parent-id|All|false||rating'
function listingsKey(subId, idsKey, page) {
  return ['listings', 'directory', subId, idsKey, 'All', false, '', 'rating', page, false]
}

// Seed the given rows' pages into the QueryClient, exactly as the
// persisted cache would hold them after a full visit.
function seedListingsCache(client, rows, subId, idsKey, filterKey) {
  const total = rows.length
  const pages = Math.ceil(total / 20)
  for (let p = 0; p < pages; p++) {
    client.setQueryData(listingsKey(subId, idsKey, p), {
      rows: rows.slice(p * 20, p * 20 + 20),
      total,
      page: p,
      filterKey,
    })
  }
}

// Tap category (Burmese name) → wait for the subcategory picker's
// count badge → tap the subcategory (last matching row: the picker
// header shows the same name). No wait for a results count — the
// caller asserts the list state synchronously right after the tap.
async function enterSubcategory(catMm, badgeText, subMm) {
  await waitFor(() => expect(screen.getByText(catMm)).toBeTruthy(), { timeout: 5000 })
  fireEvent.click(screen.getByText(catMm))
  await waitFor(() => expect(screen.getByText(badgeText)).toBeTruthy(), { timeout: 5000 })
  const rows = screen.getAllByText(subMm)
  fireEvent.click(rows[rows.length - 1])
}

async function openCarRental(expectedTotal) {
  await enterSubcategory('ကားငှားဝန်ဆောင်မှု', '172 လုပ်ငန်း', 'ကားငှားဝန်ဆောင်မှု')
  await waitFor(() => expect(screen.getByText(`${expectedTotal} ရလဒ်`)).toBeTruthy(), { timeout: 5000 })
}

// The user's path: in-app Back from the listings to the picker, then
// Back again to the category list.
async function backToCategoryList() {
  fireEvent.click(screen.getByText('နောက်သို့'))
  await waitFor(() => expect(screen.getByText('အမျိုးအစားခွဲကို ရွေးပါ')).toBeTruthy(), { timeout: 5000 })
  fireEvent.click(screen.getByText('နောက်သို့'))
  await waitFor(() => expect(screen.getByText('📂 အမျိုးအစားများ')).toBeTruthy(), { timeout: 5000 })
}

beforeEach(() => {
  cleanup()
  ioConstructed.length = 0
  mockFetchCategories.mockReset()
  mockFetchCategories.mockResolvedValue([CAR_CAT, HOSP_CAT, ALL_CAT])
  mockDB.cats = [...ALL_CATS]
  mockDB.rows = [...makeRows(172, CAR_ID, 'Car Rental'), ...makeRows(14, HOSP_ID, 'Hospital')]
  mockDB.failPages = {}
  mockDB.hangPages = new Set()
  mockDB.pendingResolves = {}
  mockDB.listingsCalls = []
  window.localStorage.clear()
  swMock.applyUpdate.mockClear()
  swMock.updateAvailable = true
  swMock.updating = false
  swMock.serverVersion = null
  swMock.serverChanges = null
})

afterEach(() => { cleanup() })

describe('v9.39 (A) THE SWITCH RACE — warm cache, in-place switch must show the new list at once, never "0 ရလဒ်"', () => {
  it('Car Rental → Back → Back → Hospital: 14 rows show immediately from cache even though the refetch fails', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    const carRows = mockDB.rows.filter(r => r.category_id === CAR_ID)
    const hospRows = mockDB.rows.filter(r => r.category_id === HOSP_ID)
    seedListingsCache(client, carRows, CAR_ID, CAR_ID, CAR_FILTER_KEY)
    seedListingsCache(client, hospRows, HOSP_ID, HOSP_ID, HOSP_FILTER_KEY)
    // Every page-0 refetch fails: the DISPLAY must come from the warm
    // cache, not from the refetch landing. On 9.38 the switch commit
    // applies the cached Hospital rows and then the reset effect
    // wipes them (its ref still holds Car Rental's key); the refetch
    // fails, nothing re-applies, and the list strands at "0 ရလဒ်"
    // with the full error card.
    mockDB.failPages = { 0: 99 }
    renderDirectory(client)
    await openCarRental(172)
    await backToCategoryList()

    await enterSubcategory('ဆေးရုံ', '14 လုပ်ငန်း', 'ဆေးရုံ')

    // SYNCHRONOUS: the rows are cached, so they must be on screen in
    // the same commit as the tap — no waiting, no "0 ရလဒ်" flash.
    expect(screen.getByText('14 ရလဒ်')).toBeTruthy()
    expect(screen.queryByText('0 ရလဒ်')).toBeNull()
    expect(screen.getByText('Hospital 14')).toBeTruthy()
    expect(screen.getByText('14 / 14')).toBeTruthy()
    // The failed refetch is NOT a display failure while rows are on
    // screen: no full error card.
    expect(screen.queryByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeNull()
    // Still 14 after settling — the list never strands at 0.
    await act(async () => { await new Promise(r => setTimeout(r, 500)) })
    expect(screen.getByText('14 ရလဒ်')).toBeTruthy()
    expect(screen.getByText('Hospital 14')).toBeTruthy()
    expect(screen.queryByText('0 ရလဒ်')).toBeNull()
    expect(ioConstructed.length).toBe(0)
  }, 30000)
})

describe('v9.39 (B) COLD SWITCH — old rows cleared, skeletons, then the new rows land', () => {
  it('Car Rental → Back → Back → Hospital with a cold cache: no stale rows, loading shows, then 14 rows', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    await openCarRental(172)
    await backToCategoryList()

    await enterSubcategory('ဆေးရုံ', '14 လုပ်ငန်း', 'ဆေးရုံ')

    // SYNCHRONOUS: the old filter's rows are gone in the switch
    // commit — no stale Car Rental rows under the Hospital header.
    expect(screen.queryByText('Car Rental 1')).toBeNull()
    expect(screen.queryByText('172 ရလဒ်')).toBeNull()
    // Then the new rows land by themselves.
    await waitFor(() => expect(screen.getByText('14 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('Hospital 14')).toBeTruthy()
    expect(screen.getByText('14 / 14')).toBeTruthy()
    expect(screen.queryByText('Car Rental 1')).toBeNull()
  }, 30000)
})

describe('v9.39 (C) INSTANT ENTRY — warm cache shows the FULL list at once, no climbing', () => {
  it('all 9 Car Rental pages cached: opening from Home shows 172/172 + all rows immediately', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    const carRows = mockDB.rows.filter(r => r.category_id === CAR_ID)
    seedListingsCache(client, carRows, CAR_ID, CAR_ID, CAR_FILTER_KEY)
    renderDirectory(client)

    await enterSubcategory('ကားငှားဝန်ဆောင်မှု', '172 လုပ်ငန်း', 'ကားငှားဝန်ဆောင်မှု')

    // SYNCHRONOUS: the full list is cached, so the FIRST observed
    // state is already 172/172 — never 20/172, 40/172, … On 9.38
    // this commit shows 20/172 and the ring climbs page by page.
    expect(screen.getByText('172 / 172')).toBeTruthy()
    expect(screen.getByText('172 ရလဒ်')).toBeTruthy()
    expect(screen.getByText('Car Rental 172')).toBeTruthy()
    expect(screen.getByText('Car Rental 1')).toBeTruthy()
    // Settle: still full, and the display never needed the chain —
    // only quiet background refetches of pages already shown (page 0
    // on entry, page 8 after hydration sets the page). Pages 1–7
    // were never fetched for display.
    await act(async () => { await new Promise(r => setTimeout(r, 500)) })
    expect(screen.getByText('172 / 172')).toBeTruthy()
    expect(mockDB.listingsCalls.filter(p => p !== 0 && p !== 8)).toEqual([])
    expect(ioConstructed.length).toBe(0)
  }, 30000)
})

describe('v9.39 (D) LONG CHAIN — 110-page "အားလုံး" list hydrates in one update, no depth error', () => {
  it('2,186 rows / 110 cached pages: 2,186/2,186 at once, zero "Maximum update depth exceeded"', async () => {
    mockDB.rows = makeRows(2186, ALL_CAT_ID, 'All')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const client = makeClient()
      client.setQueryData(['category-map'], ALL_CATS)
      seedListingsCache(client, mockDB.rows, ALL_CAT_ID, ALL_CAT_ID, ALL_FILTER_KEY)
      renderDirectory(client)

      await waitFor(() => expect(screen.getByText('ဆိုင်အားလုံး')).toBeTruthy(), { timeout: 5000 })
      // A childless top-level category jumps STRAIGHT to its direct
      // listings (directNavigate's map-first path) — no picker, no
      // "အားလုံး" button. Wait for the listings view to appear, then
      // assert the ring SYNCHRONOUSLY: the commit that first shows
      // the total must already show the full 2,186.
      fireEvent.click(screen.getByText('ဆိုင်အားလုံး'))
      await waitFor(() => expect(screen.getByText('2,186 ရလဒ်')).toBeTruthy(), { timeout: 5000 })

      // SYNCHRONOUS: one-shot hydration — the first observed state
      // is already the full 2,186, not a page-by-page climb. On 9.38
      // this commit shows 20 / 2186 and the ring climbs from there.
      expect(screen.getByText('2186 / 2186')).toBeTruthy()
      expect(document.querySelectorAll('.card-listing').length).toBe(2186)
      await act(async () => { await new Promise(r => setTimeout(r, 500)) })
      expect(screen.getByText('2186 / 2186')).toBeTruthy()
      const depthErrors = errSpy.mock.calls.filter(c => String(c[0]).includes('Maximum update depth'))
      expect(depthErrors).toEqual([])
      // The display never needed the chain: only quiet refetches of
      // pages already shown (0 on entry, 109 after hydration).
      expect(mockDB.listingsCalls.filter(p => p !== 0 && p !== 109)).toEqual([])
      expect(ioConstructed.length).toBe(0)
    } finally {
      errSpy.mockRestore()
    }
  }, 60000)
})

describe('v9.39 (E) COLD ENTRY still chains normally to completion', () => {
  it('cold cache: Car Rental climbs by the chain alone to 172/172, one request per page', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)
    await openCarRental(172)
    await waitFor(() => expect(screen.getByText('172 / 172')).toBeTruthy(), { timeout: 20000 })
    expect(screen.getByText('Car Rental 172')).toBeTruthy()
    expect(mockDB.listingsCalls).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  }, 30000)
})

describe('v9.39 (F) MODAL — full 9.39 change log, all bullets, from version.json', () => {
  it('(F1) UpdatePrompt renders the full new-version log under the heading', async () => {
    swMock.serverVersion = '9.40'
    swMock.serverChanges = { changesMy: CHANGES_MY_939, changesEn: CHANGES_EN_939 }
    render(<UpdatePrompt />)
    await waitFor(() => expect(screen.getByText('ဤ Version မှာ ပြောင်းလဲထားသည်များကတော့')).toBeTruthy(), { timeout: 5000 })
    for (const item of CHANGES_MY_939) {
      expect(screen.getByText(item)).toBeTruthy()
    }
    // Reload + dismiss behaviour is unchanged.
    expect(screen.getByText('ပြန်ဖွင့်မည်')).toBeTruthy()
  }, 20000)

  it('(F2) post-update modal leads with the 9.39 log from live version.json and says "Version 9.39"', async () => {
    window.localStorage.setItem('cherry_onboarding_done', '1')
    window.localStorage.removeItem('cherry_last_seen_version')
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ version: '9.39', changesMy: CHANGES_MY_939, changesEn: CHANGES_EN_939 }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      renderHeader()
      await waitFor(() => expect(screen.getByText('ဤ Version မှာ ပြောင်းလဲထားသည်များကတော့')).toBeTruthy(), { timeout: 8000 })
      expect(screen.getByText('Version 9.39')).toBeTruthy()
      for (const item of CHANGES_MY_939) {
        expect(screen.getByText(item)).toBeTruthy()
      }
      expect(fetchMock).toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  }, 20000)

  it('(F3) version-changes.json 9.39 entry matches the Header.jsx 9.39 entry, zero Admin', () => {
    const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    const changes = JSON.parse(readFileSync(join(rootDir, 'version-changes.json'), 'utf8'))
    expect(changes['9.39']).toBeTruthy()
    expect(changes['9.39'].changesMy).toEqual(CHANGES_MY_939)
    expect(changes['9.39'].changesEn).toEqual(CHANGES_EN_939)
    const header = readFileSync(join(rootDir, 'src', 'components', 'Header.jsx'), 'utf8')
    expect(header).toContain("{ v: '9.39', date: '2026-11-10'")
    for (const item of CHANGES_MY_939) {
      expect(header).toContain(item)
    }
    const entry = header.slice(header.indexOf("{ v: '9.39'"), header.indexOf("{ v: '9.38'"))
    expect(entry).not.toMatch(/Admin/i)
    expect(JSON.stringify(changes['9.39'])).not.toMatch(/Admin/i)
  })
})
