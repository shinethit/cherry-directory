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

// v9.40 — ITEM 2: generic drill-down picker for a second sub-category
// level, plus (E) preserved behaviour: direct ?cat= deep links at any
// depth, descendant-inclusive listings, and the 9.32 direct path.
// Fixture: Health (top) -> Hospital (sub) -> General Hospital /
// Private Hospital (level 3). Hospital has 2 direct listings,
// General Hospital 3, Private Hospital 0, Health itself 1 direct.
//
// NOTE: this file has NO filesystem-path comparisons at all (no
// path.relative / path.join / readdir comparisons on file paths), so
// the 9.19/9.25 backslash-path rule does not apply here — stated
// explicitly per the brief.

const HEALTH_ID = 'health-id'
const HOSP_ID = 'hospital-id'
const GEN_ID = 'general-id'
const PRIV_ID = 'private-id'
const HEALTH_CAT = { id: HEALTH_ID, icon: '🏥', name: 'Health', name_mm: 'ကျန်းမာရေး', parent_id: null }
const HOSP_SUB = { id: HOSP_ID, icon: '🏥', name: 'Hospital', name_mm: 'ဆေးရုံ', parent_id: HEALTH_ID }
const GEN_SUB = { id: GEN_ID, icon: '🏥', name: 'General Hospital', name_mm: 'အထွေထွေဆေးရုံ', parent_id: HOSP_ID }
const PRIV_SUB = { id: PRIV_ID, icon: '🏥', name: 'Private Hospital', name_mm: 'ပုဂ္ဂလိကဆေးရုံ', parent_id: HOSP_ID }
const ALL_CATS = [HEALTH_CAT, HOSP_SUB, GEN_SUB, PRIV_SUB]

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

const { mockFetchCategories, mockDB } = vi.hoisted(() => ({
  mockFetchCategories: vi.fn(),
  mockDB: { cats: [], rows: [], lastListingsInVals: null },
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

// Tap Health on the category list, wait for the Hospital picker row.
async function enterHealthPicker() {
  await waitFor(() => expect(screen.getByText('ကျန်းမာရေး')).toBeTruthy(), { timeout: 5000 })
  fireEvent.click(screen.getByText('ကျန်းမာရေး'))
  await waitFor(() => expect(screen.getByText('5 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
}

// From the Health picker, drill into Hospital's children picker.
async function drillToHospital() {
  fireEvent.click(screen.getByText('ဆေးရုံ'))
  await waitFor(() => expect(screen.getByText('3 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
}

beforeEach(() => {
  cleanup()
  ioConstructed.length = 0
  mockFetchCategories.mockReset()
  mockFetchCategories.mockResolvedValue([{ ...HEALTH_CAT, listing_count: 6 }])
  mockDB.cats = [...ALL_CATS]
  mockDB.rows = [
    ...makeRows(3, GEN_ID, 'General'),
    ...makeRows(2, HOSP_ID, 'Hospital Direct'),
    ...makeRows(1, HEALTH_ID, 'Health Office'),
  ]
  mockDB.lastListingsInVals = null
  window.localStorage.clear()
})

afterEach(() => { cleanup() })

describe('v9.40 (C) DRILL-DOWN — a sub with children opens its own picker level', () => {
  it('Health -> Hospital drills to its children; General shows ONLY its 3 listings; Back walks levels', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)

    await enterHealthPicker()
    // Health picker: Hospital badge is descendant-inclusive (2 + 3),
    // and the direct row shows Health's own 1 listing.
    expect(screen.getByText('1 လုပ်ငန်း')).toBeTruthy()

    // Tap Hospital (HAS children) — must DRILL, not show listings.
    // On 9.39 this tap jumps straight to Hospital's 5 listings.
    await drillToHospital()
    expect(screen.queryByText(/ရလဒ်/)).toBeNull()
    // Drilled picker header is Hospital itself.
    expect(screen.getByText('ဆေးရုံ')).toBeTruthy()
    // Children with descendant-inclusive badges; the direct row shows
    // Hospital's own 2 listings.
    expect(screen.getByText('2 လုပ်ငန်း')).toBeTruthy()
    // 0-count level-3 row is disabled, like every 0-count row today.
    const privBtn = screen.getByText('ပုဂ္ဂလိကဆေးရုံ').closest('button')
    expect(privBtn.disabled).toBe(true)
    expect(screen.getByText('မရှိသေး')).toBeTruthy()

    // Tap General Hospital (leaf) — ONLY its 3 listings, not all of
    // Hospital's 5.
    fireEvent.click(screen.getByText('အထွေထွေဆေးရုံ'))
    await waitFor(() => expect(screen.getByText('3 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('3 / 3')).toBeTruthy()
    expect(screen.getByText('General 1')).toBeTruthy()
    expect(screen.getByText('General 3')).toBeTruthy()
    expect(screen.queryByText('Hospital Direct 1')).toBeNull()
    expect(screen.queryByText('Health Office 1')).toBeNull()

    // Back returns to Hospital's children picker (not Health's).
    fireEvent.click(screen.getByText('နောက်သို့'))
    await waitFor(() => expect(screen.getByText('3 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('ဆေးရုံ')).toBeTruthy()

    // Back returns to Health's children picker.
    fireEvent.click(screen.getByText('နောက်သို့'))
    await waitFor(() => expect(screen.getByText('5 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('ကျန်းမာရေး')).toBeTruthy()

    // Back returns to the top-level category list.
    fireEvent.click(screen.getByText('နောက်သို့'))
    await waitFor(() => expect(screen.getByText('📂 အမျိုးအစားများ')).toBeTruthy(), { timeout: 5000 })
    expect(ioConstructed.length).toBe(0)
  }, 30000)

  it('"အားလုံး" at the drilled level shows ONLY that level\'s direct listings, and Back returns to the drilled picker', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client)

    await enterHealthPicker()
    await drillToHospital()

    fireEvent.click(screen.getByRole('button', { name: /အားလုံး/ }))
    await waitFor(() => expect(screen.getByText('2 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('Hospital Direct 1')).toBeTruthy()
    expect(screen.getByText('Hospital Direct 2')).toBeTruthy()
    // Direct-only: no descendant rows leak in.
    expect(screen.queryByText('General 1')).toBeNull()
    expect(mockDB.lastListingsInVals).toEqual([HOSP_ID])

    fireEvent.click(screen.getByText('နောက်သို့'))
    await waitFor(() => expect(screen.getByText('3 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('ဆေးရုံ')).toBeTruthy()
    expect(ioConstructed.length).toBe(0)
  }, 30000)
})

describe('v9.40 (E) PRESERVED — deep links and descendant-inclusive listings', () => {
  it('direct ?cat=<level-3 id> shows ONLY that category\'s listings; Back returns to its parent picker', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client, '/directory?cat=general-id')

    await waitFor(() => expect(screen.getByText('3 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('General 1')).toBeTruthy()
    expect(screen.queryByText('Hospital Direct 1')).toBeNull()
    expect(mockDB.lastListingsInVals).toEqual([GEN_ID])

    // Back goes to the parent level's picker — on 9.39 it lands on
    // Hospital's listings instead.
    fireEvent.click(screen.getByText('နောက်သို့'))
    await waitFor(() => expect(screen.getByText('3 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('ဆေးရုံ')).toBeTruthy()
    expect(screen.getByText('အထွေထွေဆေးရုံ')).toBeTruthy()
  }, 30000)

  it('direct ?cat=<parent sub id> still shows the subcategory + ALL descendants (9.32 behaviour)', async () => {
    const client = makeClient()
    client.setQueryData(['category-map'], ALL_CATS)
    renderDirectory(client, '/directory?cat=hospital-id')

    await waitFor(() => expect(screen.getByText('5 ရလဒ်')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('General 1')).toBeTruthy()
    expect(screen.getByText('Hospital Direct 1')).toBeTruthy()
    expect(mockDB.lastListingsInVals).toEqual([HOSP_ID, GEN_ID, PRIV_ID])
  }, 30000)
})

// v9.40 (F) CHANGELOG — the 9.40 entry in version-changes.json matches
// the Header.jsx history entry (Burmese), zero Admin, and the offline
// fallback leads with the same items. Follows the 9.39 (F3) pattern.
//
// NOTE: the only node:path use in this file is locating
// version-changes.json / Header.jsx / package.json for these static
// assertions, read with readFileSync, never compared as paths — so
// the 9.19/9.25 backslash-path rule does not apply here either.
const CHANGES_MY_940 = [
  'Category အသစ် ထည့်လိုက်တာနဲ့ ပင်မစာမျက်နှာနဲ့ Directory မှာ ချက်ချင်း ပေါ်ပြီ — ၅ မိနစ် စောင့်စရာ မလိုတော့ပါ',
  'အမျိုးအစားခွဲထဲက အမျိုးအစားခွဲကို ထပ်ရွေးလို့ ရပြီ — ကျန်းမာရေး → ဆေးရုံ → အထွေထွေဆေးရုံ ဆိုပြီး အဆင့်ဆင့် ဝင်ကြည့်နိုင်ပြီ',
  'လုပ်ငန်းထည့်တဲ့နေရာမှာ အဆင့် ၃ အမျိုးအစားကိုလည်း ရွေးလို့ ရပြီ',
  'အမည်တူ Category ထပ်ထည့်မိတာ ချက်ချင်း သိပြီ — နောက်တစ်ယောက် ထည့်ထားတာ ရှိရင်လည်း တွေ့မည်',
]
const CHANGES_EN_940 = [
  'A newly added category appears on Home and in the Directory immediately — no more waiting up to 5 minutes',
  'You can now drill into a sub-category of a sub-category — Health → Hospital → General Hospital, level by level',
  'The submit form now offers level-3 categories too',
  'Adding a category with a name that already exists is caught at once — even if someone else just added it',
]

describe('v9.40 (F) CHANGELOG — 9.40 entry, Header match, zero Admin', () => {
  it('(F3) version-changes.json 9.40 entry matches the Header.jsx 9.40 entry, zero Admin', () => {
    const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    const changes = JSON.parse(readFileSync(join(rootDir, 'version-changes.json'), 'utf8'))
    expect(changes['9.40']).toBeTruthy()
    expect(changes['9.40'].changesMy).toEqual(CHANGES_MY_940)
    expect(changes['9.40'].changesEn).toEqual(CHANGES_EN_940)
    const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
    expect(pkg.version).toBe('9.40')
    const header = readFileSync(join(rootDir, 'src', 'components', 'Header.jsx'), 'utf8')
    expect(header).toContain("{ v: '9.40', date: '2026-11-13'")
    for (const item of CHANGES_MY_940) {
      expect(header).toContain(item)
    }
    const entry = header.slice(header.indexOf("{ v: '9.40'"), header.indexOf("{ v: '9.39'"))
    expect(entry).not.toMatch(/Admin/i)
    expect(JSON.stringify(changes['9.40'])).not.toMatch(/Admin/i)
    // The modal's lead block (v{APP_VERSION} badge) must carry the
    // CURRENT version's date, not the previous version's — the lead
    // date was still 2026-11-10 after the bump until this fix.
    const lead = header.slice(header.indexOf('v{APP_VERSION}'), header.indexOf("{ v: '9.40'"))
    expect(lead).toContain('2026-11-13')
    // The offline fallback constant carries the same 9.40 items.
    expect(header).toContain('LEAD_FALLBACK_MY_940')
    const fallback = header.slice(header.indexOf('LEAD_FALLBACK_MY_940 = ['), header.indexOf('LEAD_FALLBACK_MY_940 = [') + 2000)
    for (const item of CHANGES_MY_940) {
      expect(fallback).toContain(item)
    }
  })
})
