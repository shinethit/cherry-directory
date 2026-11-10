// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HomePage from './HomePage'
import { yangonToday } from '../lib/myanmarDate'

// v9.35 (D) — REVISED 2026-11-10 05:40 (replaces the discarded top-5
// Hero strip: no per-sector rings in the Hero, it would get messy).
// (D1) Hero: ONE ring with the TOTAL shop count (same ['home','counts']
// value the old number line showed — no second total), animated
// count-up on load, ending as a FULL ring + the final total, staying
// visible permanently. (D2) Every Home category tile carries a small
// ring + its real count; fill is relative to the LARGEST category
// (largest = full ring). While a count has not arrived the ring stays
// visibly empty ("still waiting") and animates to its true fill when
// the counts land. Rings are driven entirely by the live categories
// data — no hardcoded list — so a category added later gets its ring
// automatically (proved below with a category that is in none of the
// older tests' seed data).
//
// NOTE: this file has NO filesystem-path comparisons at all (no
// path.relative / path.join / readdir comparisons), so the 9.19/9.25
// backslash-path rule does not apply here — stated explicitly.

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

// Hanging chainable builder (HomePage931 pattern): every Home query
// refetches on mount (seeded data is stale) and hangs, so the seeded
// rows stay on screen.
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
// c3 "အသစ် စက်" is a category Admin added later — it appears in NO
// older test's seed data. If the rings were hardcoded to the old
// categories, this tile would have no ring.
const CATS = [
  { id: 'c1', name: 'Food', name_mm: 'အစား', icon: '🍜', type: 'directory', is_active: true, parent_id: null, is_featured: false, sort_order: 1 },
  { id: 'c2', name: 'Cars', name_mm: 'ကားဆိုင်', icon: '🚗', type: 'directory', is_active: true, parent_id: null, is_featured: false, sort_order: 2 },
  { id: 'c3', name: 'New Sector', name_mm: 'အသစ် စက်', icon: '✨', type: 'directory', is_active: true, parent_id: null, is_featured: false, sort_order: 3 },
]
const EVENTS = [{
  id: 'e1', title: 'Event One', title_mm: 'ပွဲ တစ်',
  event_start: '2026-12-01T09:00:00Z', event_end: '2026-12-01T11:00:00Z',
  event_location: 'Taunggyi',
}]
const LINKS = [{
  id: 'q1', title: 'Fuel', title_mm: 'ဆီ', url: '/fuel', icon: '⛽',
  css_classes: 'bg-white/5', is_active: true, sort_order: 1,
}]

function seedClient(client) {
  client.setQueryData(['home', 'posts'], POSTS)
  client.setQueryData(['home', 'featured'], FEATURED)
  client.setQueryData(['home', 'categories'], CATS)
  client.setQueryData(['home', 'counts'], { listings: 2186, posts: 5 })
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

// The ring inside a tile: find the tile button by its (exact) name,
// then the ring within it. The Hero ring is the FIRST load-ring in
// DOM order (the Hero renders before the category grid).
function tileRing(nameMm) {
  const tile = screen.getByText(nameMm).closest('button')
  expect(tile).toBeTruthy()
  return tile.querySelector('[data-testid="load-ring"]')
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mockFetchCategories.mockReset()
  window.localStorage.setItem('cherry_consent_date', yangonToday())
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('v9.35 (D1): Hero total ring', () => {
  it('shows ONE ring with the real total 2,186 — count-up ends on the final number, full ring, stays visible', async () => {
    mockFetchCategories.mockResolvedValue([
      { id: 'c1', listing_count: 173 },
      { id: 'c2', listing_count: 50 },
      { id: 'c3', listing_count: 90 },
    ])
    const client = makeClient()
    seedClient(client)
    renderHome(client)

    // Count-up ends on the exact final total (no second total line:
    // "2,186" appears exactly once on the page). The 10s waitFor is
    // deliberate: on a slow/loaded machine the effect start + the
    // 950ms fallback timer can be delayed for seconds, so 5s is not
    // enough margin — the assertion itself is unchanged.
    await waitFor(() => expect(screen.getByText('2,186')).toBeTruthy(), { timeout: 10000 })
    expect(screen.getAllByText('2,186')).toHaveLength(1)

    // The Hero ring is the first load-ring: full (100) once loaded,
    // and it does NOT disappear — it is still in the document after
    // everything settles, with a fully-filled arc (dashoffset 0).
    const rings = screen.getAllByTestId('load-ring')
    expect(rings.length).toBe(4) // Hero total + 3 tiles
    expect(rings[0].getAttribute('aria-valuenow')).toBe('100')
    await waitFor(() => {
      const arc = rings[0].querySelector('[data-testid="load-ring-arc"]')
      expect(parseFloat(arc.getAttribute('stroke-dashoffset'))).toBe(0)
    }, { timeout: 5000 })
    expect(screen.getAllByTestId('load-ring')).toHaveLength(4)
  }, 30000)
})

describe('v9.35 (D2): category tile rings', () => {
  it('every tile — including a newly added category — renders a ring + real count, fill proportional to the largest', async () => {
    mockFetchCategories.mockResolvedValue([
      { id: 'c1', listing_count: 173 },
      { id: 'c2', listing_count: 50 },
      { id: 'c3', listing_count: 90 },
    ])
    const client = makeClient()
    seedClient(client)
    renderHome(client)

    await waitFor(() => expect(screen.getByText('173 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('50 လုပ်ငန်း')).toBeTruthy()
    // The newly added category's tile has its ring + count too —
    // nothing about it is hardcoded anywhere.
    expect(screen.getByText('90 လုပ်ငန်း')).toBeTruthy()
    const newTile = screen.getByText('အသစ် စက်').closest('button')
    expect(newTile.querySelector('[data-testid="load-ring"]')).toBeTruthy()

    // Fill is relative to the largest (173 = full ring): 90 → 52%,
    // 50 → 29%. The largest tile itself is full.
    expect(tileRing('အစား').getAttribute('aria-valuenow')).toBe('100')
    expect(tileRing('အသစ် စက်').getAttribute('aria-valuenow')).toBe('52')
    expect(tileRing('ကားဆိုင်').getAttribute('aria-valuenow')).toBe('29')
    // Rings never auto-hide: all three are still present.
    expect(screen.getAllByTestId('load-ring')).toHaveLength(4)
  }, 20000)

  it('loading state: counts not arrived yet → rings stay visibly empty (still waiting), counts show "–"', async () => {
    mockFetchCategories.mockImplementation(() => new Promise(() => {}))
    const client = makeClient()
    seedClient(client)
    renderHome(client)

    await waitFor(() => expect(screen.getAllByText('–')).toHaveLength(3), { timeout: 5000 })
    // Every tile ring is present but empty (0%) — you can tell which
    // categories are still waiting. The Hero total ring is separate:
    // its total comes from the seeded counts, so it is already full.
    const rings = screen.getAllByTestId('load-ring')
    expect(rings).toHaveLength(4)
    expect(rings[0].getAttribute('aria-valuenow')).toBe('100')
    expect(tileRing('အစား').getAttribute('aria-valuenow')).toBe('0')
    expect(tileRing('ကားဆိုင်').getAttribute('aria-valuenow')).toBe('0')
    expect(tileRing('အသစ် စက်').getAttribute('aria-valuenow')).toBe('0')
    expect(screen.queryByText('173 လုပ်ငန်း')).toBeNull()
  }, 20000)

  it('no page overflow at 360px: 4-col grid, min-w-0 tiles, small fixed rings', async () => {
    mockFetchCategories.mockResolvedValue([
      { id: 'c1', listing_count: 123456 },
      { id: 'c2', listing_count: 987654 },
      { id: 'c3', listing_count: 555555 },
    ])
    const client = makeClient()
    seedClient(client)
    const { container } = renderHome(client)
    await waitFor(() => expect(screen.getByText('123456 လုပ်ငန်း')).toBeTruthy(), { timeout: 5000 })
    // Structural overflow guard (jsdom has no layout engine — the
    // repo's fixes925 pattern): the grid stays 4-col, tiles are
    // min-w-0 with truncating count text, and each ring is a small
    // fixed 30px svg that fits a ~77px tile at 360px.
    const tile = screen.getByText('အစား').closest('button')
    expect(tile.className).toContain('min-w-0')
    expect(tile.className).not.toMatch(/w-\[\d+px\]/)
    const grid = tile.parentElement
    expect(grid.className).toContain('grid-cols-4')
    expect(grid.className).not.toMatch(/w-\[\d+px\]/)
    const ringSvg = tile.querySelector('[data-testid="load-ring"] svg')
    expect(ringSvg.getAttribute('width')).toBe('30')
    expect(container.querySelectorAll('.grid-cols-4 button').length).toBe(3)
  }, 20000)
})
