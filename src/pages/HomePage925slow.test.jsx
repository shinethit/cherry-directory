// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HomePage from './HomePage'
import LoadProgress from '../components/LoadProgress'
import { yangonToday } from '../lib/myanmarDate'

// v9.25 regen #2 — slow-network Home: useQuery + persisted cache, real
// section-completion progress, stale rendering, per-section failure.
// The supabase mock is controllable per query: each table/filter combo
// gets a deferred the test resolves or rejects, so the test drives the
// progress % with real settled sections instead of asserting a hardcoded
// value. Unresolved deferreds hang — the slow-network case.

const { mockAuth, mockDB } = vi.hoisted(() => ({
  mockAuth: {
    user: null, loading: false, isLoggedIn: false,
    isAdmin: false, isModerator: false,
  },
  mockDB: { deferreds: {} },
}))

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockAuth }))
vi.mock('../contexts/LangContext', () => ({ useLang: () => ({ lang: 'mm' }) }))
vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ app_name: 'Cherry Directory', app_city: 'Taunggyi' }),
}))
vi.mock('../hooks/usePWA', () => ({
  usePWA: () => ({ installable: false, installApp: vi.fn() }),
}))
vi.mock('../lib/toast', () => ({ showError: vi.fn(), showSuccess: vi.fn() }))

// Chainable supabase builder keyed by table + filters + head flag, so the
// 7 loadPartial entries (now 6 useQuery keys + community counts) are
// distinguishable: posts list vs events vs posts count share the 'posts'
// table but differ in filters/head.
vi.mock('../lib/supabase', () => ({
  supabase: {
    from(table) {
      const filters = []
      let head = false
      const b = {
        select(_cols, opts) { if (opts?.head) head = true; return b },
        eq(k, v) { filters.push([k, v, 'eq']); return b },
        neq(k, v) { filters.push([k, v, 'neq']); return b },
        gte() { return b },
        order() { return b },
        limit() { return b },
        in() { return b },
        single() { return b },
        maybeSingle() { return b },
        then(resolve, reject) {
          let key = table
          if (head) key += ':head'
          else if (table === 'posts' && filters.some(([k, v, op]) => k === 'type' && v === 'event' && op === 'eq')) key += ':events'
          else if (table === 'posts' && filters.some(([k, v, op]) => k === 'type' && v === 'event' && op === 'neq')) key += ':posts'
          else if (table === 'listings' && filters.some(([k, v]) => k === 'is_featured' && v === true)) key += ':featured'
          const d = mockDB.deferreds[key]
          const p = d ? d.promise : new Promise(() => {})
          p.then(resolve, reject)
        },
      }
      return b
    },
    rpc() { return Promise.resolve({ data: null, error: null }) },
  },
}))

function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const POSTS = [{
  id: 'p1', title: 'Post One', title_mm: 'သတင်း တစ်', type: 'news',
  status: 'published', created_at: '2026-11-01T00:00:00Z',
  author: { full_name: 'Admin' },
  category: { name: 'News', name_mm: 'သတင်း', icon: '📰' },
}]
const FEATURED = [{
  id: 'l1', name: 'Shop One', name_mm: 'ဆိုင် တစ်', status: 'approved',
  is_featured: true, category: { name: 'Food', name_mm: 'စား', icon: '🍜' },
}]
const CATS = [{
  id: 'c1', name: 'Food', name_mm: 'စား', icon: '🍜', type: 'directory',
  is_active: true, parent_id: null, is_featured: false, sort_order: 1,
}]
const EVENTS = [{
  id: 'e1', title: 'Event One', title_mm: 'ပွဲ တစ်',
  event_start: '2026-12-01T09:00:00Z', event_end: '2026-12-01T11:00:00Z',
  event_location: 'Taunggyi',
}]
const LINKS = [{
  id: 'q1', title: 'Fuel', title_mm: 'ဆီ', url: '/fuel', icon: '⛽',
  css_classes: 'bg-white/5', is_active: true, sort_order: 1,
}]

const ALL_KEYS = [
  'posts:posts', 'listings:featured', 'categories', 'listings:head', 'posts:head',
  'posts:events', 'quick_links', 'rentals:head', 'tutoring:head', 'jobs:head',
]

function resolveAll() {
  mockDB.deferreds['posts:posts'].resolve({ data: POSTS, error: null })
  mockDB.deferreds['listings:featured'].resolve({ data: FEATURED, error: null })
  mockDB.deferreds.categories.resolve({ data: CATS, error: null })
  mockDB.deferreds['listings:head'].resolve({ count: 12, data: null, error: null })
  mockDB.deferreds['posts:head'].resolve({ count: 5, data: null, error: null })
  mockDB.deferreds['posts:events'].resolve({ data: EVENTS, error: null })
  mockDB.deferreds.quick_links.resolve({ data: LINKS, error: null })
  for (const k of ['rentals:head', 'tutoring:head', 'jobs:head']) {
    mockDB.deferreds[k].resolve({ count: 2, data: null, error: null })
  }
}

function seedClient(client) {
  client.setQueryData(['home', 'posts'], POSTS)
  client.setQueryData(['home', 'featured'], FEATURED)
  client.setQueryData(['home', 'categories'], CATS)
  client.setQueryData(['home', 'counts'], { listings: 12, posts: 5 })
  client.setQueryData(['home', 'events'], EVENTS)
  client.setQueryData(['home', 'quick-links'], LINKS)
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderHome(client) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <QueryClientProvider client={client}>
        <HomePage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mockDB.deferreds = {}
  for (const k of ALL_KEYS) mockDB.deferreds[k] = deferred()
  // Skip the splash: consent recorded for today.
  window.localStorage.setItem('cherry_consent_date', yangonToday())
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('LoadProgress: real section-completion %', () => {
  it('shows 2 of 7 sections settled as ~29% (not a hardcoded value)', async () => {
    const client = makeClient()
    mockDB.deferreds['posts:posts'].resolve({ data: POSTS, error: null })
    mockDB.deferreds['listings:featured'].resolve({ data: FEATURED, error: null })
    // Everything else hangs — the slow-network case.
    renderHome(client)
    const bar = await waitFor(() => screen.getByTestId('load-progress'))
    await waitFor(() => expect(bar.textContent).toContain('29%'))
    expect(bar.textContent).toContain('2/7')
    // The bar width is the same real fraction, not a fake spinner.
    expect(bar.querySelector('[role="progressbar"] > div > div')).toBeTruthy()
  })

  it('disappears when all 7 sections settle', async () => {
    const client = makeClient()
    renderHome(client)
    await waitFor(() => expect(screen.getByTestId('load-progress')).toBeTruthy())
    resolveAll()
    await waitFor(() => expect(screen.queryByTestId('load-progress')).toBeNull())
  })

  it('LoadProgress renders nothing once done >= total', () => {
    const { container } = render(<LoadProgress done={7} total={7} />)
    expect(container.innerHTML).toBe('')
    const { container: c2 } = render(<LoadProgress done={3} total={7} />)
    expect(c2.textContent).toContain('43%')
  })
})

describe('stale render: cached Home data while refetching', () => {
  it('renders cached posts + the refetching pill while the refetch hangs', async () => {
    const client = makeClient()
    seedClient(client)
    // Refetch hangs (no deferred resolved) — slow network.
    renderHome(client)
    await waitFor(() => expect(screen.getByText('သတင်း တစ်')).toBeTruthy())
    expect(screen.getByText('အသစ်ရယူနေသည်…')).toBeTruthy()
    // Cached featured + categories render too, no red card.
    expect(screen.getByText('ဆိုင် တစ်')).toBeTruthy()
    expect(screen.queryByText('Data အချို့ တင်မရသေးပါ — ပြန်ကြိုးစားမည်')).toBeNull()
  })

  it('isError with data shows the amber stale strip, not the red card', async () => {
    const client = makeClient()
    seedClient(client)
    renderHome(client)
    await waitFor(() => expect(screen.getByText('သတင်း တစ်')).toBeTruthy())
    // Posts refetch fails; everything else resolves.
    mockDB.deferreds['posts:posts'].reject(new Error('network down'))
    mockDB.deferreds['listings:featured'].resolve({ data: FEATURED, error: null })
    mockDB.deferreds.categories.resolve({ data: CATS, error: null })
    mockDB.deferreds['listings:head'].resolve({ count: 12, data: null, error: null })
    mockDB.deferreds['posts:head'].resolve({ count: 5, data: null, error: null })
    mockDB.deferreds['posts:events'].resolve({ data: EVENTS, error: null })
    mockDB.deferreds.quick_links.resolve({ data: LINKS, error: null })
    await waitFor(() => expect(screen.getByText('အဟောင်းပြထားသည် — အင်တာနက် နှေးနေသည်')).toBeTruthy())
    // Cached post stays visible; the full-page red card never appears.
    expect(screen.getByText('သတင်း တစ်')).toBeTruthy()
    expect(screen.queryByText('Data အချို့ တင်မရသေးပါ — ပြန်ကြိုးစားမည်')).toBeNull()
    // The strip carries a per-section retry.
    expect(screen.getByText('ပြန်ကြိုးစားမည်')).toBeTruthy()
  })
})

describe('loadFavorites resolve-with-error keeps last-good favourites (v9.25 regen #5)', () => {
  const FAV = [{
    id: 'l1', name: 'Fav Shop', name_mm: 'အကြိုက်ဆုံး ဆိုင်', logo_url: null, cover_url: null,
    rating_avg: 5, rating_count: 3, category: { icon: '🍜' },
  }]

  it('bookmarks resolving with { data: null, error } on refresh does not wipe the favourites', async () => {
    mockAuth.user = { id: 'u1' }
    mockAuth.isLoggedIn = true
    mockDB.deferreds.bookmarks = deferred()
    mockDB.deferreds.listings = deferred()
    try {
      const client = makeClient()
      renderHome(client)
      resolveAll()
      mockDB.deferreds.bookmarks.resolve({ data: [{ target_id: 'l1' }], error: null })
      mockDB.deferreds.listings.resolve({ data: FAV, error: null })
      // Last-good favourites render.
      await waitFor(() => expect(screen.getByText('အကြိုက်ဆုံး ဆိုင်')).toBeTruthy())
      // The next load resolves with an error instead of throwing —
      // supabase-js on a dead connection. The header refresh button
      // re-runs loadFavorites (and the home refetches).
      mockDB.deferreds.bookmarks = deferred()
      mockDB.deferreds.bookmarks.resolve({ data: null, error: { message: 'dead connection' } })
      fireEvent.click(screen.getByTitle('Refresh data'))
      await new Promise(r => setTimeout(r, 100))
      // Still there — not wiped to [].
      expect(screen.getByText('အကြိုက်ဆုံး ဆိုင်')).toBeTruthy()
    } finally {
      mockAuth.user = null
      mockAuth.isLoggedIn = false
    }
  })

  it('listings resolving with { data: null, error } on refresh does not wipe the favourites', async () => {
    mockAuth.user = { id: 'u1' }
    mockAuth.isLoggedIn = true
    mockDB.deferreds.bookmarks = deferred()
    mockDB.deferreds.listings = deferred()
    try {
      const client = makeClient()
      renderHome(client)
      resolveAll()
      mockDB.deferreds.bookmarks.resolve({ data: [{ target_id: 'l1' }], error: null })
      mockDB.deferreds.listings.resolve({ data: FAV, error: null })
      await waitFor(() => expect(screen.getByText('အကြိုက်ဆုံး ဆိုင်')).toBeTruthy())
      // Bookmarks still arrive; the listings fetch now resolves-with-error.
      mockDB.deferreds.bookmarks = deferred()
      mockDB.deferreds.bookmarks.resolve({ data: [{ target_id: 'l1' }], error: null })
      mockDB.deferreds.listings = deferred()
      mockDB.deferreds.listings.resolve({ data: null, error: { message: 'dead connection' } })
      fireEvent.click(screen.getByTitle('Refresh data'))
      await new Promise(r => setTimeout(r, 100))
      expect(screen.getByText('အကြိုက်ဆုံး ဆိုင်')).toBeTruthy()
    } finally {
      mockAuth.user = null
      mockAuth.isLoggedIn = false
    }
  })
})

describe('failed section: no data, never "မရှိသေး"', () => {
  it('categories failing with no data shows "တင်မရသေးပါ" + retry', async () => {
    const client = makeClient()
    renderHome(client)
    mockDB.deferreds.categories.reject(new Error('network down'))
    resolveAll()
    await waitFor(() => expect(screen.getByText('တင်မရသေးပါ')).toBeTruthy())
    expect(screen.queryByText('Category မရှိသေး')).toBeNull()
    expect(screen.queryByText('Data အချို့ တင်မရသေးပါ — ပြန်ကြိုးစားမည်')).toBeNull()
    expect(screen.getByText('ပြန်ကြိုးစားမည်')).toBeTruthy()
  })
})
