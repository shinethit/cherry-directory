// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FuelPage from './FuelPage'

// v9.25 regen #2 (slow network): an error with cached stations keeps the
// list with the small amber strip (never the full error card); a restored
// cache entry missing types/stations renders the empty state without
// throwing (shape guards).

const { queryState, mockRefetch } = vi.hoisted(() => ({
  queryState: { 'fuel-stations': {} },
  mockRefetch: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts) => {
    const key = Array.isArray(opts.queryKey) ? opts.queryKey[0] : opts.queryKey
    const s = queryState[key] || {}
    return {
      data: s.data,
      isLoading: s.isLoading ?? false,
      isFetching: s.isFetching ?? false,
      isError: s.isError ?? false,
      error: s.error,
      refetch: s.refetch || mockRefetch,
    }
  },
}))

vi.mock('../contexts/LangContext', () => ({ useLang: () => ({ lang: 'mm' }) }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ isModerator: false }) }))
vi.mock('../hooks/useSEO', () => ({ useSEO: () => {} }))
vi.mock('../lib/prefetch', () => ({ fetchFuelData: vi.fn() }))
vi.mock('../lib/withTimeout', () => ({ withTimeout: (p) => p }))
vi.mock('../lib/myanmarSearch', () => ({ myanmarVariants: (q) => [q] }))
vi.mock('../lib/confirmDialog', () => ({ confirmDialog: vi.fn(async () => false) }))
vi.mock('../lib/toast', () => ({ showError: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) },
}))

const TYPES = [{ id: 'petrol92', name: 'Petrol 92', name_mm: 'ဓာတ်ဆီ ၉၂', icon: '⛽' }]
const STATIONS = [
  { id: 's1', name: 'Station One', name_mm: 'ဆိုင် ၁', township: 'Taunggyi', address: 'Main Rd',
    phone: '091234', operating_hours: '7-19', notes: '', fuel_type_names: ['Petrol 92'],
    latitude: null, longitude: null },
]
const CACHED = { types: TYPES, stations: STATIONS }

function setFuel(state) {
  queryState['fuel-stations'] = { data: CACHED, isLoading: false, isFetching: false, isError: false, refetch: mockRefetch, ...state }
}

function renderFuel() {
  return render(
    <MemoryRouter initialEntries={['/fuel']}>
      <FuelPage />
    </MemoryRouter>,
  )
}

afterEach(() => { cleanup() })

describe('FuelPage 9.25 slow-network', () => {
  beforeEach(() => { mockRefetch.mockClear() })

  it('error with cached stations keeps the list + amber strip, no error card; strip retry refetches', async () => {
    setFuel({})
    const { rerender } = renderFuel()
    await waitFor(() => expect(screen.getByText('ဆိုင် ၁')).toBeTruthy())

    setFuel({ data: CACHED, isError: true, error: new Error('slow network') })
    rerender(
      <MemoryRouter initialEntries={['/fuel']}>
        <FuelPage />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText(/အဟောင်းပြထားသည်/)).toBeTruthy())
    expect(screen.getByText('ဆိုင် ၁')).toBeTruthy()
    expect(screen.queryByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeNull()
    fireEvent.click(screen.getByText('ပြန်ကြိုးစားမည်'))
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('restored data missing types/stations renders the empty state without throwing', async () => {
    setFuel({ data: {} })
    const { rerender } = renderFuel()
    await waitFor(() => expect(screen.getByText('ဆိုင် မရှိသေးပါ')).toBeTruthy())

    // Types present but stations missing — still no crash.
    setFuel({ data: { types: TYPES, stations: undefined } })
    rerender(
      <MemoryRouter initialEntries={['/fuel']}>
        <FuelPage />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText('ဆိုင် မရှိသေးပါ')).toBeTruthy())
    expect(screen.queryByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeNull()
  })
})

describe('FuelPage admin modal loads: resolve-with-error keeps last-good list (v9.25 regen #5)', () => {
  // The modal loads run through a static supabase mock in this file, so
  // the keep-last-good guard is asserted on the source: a resolve-with-
  // error must throw into the existing catch instead of setList([]).
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'FuelPage.jsx'), 'utf8')

  it('fuel-types load throws on error before setList', () => {
    const i = src.indexOf("supabase.from('fuel_types').select('*')")
    expect(i).toBeGreaterThan(-1)
    expect(src.slice(i, i + 400)).toContain('if (error) throw error')
  })

  it('fuel-stations load throws on error before setList', () => {
    const i = src.indexOf("supabase.from('fuel_stations').select('*')")
    expect(i).toBeGreaterThan(-1)
    expect(src.slice(i, i + 400)).toContain('if (error) throw error')
  })
})
