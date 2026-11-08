// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LangProvider } from '../contexts/LangContext'
import DirectoryPage, { groupListingsByCity } from './DirectoryPage'

// v9.30: town grouping on the Directory page. When city = All the loaded
// listings render under town headings (town name + loaded-row count),
// ordered by count desc with Taunggyi first on ties; a specific city
// renders flat exactly as before. Grouping is over loaded rows only.

const { mockFetchCategories, mockDB } = vi.hoisted(() => ({
  mockFetchCategories: vi.fn(),
  mockDB: { cats: [], listings: [], singleCategoryCalls: [], offline: false },
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
      const state = { table, head: false, eqs: {}, single: false }
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
        then(resolve) {
          if (state.single) {
            mockDB.singleCategoryCalls.push({ table: state.table })
            if (state.table === 'categories') {
              resolve({ data: mockDB.cats.find(c => String(c.id) === String(state.eqs.id)) || null, error: null })
            } else {
              resolve({ data: null, error: null })
            }
            return
          }
          if (state.head) {
            resolve({ count: 0, data: null, error: null })
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
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } })
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

// Reach the listings level via the ?cat= deep link, exactly like the
// v9.25 tests: warm top-level cache + category-map, categories fetch
// never resolves.
function seedListingsLevel(client, listings) {
  client.setQueryData(['categories'], [CATS[0]])
  client.setQueryData(['category-map'], CATS)
  mockFetchCategories.mockImplementation(() => new Promise(() => {}))
  mockDB.listings = listings
}

const L = (id, city, nameMm) => ({
  id, name: nameMm, name_mm: nameMm, city,
  rating_avg: 4.5, rating_count: 2,
  category: { name: 'Noodles', name_mm: 'ခေါက်ဆွဲ', icon: '🍜' },
})

beforeEach(() => {
  cleanup()
  mockFetchCategories.mockReset()
  mockDB.cats = [...CATS]
  mockDB.listings = []
  mockDB.singleCategoryCalls = []
  mockDB.offline = false
})

afterEach(() => { cleanup() })

describe('v9.30 groupListingsByCity (pure helper)', () => {
  it('returns [] for empty / null input', () => {
    expect(groupListingsByCity([])).toEqual([])
    expect(groupListingsByCity(null)).toEqual([])
    expect(groupListingsByCity(undefined)).toEqual([])
  })

  it('groups rows by city with correct counts', () => {
    const rows = [L('a', 'Taunggyi', 'A'), L('b', 'Kalaw', 'B'), L('c', 'Taunggyi', 'C')]
    const groups = groupListingsByCity(rows)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toEqual({ city: 'Taunggyi', items: [rows[0], rows[2]] })
    expect(groups[1]).toEqual({ city: 'Kalaw', items: [rows[1]] })
  })

  it('orders by count desc, Taunggyi first on ties, then town name A-Z', () => {
    const rows = [
      L('a', 'Kalaw', 'A'), L('b', 'Aungban', 'B'), L('c', 'Taunggyi', 'C'),
      L('d', 'Nyaungshwe', 'D'), L('e', 'Nyaungshwe', 'E'), L('f', 'Nyaungshwe', 'F'),
    ]
    const cities = groupListingsByCity(rows).map(g => g.city)
    // Nyaungshwe has 3 (most); the three 1-row towns tie — Taunggyi first, then A-Z.
    expect(cities).toEqual(['Nyaungshwe', 'Taunggyi', 'Aungban', 'Kalaw'])
  })

  it('puts rows with no city under Other', () => {
    const rows = [L('a', null, 'A'), L('b', '', 'B'), L('c', 'Taunggyi', 'C')]
    const groups = groupListingsByCity(rows)
    expect(groups.map(g => g.city)).toEqual(['Other', 'Taunggyi'])
    expect(groups[0].items).toHaveLength(2)
  })

  it('keeps the query order inside a group', () => {
    const rows = [L('a', 'Taunggyi', 'First'), L('b', 'Taunggyi', 'Second')]
    expect(groupListingsByCity(rows)[0].items.map(r => r.id)).toEqual(['a', 'b'])
  })
})

describe('v9.30 town headings on the Directory page', () => {
  // NOTE: bare getByText('တောင်ကြီး') matches BOTH the city-filter
  // <option> and the group heading — headings are asserted by role
  // with their full accessible name ("တောင်ကြီး (2)").
  const townHeadings = () =>
    screen.getAllByRole('heading')
      .map(h => h.textContent.replace(/\s+/g, ' ').trim())
      .filter(t => /\(\d+\)$/.test(t))

  it('city=All renders one heading per town with correct counts, most rows first', async () => {
    const client = makeClient()
    seedListingsLevel(client, [
      L('t1', 'Taunggyi', 'ဆိုင် တီ ၁'),
      L('t2', 'Taunggyi', 'ဆိုင် တီ ၂'),
      L('k1', 'Kalaw', 'ဆိုင် ကေ ၁'),
      L('o1', null, 'ဆိုင် အခြား ၁'),
    ])
    renderDirectory(client, ['/directory?cat=c2'])

    await waitFor(() => expect(screen.getByText('ဆိုင် တီ ၁')).toBeTruthy(), { timeout: 5000 })
    // Headings: Taunggyi (2 rows) first, then the 1-row towns A-Z (Kalaw, Other).
    expect(townHeadings()).toEqual(['တောင်ကြီး (2)', 'ကလော (1)', 'အခြား (1)'])
    // Every loaded row still renders under its heading.
    expect(screen.getByText('ဆိုင် ကေ ၁')).toBeTruthy()
    expect(screen.getByText('ဆိုင် အခြား ၁')).toBeTruthy()
  })

  it('a town with no loaded rows shows no heading', async () => {
    const client = makeClient()
    seedListingsLevel(client, [L('t1', 'Taunggyi', 'ဆိုင် တီ ၁')])
    renderDirectory(client, ['/directory?cat=c2'])

    await waitFor(() => expect(screen.getByText('ဆိုင် တီ ၁')).toBeTruthy(), { timeout: 5000 })
    expect(townHeadings()).toEqual(['တောင်ကြီး (1)'])
    expect(screen.queryByRole('heading', { name: /ကလော/ })).toBeNull()
    expect(screen.queryByRole('heading', { name: /အခြား/ })).toBeNull()
  })

  it('a specific city renders flat with no town headings', async () => {
    const client = makeClient()
    seedListingsLevel(client, [
      L('t1', 'Taunggyi', 'ဆိုင် တီ ၁'),
      L('k1', 'Kalaw', 'ဆိုင် ကေ ၁'),
    ])
    renderDirectory(client, ['/directory?cat=c2&city=Kalaw'])

    await waitFor(() => expect(screen.getByText('ဆိုင် တီ ၁')).toBeTruthy(), { timeout: 5000 })
    expect(townHeadings()).toEqual([])
    expect(screen.getByText('ဆိုင် ကေ ၁')).toBeTruthy()
  })

  it('search + sort keep working with grouping on', async () => {
    const client = makeClient()
    seedListingsLevel(client, [
      L('t1', 'Taunggyi', 'ဆိုင် တီ ၁'),
      L('k1', 'Kalaw', 'ဆိုင် ကေ ၁'),
    ])
    renderDirectory(client, ['/directory?cat=c2'])

    await waitFor(() => expect(screen.getByRole('heading', { name: 'တောင်ကြီး (1)' })).toBeTruthy(), { timeout: 5000 })
    // Typing a search term (500ms debounce) must not drop the headings.
    fireEvent.change(screen.getByPlaceholderText('လုပ်ငန်းအမည် ရှာရန်...'), { target: { value: 'ဆိုင်' } })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'ကလော (1)' })).toBeTruthy(), { timeout: 5000 })
    // Changing the sort must not drop the headings either.
    fireEvent.change(screen.getByLabelText('စီရန်'), { target: { value: 'name' } })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'တောင်ကြီး (1)' })).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('ဆိုင် တီ ၁')).toBeTruthy()
  })
})
