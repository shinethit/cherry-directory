// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MarketPricePage from './MarketPricePage'

// v9.25 regen #2 (slow network): an error with cached prices keeps the
// list with the small amber strip (never the full error card); the
// header refresh button names the background refetch; a restored cache
// entry missing prices/recent renders without throwing (M-SHAPE guard).

const { queryState, mockRefetch } = vi.hoisted(() => ({
  queryState: { 'market-prices': {} },
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
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: null, isModerator: false }) }))
vi.mock('../contexts/AppConfigContext', () => ({ useAppConfig: () => ({}) }))
vi.mock('../hooks/useSEO', () => ({ useSEO: () => {} }))
vi.mock('../lib/prefetch', () => ({ fetchMarketPrices: vi.fn() }))
vi.mock('../lib/withTimeout', () => ({ withTimeout: (p) => p }))
vi.mock('../lib/confirmDialog', () => ({ confirmDialog: vi.fn(async () => false) }))
vi.mock('../lib/toast', () => ({ showError: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  realtimeEnabled: false,
  supabase: {
    from: () => {
      const b = {
        select: () => b, eq: () => b, order: () => b,
        then: (resolve) => resolve({ data: [], error: null }),
      }
      return b
    },
    channel: () => ({ on: () => ({ on: () => ({ subscribe: () => {} }) }) }),
    removeChannel: () => {},
  },
}))

const PRICES = [
  { id: 'i1', name: 'ဆန်', name_en: 'Rice', category: 'grain', unit: 'ပိဿာ', unit_en: 'viss', icon: '🌾',
    median_price: 5000, report_count: 3, last_reported: '2026-11-07T08:00:00.000Z',
    pct_change_week: 1.2, pct_change_verified: null, min_price: 4800, max_price: 5200,
    verified_price: null, subcategory: '' },
]
const CACHED = { prices: PRICES, recent: [] }

function setMarket(state) {
  queryState['market-prices'] = { data: CACHED, isLoading: false, isFetching: false, isError: false, refetch: mockRefetch, ...state }
}

function renderMarket() {
  return render(
    <MemoryRouter initialEntries={['/market-prices']}>
      <MarketPricePage />
    </MemoryRouter>,
  )
}

afterEach(() => { cleanup() })

describe('MarketPricePage 9.25 slow-network', () => {
  beforeEach(() => { mockRefetch.mockClear() })

  it('error with cached prices keeps the list + amber strip, no error card; strip retry refetches', async () => {
    setMarket({})
    const { rerender } = renderMarket()
    await waitFor(() => expect(screen.getByText('ဆန်')).toBeTruthy())

    setMarket({ data: CACHED, isError: true, error: new Error('slow network') })
    rerender(
      <MemoryRouter initialEntries={['/market-prices']}>
        <MarketPricePage />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText(/အဟောင်းပြထားသည်/)).toBeTruthy())
    expect(screen.getByText('ဆန်')).toBeTruthy()
    expect(screen.queryByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeNull()
    fireEvent.click(screen.getByText('ပြန်ကြိုးစားမည်'))
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('header refresh button says အသစ်ရယူနေသည်… while a background refetch runs', async () => {
    setMarket({ isFetching: true })
    renderMarket()
    await waitFor(() => expect(screen.getByText('ဆန်')).toBeTruthy())
    expect(screen.getByText(/အသစ်ရယူနေသည်/)).toBeTruthy()
  })

  it('restored data missing prices/recent renders without throwing', async () => {
    setMarket({ data: {} })
    renderMarket()
    // No rows, no crash, and no error card (this is not an error state).
    await waitFor(() => expect(screen.getByText('🛒 ဈေးနှုန်းဘုတ်')).toBeTruthy())
    expect(screen.queryByText('ဆန်')).toBeNull()
    expect(screen.queryByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeNull()
  })
})

describe('MarketPrice resolve-with-error guards (v9.25 regen #5)', () => {
  // These paths run through the static supabase mock in this file, so
  // the guards are asserted on the source.
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'MarketPricePage.jsx'), 'utf8')

  it('addMarket re-fetch keeps the last good list on error', () => {
    expect(src).toContain('const { data, error: refetchErr }')
    expect(src).toContain('if (!refetchErr) setList(data || [])')
  })

  it('AddItem dup check fails closed on error (no silent duplicate)', () => {
    expect(src).toContain('const { data: siblings, error: sibErr }')
    expect(src).toContain("if (sibErr) { showError(sibErr.message); return }")
  })

  it('handleVerify latest-price check fails closed on error (no duplicate verify row)', () => {
    expect(src).toContain('const { data: latest, error: latestErr }')
    expect(src).toContain("if (latestErr) { showError(latestErr.message); return }")
  })
})
