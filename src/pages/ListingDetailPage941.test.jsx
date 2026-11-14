// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../contexts/LangContext'
import ListingDetailPage from './ListingDetailPage'

// v9.41 CORRECTION 2 — the listing Report flow speaks Burmese like
// its trigger button ("🚩 ဤလုပ်ငန်းကို တိုင်ကြားမည်") and done-state
// ("✓ တိုင်ကြားပြီးပါပြီ") already did: form title, reason
// placeholder, submit button and both toasts use တိုင်ကြား, and no
// "Report" remains in the Report form / toast user-visible strings.
// (Code identifiers — reporting/reportReason/handleReport, the
// 'reports' table — and comments are unchanged.)
//
// Render pattern copied from ListingDetailPage925slow.test.jsx.
//
// NOTE: this file has NO filesystem-path comparisons at all, so the
// 9.19/9.25 backslash-path rule does not apply here.

const { mockShowError, mockShowSuccess, mockDB } = vi.hoisted(() => ({
  mockShowError: vi.fn(),
  mockShowSuccess: vi.fn(),
  mockDB: {
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
vi.mock('../lib/toast', () => ({ showError: mockShowError, showSuccess: mockShowSuccess }))

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
        insert() { return b },
        then(resolve) {
          if (state.head) { resolve({ count: 0, data: null, error: null }); return }
          if (state.table === 'listings' && state.single) {
            resolve({ data: mockDB.listing, error: null })
            return
          }
          // reports.insert(...) and every other query: success, no rows.
          resolve({ data: [], error: null })
        },
      }
      return b
    },
  },
}))

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/directory/l1']}>
      <LangProvider>
        <Routes>
          <Route path="/directory/:id" element={<ListingDetailPage />} />
        </Routes>
      </LangProvider>
    </MemoryRouter>
  )
}

async function openReportForm() {
  renderDetail()
  await waitFor(() => expect(screen.getByText('ဆိုင် ၁')).toBeTruthy(), { timeout: 5000 })
  fireEvent.click(screen.getByText('🚩 ဤလုပ်ငန်းကို တိုင်ကြားမည်'))
  await waitFor(() => expect(screen.getByText('ဤလုပ်ငန်းကို တိုင်ကြားမည်')).toBeTruthy(), { timeout: 5000 })
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

afterEach(() => { cleanup() })

describe('v9.41 CORRECTION 2 — listing Report flow in Burmese (တိုင်ကြား)', () => {
  it('form title, reason placeholder and submit button use တိုင်ကြား; no "Report" in the form', async () => {
    await openReportForm()
    expect(screen.getByPlaceholderText('တိုင်ကြားရသည့် အကြောင်းရင်း...')).toBeTruthy()
    expect(screen.getByText('တိုင်ကြားမည်')).toBeTruthy()
    // The whole rendered page carries no user-visible "Report" in
    // this flow (identifiers/comments/console are code, not UI).
    expect(document.body.textContent).not.toContain('Report')
  }, 20000)

  it('submitting toasts "တိုင်ကြားပြီးပါပြီ — Admin မှ စစ်ဆေးမည်" and shows the တိုင်ကြားပြီးပါပြီ done-state', async () => {
    await openReportForm()
    fireEvent.change(screen.getByPlaceholderText('တိုင်ကြားရသည့် အကြောင်းရင်း...'), { target: { value: 'ဆိုင်ပိတ်သွားပြီ' } })
    fireEvent.click(screen.getByText('တိုင်ကြားမည်'))
    await waitFor(() => expect(mockShowSuccess).toHaveBeenCalledWith('တိုင်ကြားပြီးပါပြီ — Admin မှ စစ်ဆေးမည်'), { timeout: 5000 })
    await waitFor(() => expect(screen.getByText('✓ တိုင်ကြားပြီးပါပြီ — Admin မှ စစ်ဆေးမည်')).toBeTruthy(), { timeout: 5000 })
  }, 20000)
})
