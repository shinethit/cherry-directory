// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import HomePage from './HomePage'
import BottomNav from '../components/BottomNav'
import { APP_VERSION } from '../lib/appVersion'
import pkg from '../../package.json'
import { yangonToday } from '../lib/myanmarDate'

// v9.33: the Home screen shows the running bundle's version directly —
// zero taps (user request 2026-11-09: it took several taps to find it).
// The label is wired to APP_VERSION (src/lib/appVersion.js, which reads
// package.json at build/import time — the same source Header, SplashScreen
// and InfoPages use), never a hardcoded string, so a stale PWA shows its
// own version (e.g. v9.30 while live is v9.32) and it auto-updates each
// release with no extra release step. Harness copied from HomePage931:
// the supabase mock hangs (never settles) so the seeded cache renders.

const { mockFetchCategories } = vi.hoisted(() => ({
  mockFetchCategories: vi.fn(),
}))

vi.mock('../lib/prefetch', () => ({ fetchCategories: mockFetchCategories }))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false, isLoggedIn: false, isAdmin: false, isModerator: false }),
}))
vi.mock('../contexts/LangContext', () => ({ useLang: () => ({ lang: 'mm' }) }))
vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ app_name: 'Cherry Directory', app_city: 'Taunggyi' }),
}))
vi.mock('../hooks/usePWA', () => ({
  usePWA: () => ({ installable: false, installApp: vi.fn() }),
}))
vi.mock('../lib/toast', () => ({ showError: vi.fn(), showSuccess: vi.fn() }))

// Hanging chainable builder: every Home query refetches on mount (seeded
// data is stale) and hangs, so the seeded rows stay on screen.
vi.mock('../lib/supabase', () => ({
  supabase: {
    from() {
      const b = {
        select() { return b },
        eq() { return b },
        neq() { return b },
        gte() { return b },
        order() { return b },
        limit() { return b },
        in() { return b },
        is() { return b },
        single() { return b },
        maybeSingle() { return b },
        then() { return new Promise(() => {}) },
      }
      return b
    },
    rpc() { return Promise.resolve({ data: null, error: null }) },
  },
}))

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
const CATS = [
  { id: 'c1', name: 'Food', name_mm: 'စား', icon: '🍜', type: 'directory', is_active: true, parent_id: null, is_featured: false, sort_order: 1 },
]
const EVENTS = [{
  id: 'e1', title: 'Event One', title_mm: 'ပွဲ တစ်',
  event_start: '2026-12-01T09:00:00Z', event_end: '2026-12-01T11:00:00Z',
  event_location: 'Taunggyi',
}]
const LINKS = [
  // The 5 live quick-link rows (admin-managed quick_links table):
  // News, Market Prices, Add Business, Emergency, Public Chat.
  { id: 'q1', title: 'News & Events', title_mm: 'သတင်းများ', url: '/news', icon: '📰', css_classes: 'bg-white/5', is_active: true, sort_order: 1 },
  { id: 'q2', title: 'Market Prices', title_mm: 'ဈေးနှုန်းဘုတ်', url: '/prices', icon: '🛒', css_classes: 'bg-white/5', is_active: true, sort_order: 2 },
  { id: 'q3', title: 'Submit Listing', title_mm: 'လုပ်ငန်းထည့်မယ်', url: '/submit', icon: '➕', css_classes: 'bg-white/5', is_active: true, sort_order: 3 },
  { id: 'q4', title: 'Emergency', title_mm: 'အရေးပေါ်', url: '/emergency', icon: '🆘', css_classes: 'bg-white/5', is_active: true, sort_order: 4 },
  { id: 'q5', title: 'Public Chat', title_mm: 'Public Chat', url: '/chat', icon: '💬', css_classes: 'bg-white/5', is_active: true, sort_order: 5 },
]

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
  mockFetchCategories.mockReset()
  mockFetchCategories.mockResolvedValue([{ id: 'c1', listing_count: 12 }])
  // Skip the splash: consent recorded for today.
  window.localStorage.setItem('cherry_consent_date', yangonToday())
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('v9.33: Home shows the running version directly (zero taps)', () => {
  it('renders a "vX.Y" label matching the package.json version', async () => {
    // The version source is package.json itself — no hardcoded literal
    // in the test or the component: APP_VERSION must equal pkg.version.
    expect(APP_VERSION).toBe(pkg.version)
    expect(APP_VERSION).toMatch(/^\d+\.\d+$/)
    const client = makeClient()
    seedClient(client)
    renderHome(client)
    const label = await waitFor(() => screen.getByTestId('home-version-label'))
    expect(label.textContent).toBe(`v${pkg.version}`)
    expect(label.textContent).toBe(`v${APP_VERSION}`)
  })

  it('the label is plain non-interactive muted text, not a button', async () => {
    const client = makeClient()
    seedClient(client)
    renderHome(client)
    const label = await waitFor(() => screen.getByTestId('home-version-label'))
    // Clearly a label, not tappable: a <p>, never a button/link, no
    // onClick handler (no cursor-pointer / button classes), muted text.
    expect(label.tagName).toBe('P')
    expect(label.closest('button')).toBeNull()
    expect(label.closest('a')).toBeNull()
    expect(label.getAttribute('onClick')).toBeNull()
    expect(label.className).toContain('text-white/40')
    expect(label.className).not.toContain('cursor-pointer')
    // It sits in the top Home header, under the city line — visible on
    // load with zero taps / zero scrolling, not down in the footer.
    const header = label.closest('.flex.justify-between')
    expect(header).not.toBeNull()
    expect(header.textContent).toContain('Cherry Directory')
  })

  it('does not overflow at 360px: truncating, wrapping parent, no fixed width', async () => {
    const client = makeClient()
    seedClient(client)
    renderHome(client)
    const label = await waitFor(() => screen.getByTestId('home-version-label'))
    // jsdom has no layout engine, so overflow is asserted structurally
    // (the repo's fixes925 pattern): the classes that guarantee the
    // label cannot push the header wider than the viewport.
    expect(label.className).toContain('truncate')
    expect(label.className).not.toMatch(/w-\[\d+px\]/)
    expect(label.className).not.toMatch(/whitespace-nowrap/)
    const parent = label.parentElement
    expect(parent.className).toContain('min-w-0')
    expect(parent.className).not.toMatch(/w-\[\d+px\]/)
  })

  it('the label follows the version source: a changed APP_VERSION changes the label', async () => {
    // Simulate the next release / a stale bundle: re-import HomePage
    // with APP_VERSION mocked to a different value and the label must
    // follow it — proving the component reads the source, not a literal.
    // Last test in this file: the module registry is reset here.
    cleanup()
    vi.resetModules()
    vi.doMock('../lib/appVersion', () => ({ APP_VERSION: '9.99', default: '9.99' }))
    const { default: FreshHome } = await import('./HomePage')
    const client = makeClient()
    seedClient(client)
    render(
      <MemoryRouter initialEntries={['/']}>
        <QueryClientProvider client={client}>
          <FreshHome />
        </QueryClientProvider>
      </MemoryRouter>,
    )
    const label = await waitFor(() => screen.getByTestId('home-version-label'))
    expect(label.textContent).toBe('v9.99')
    vi.doUnmock('../lib/appVersion')
  })
})

describe('v9.33: Home quick access is 3 tiles in ONE row', () => {
  it('renders exactly News, Market Prices, Public Chat — SOS + Add Business tiles are gone', async () => {
    const client = makeClient()
    seedClient(client)
    renderHome(client)
    const grid = await waitFor(() => screen.getByTestId('home-quick-access'))
    const tiles = within(grid).getAllByRole('button')
    expect(tiles).toHaveLength(3)
    // The 3 kept tiles, in DB sort order.
    expect(within(grid).getByText('သတင်းများ')).toBeTruthy()
    expect(within(grid).getByText('ဈေးနှုန်းဘုတ်')).toBeTruthy()
    expect(within(grid).getByText('Public Chat')).toBeTruthy()
    // The 2 removed tiles are absent from quick access — even though
    // all 5 rows are still in the seeded quick_links data.
    expect(within(grid).queryByText('လုပ်ငန်းထည့်မယ်')).toBeNull()
    expect(within(grid).queryByText('အရေးပေါ်')).toBeNull()
    expect(within(grid).queryByText('🆘')).toBeNull()
  })

  it('the 3 tiles fit one row at 360px: grid-cols-3, 3 children, no fixed width', async () => {
    const client = makeClient()
    seedClient(client)
    renderHome(client)
    const grid = await waitFor(() => screen.getByTestId('home-quick-access'))
    // jsdom has no layout engine, so overflow is asserted structurally
    // (the repo's fixes925 pattern): grid-cols-3 with exactly 3
    // children is one row by construction; nothing may force it wider.
    expect(grid.className).toContain('grid-cols-3')
    expect(grid.children.length).toBe(3)
    expect(grid.className).not.toMatch(/w-\[\d+px\]/)
    for (const tile of grid.children) {
      expect(tile.className).not.toMatch(/w-\[\d+px\]/)
      expect(tile.className).not.toContain('whitespace-nowrap')
      // Long titles wrap/clamp instead of pushing the tile wider.
      expect(tile.querySelector('p').className).toContain('line-clamp-2')
    }
  })

  it('SOS is still reachable: header menu links /emergency (and the Home Hero keeps its SOS button)', async () => {
    // Source guard in the repo's fixes92x style: the menu entry that
    // keeps Emergency one tap away after the quick-access tile is gone.
    const srcDir = dirname(fileURLToPath(import.meta.url))
    const headerSrc = readFileSync(join(srcDir, '..', 'components', 'Header.jsx'), 'utf8')
    expect(headerSrc).toContain("{ path: '/emergency', label: 'အရေးပေါ် 🆘'")
    // And the Home Hero's own 🆘 button still renders on Home itself.
    const client = makeClient()
    seedClient(client)
    renderHome(client)
    await waitFor(() => screen.getByTestId('home-version-label'))
    expect(screen.getByText('🆘 အရေးပေါ်')).toBeTruthy()
  })

  it('the floating submit button is still present on Home and opens /submit', async () => {
    // BottomNav is app-global (App.jsx renders it on every route) and
    // its floating "တင်မည်" button shows on Home ('/', not '/chat').
    render(
      <MemoryRouter initialEntries={['/']}>
        <BottomNav />
      </MemoryRouter>,
    )
    const fab = await waitFor(() => screen.getByLabelText('လုပ်ငန်း တင်မည်'))
    expect(fab.getAttribute('href')).toBe('/submit')
    expect(fab.textContent).toContain('တင်မည်')
  })
})
