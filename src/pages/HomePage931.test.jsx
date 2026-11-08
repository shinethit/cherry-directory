// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HomePage from './HomePage'
import { yangonToday } from '../lib/myanmarDate'

// v9.31 (A): the Home Category grid tiles show a listing count under the
// tile name, wired from the SAME ['categories'] data the Directory page
// reads (fetchCategories — top-level rows + descendant-inclusive
// listing_count, null on a failed count, never a fake 0 — S17).
// The supabase mock hangs (never settles) so the seeded cache is what
// renders; fetchCategories is the mocked module fn, controlled per test.

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
  { id: 'c2', name: 'Cars', name_mm: 'ကား', icon: '🚗', type: 'directory', is_active: true, parent_id: null, is_featured: false, sort_order: 2 },
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
  // Skip the splash: consent recorded for today.
  window.localStorage.setItem('cherry_consent_date', yangonToday())
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('v9.31 (A): Home Category grid tiles show listing counts', () => {
  it('a tile shows its count under the name ("173 လုပ်ငန်း"), 0 shows "မရှိသေး"', async () => {
    mockFetchCategories.mockResolvedValue([
      { id: 'c1', listing_count: 173 },
      { id: 'c2', listing_count: 0 },
    ])
    const client = makeClient()
    seedClient(client)
    renderHome(client)
    // Tile renders from the seeded ['home','categories'] rows; the count
    // arrives from the mocked ['categories'] (fetchCategories) data.
    const countEl = await waitFor(() => screen.getByText('173 လုပ်ငန်း'))
    // The count sits inside the same tile button as the category name.
    expect(countEl.closest('button').textContent).toContain('စား')
    // A genuine 0 renders 'မရှိသေး' — the Directory page's S17 wording —
    // inside the Cars tile, never '0 လုပ်ငန်း'.
    const zeroEl = screen.getByText('မရှိသေး')
    expect(zeroEl.closest('button').textContent).toContain('ကား')
    expect(screen.queryByText('0 လုပ်ငန်း')).toBeNull()
  })

  it('an unknown count shows "–" — never 0 (failed count, and category missing from counts data)', async () => {
    mockFetchCategories.mockResolvedValue([
      // c1's count failed (null, S17); c2 is absent from the counts rows.
      { id: 'c1', listing_count: null },
    ])
    const client = makeClient()
    seedClient(client)
    renderHome(client)
    await waitFor(() => expect(screen.getAllByText('–')).toHaveLength(2))
    // Both tiles still render their names — an unknown count never
    // blanks or disables the tile. (Names are asserted inside the tile
    // buttons: 'စား' also appears in the featured card's category, so a
    // bare getByText would match twice.)
    const dashes = screen.getAllByText('–')
    expect(dashes[0].closest('button').textContent).toContain('စား')
    expect(dashes[1].closest('button').textContent).toContain('ကား')
    expect(screen.queryByText('0 လုပ်ငန်း')).toBeNull()
  })

  it('tiles do not overflow at phone width: grid stays 4-col, tiles min-w-0, count truncates', async () => {
    // A long count string is the overflow risk in a ~70px tile at 360px.
    mockFetchCategories.mockResolvedValue([
      { id: 'c1', listing_count: 123456 },
      { id: 'c2', listing_count: 987654 },
    ])
    const client = makeClient()
    seedClient(client)
    const { container } = renderHome(client)
    const countEl = await waitFor(() => screen.getByText('123456 လုပ်ငန်း'))
    // jsdom has no layout engine, so overflow is asserted structurally
    // (the repo's fixes925 pattern): the classes that guarantee the
    // tile cannot push the grid wider than the viewport.
    const tile = countEl.closest('button')
    expect(tile.className).toContain('min-w-0')
    expect(countEl.className).toContain('truncate')
    expect(countEl.className).toContain('w-full')
    const grid = tile.parentElement
    expect(grid.className).toContain('grid-cols-4')
    // No fixed pixel width anywhere on the tile or the grid.
    expect(tile.className).not.toMatch(/w-\[\d+px\]/)
    expect(grid.className).not.toMatch(/w-\[\d+px\]/)
    // Both tiles render in the same grid row container.
    expect(container.querySelectorAll('.grid-cols-4 button').length).toBe(2)
  })
})
