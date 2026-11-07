// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LangProvider } from '../contexts/LangContext'
import ListingDetailPage from './ListingDetailPage'

// v9.25 regen #2 (slow-network): the detail page's error retry must
// soft re-run load() — no window.location.reload() — so a slow-network
// failure retries in place and a recovered listing renders.

const { mockDB } = vi.hoisted(() => ({
  mockDB: {
    listingCalls: 0,
    listing: {
      id: 'l1',
      name: 'Shop 1',
      name_mm: 'ဆိုင် ၁',
      description_mm: 'ဆိုင်အကြောင်း',
      city: 'Taunggyi',
      rating_avg: 4.5,
      rating_count: 2,
      category: { name: 'Food', name_mm: 'အစား', icon: '🍜' },
      owner_id: null,
      submitted_by: null,
      is_verified: false,
      community_votes: 0,
    },
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isLoggedIn: false, profile: null, isAdmin: false, isModerator: false, user: null }),
}))
vi.mock('../hooks/useBookmarksDB', () => ({
  useIsBookmarked: () => ({ data: false, isError: false }),
  useAddBookmark: () => ({ isPending: false, mutate: vi.fn() }),
  useRemoveBookmark: () => ({ isPending: false, mutate: vi.fn() }),
}))
vi.mock('../hooks/useAuditLog', () => ({ useAuditLog: () => ({ log: vi.fn() }) }))
vi.mock('../hooks/useReviews', () => ({
  useDeleteReview: () => ({ mutateAsync: vi.fn() }),
  useCreateReview: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('../lib/toast', () => ({ showError: vi.fn(), showSuccess: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: async () => ({ error: null }),
    from(table) {
      const state = { table, head: false, single: false }
      const b = {
        select(_cols, opts) { if (opts?.head) state.head = true; return b },
        eq() { return b },
        order() { return b },
        limit() { return b },
        range() { return b },
        in() { return b },
        match() { return b },
        maybeSingle() { return b },
        single() { state.single = true; return b },
        then(resolve) {
          if (state.head) { resolve({ count: 0, data: null, error: null }); return }
          if (state.table === 'listings' && state.single) {
            mockDB.listingCalls += 1
            // First load fails (slow network); the retry succeeds.
            if (mockDB.listingCalls === 1) resolve({ data: null, error: { code: 'XX', message: 'boom' } })
            else resolve({ data: mockDB.listing, error: null })
            return
          }
          resolve({ data: [], error: null })
        },
      }
      return b
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockDB.listingCalls = 0
})

afterEach(() => {
  cleanup()
})

describe('v9.25 slow: listing detail retry soft re-runs load()', () => {
  it('shows the error screen on a failed load, and the retry button re-runs load() in place until the listing renders', async () => {
    render(
      <MemoryRouter initialEntries={['/directory/l1']}>
        <LangProvider>
          <Routes>
            <Route path="/directory/:id" element={<ListingDetailPage />} />
          </Routes>
        </LangProvider>
      </MemoryRouter>
    )

    // First load fails → error screen with a retry button.
    await waitFor(() =>
      expect(screen.getByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeTruthy()
    , { timeout: 5000 })
    expect(mockDB.listingCalls).toBe(1)

    // Retry soft re-runs load() — no page reload, listing renders.
    fireEvent.click(screen.getByText('ပြန်ကြိုးစားမည်'))
    await waitFor(() => expect(screen.getByText('ဆိုင် ၁')).toBeTruthy(), { timeout: 5000 })
    expect(mockDB.listingCalls).toBe(2)
    expect(screen.queryByText('Data တင်ရာတွင် အမှားဖြစ်သွားသည်')).toBeNull()
  })

  it('no window.location.reload() call is left in the page (source)', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'ListingDetailPage.jsx'), 'utf8'
    )
    expect(src).not.toContain('window.location.reload()')
    expect(src).toContain('const load = useCallback(async () => {')
    expect(src).toContain('onClick={() => load()}')
    // The hadListing guard that protects the background-refresh case.
    expect(src).toContain('const hadListing = !!listing')
    expect(src).toContain('if (!hadListing) setLoadError(true)')
  })
})
