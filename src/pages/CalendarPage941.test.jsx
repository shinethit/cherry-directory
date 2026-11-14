// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CalendarPage from './CalendarPage'

// v9.41 (B) — Calendar RSVP buttons / toasts in Burmese. Only
// user-visible strings changed: function RsvpButton, rsvp(), the
// event_rsvps table, the 'RSVP counts' timeout label and comments
// are all unchanged.
//
// NOTE: this file has NO filesystem-path comparisons at all, so the
// 9.19/9.25 backslash-path rule does not apply here.

const { mockShowError, mockShowSuccess, STABLE_AUTH } = vi.hoisted(() => ({
  mockShowError: vi.fn(),
  mockShowSuccess: vi.fn(),
  // Stable identity: RsvpButton's load() effect deps on [postId, user],
  // so a fresh user object every render would re-run load() after every
  // click and reset status/counts to the (empty) DB values — the real
  // AuthContext holds a stable user object, the mock must too.
  STABLE_AUTH: { isLoggedIn: true, user: { id: 'u1' }, isModerator: false, isAdmin: false },
}))

const EVENT_START = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
const EVENT = {
  id: 'ev1',
  title: 'Test Event',
  title_mm: 'စမ်းသပ် ပွဲ',
  cover_url: null,
  event_start: EVENT_START,
  event_end: null,
  event_location: 'Taunggyi',
  type: 'event',
  status: 'published',
  author_id: 'someone-else',
  category_id: null,
}

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => STABLE_AUTH,
}))
vi.mock('../contexts/LangContext', () => ({ useLang: () => ({ lang: 'mm' }) }))
vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ app_name: 'Cherry Directory', app_city: 'တောင်ကြီးမြို့' }),
}))
vi.mock('../lib/toast', () => ({ showError: mockShowError, showSuccess: mockShowSuccess }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from(table) {
      const state = { table, maybeSingle: false, limitCalled: false }
      const b = {
        select() { return b },
        eq() { return b },
        is() { return b },
        order() { return b },
        range() { return b },
        limit() { state.limitCalled = true; return b },
        in() { return b },
        or() { return b },
        lt() { return b },
        gte() { return b },
        abortSignal() { return b },
        maybeSingle() { state.maybeSingle = true; return b },
        single() { return b },
        upsert() { return b },
        delete() { return b },
        match() { return b },
        insert() { return b },
        then(resolve) {
          if (state.table === 'event_rsvps') {
            resolve({ data: state.maybeSingle ? null : [], error: null })
            return
          }
          if (state.table === 'posts') {
            // loadUpcoming calls .limit(10); loadEvents does not.
            resolve({ data: state.limitCalled ? [] : [EVENT], error: null })
            return
          }
          resolve({ data: [], error: null })
        },
      }
      return b
    },
  },
}))

function renderCalendar() {
  return render(
    <MemoryRouter initialEntries={['/calendar']}>
      <CalendarPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
})

afterEach(() => { cleanup() })

describe('v9.41 (B) CALENDAR — RSVP buttons in Burmese', () => {
  it('renders "ပါဝင်မည်" / "စိတ်ဝင်စားသည်" buttons and no "Going" / "Interested" in user-visible text', async () => {
    renderCalendar()
    await waitFor(() => expect(screen.getAllByText(/ပါဝင်မည်/).length).toBeGreaterThanOrEqual(1), { timeout: 5000 })
    expect(screen.getAllByText(/စိတ်ဝင်စားသည်/).length).toBeGreaterThanOrEqual(1)
    const body = document.body.textContent
    expect(body).not.toContain('Going')
    expect(body).not.toContain('Interested')
  }, 20000)

  it('tapping ပါဝင်မည် toasts in Burmese; tapping again cancels with a Burmese toast', async () => {
    renderCalendar()
    await waitFor(() => expect(screen.getAllByText(/ပါဝင်မည်/).length).toBeGreaterThanOrEqual(1), { timeout: 5000 })
    fireEvent.click(screen.getAllByText(/ပါဝင်မည်/)[0])
    await waitFor(() => expect(mockShowSuccess).toHaveBeenCalledWith('✓ ပါဝင်မည် အဖြစ် မှတ်ပြီးပါပြီ'), { timeout: 5000 })
    // Tap again — same status cancels the RSVP. The button is
    // disabled while the first tap's request is in flight, so wait
    // for it to re-enable first (the toast fires before setLoading
    // (false) re-renders, so clicking at once hits a disabled button).
    await waitFor(() => expect(screen.getAllByText(/ပါဝင်မည်/)[0].disabled).toBe(false), { timeout: 5000 })
    fireEvent.click(screen.getAllByText(/ပါဝင်မည်/)[0])
    await waitFor(() => expect(mockShowSuccess).toHaveBeenCalledWith('စာရင်း ဖျက်ပြီးပါပြီ'), { timeout: 5000 })
  }, 20000)
})
