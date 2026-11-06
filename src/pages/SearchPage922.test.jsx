// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../contexts/LangContext'
import SearchPage from './SearchPage'

// v9.22 (Bug A, pinned by live capture): the search spinner cleared on
// the FIRST source to resolve — usually one returning [] — so the status
// line showed "0 ရလဒ် တွေ့သည်" with the previous query still in the URL
// while 8 sources were still in flight (live-timed: "0" for ~1.7 s,
// then "5 ရလဒ်"). loading must now stay true until every source
// settles. Regression test with staggered resolves: first source [] fast,
// listings slow with rows — the status must stay "ရှာနေသည်...", never
// "0 ရလဒ်", until all sources settle.
// jsdom + @testing-library/react are devDependencies (added in 9.22);
// vitest's default env is node, so this file opts into jsdom per-file.

// One chainable thenable builder per supabase.from() call, in creation
// order: [0] categories, [1] listing, [2] post, [3] job, [4] rental,
// [5] tutoring, [6] emergency, [7] health, [8] lostfound, [9] notice.
// (The category-listings second query only fires when categories resolve
// non-empty, so it never appears here.)
const { builders } = vi.hoisted(() => ({ builders: [] }))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table) => {
      const builder = {
        select() { return builder },
        or() { return builder },
        abortSignal() { return builder },
        limit() { return builder },
        eq() { return builder },
        in() { return builder },
        then(resolve, reject) {
          builders.push({ table, resolve, reject })
        },
      }
      return builder
    },
  },
}))

beforeEach(() => {
  builders.length = 0
})

describe('Bug A: search status never shows "0 results" while still running', () => {
  it('stays "ရှာနေသည်..." after the first source resolves [] and shows the count only when all sources settle', async () => {
    render(
      <MemoryRouter initialEntries={['/search?q=upper']}>
        <LangProvider>
          <SearchPage />
        </LangProvider>
      </MemoryRouter>
    )

    // The 400 ms debounce fires runSearch: 10 builders register
    // (categories + 9 sources).
    await waitFor(() => expect(builders.length).toBe(10), { timeout: 5000 })
    expect(builders[0].table).toBe('categories')
    expect(builders[1].table).toBe('listings')

    // First source to resolve returns [] — the old code cleared the
    // spinner here and the status line read "0 ရလဒ် တွေ့သည်".
    await act(async () => {
      builders[2].resolve({ data: [], error: null })
    })
    expect(screen.getByText(/ရှာနေသည်/)).toBeTruthy()
    expect(screen.queryByText(/0 ရလဒ် တွေ့သည်/)).toBeNull()

    // The rest settle: listings has 5 rows, everything else [].
    const rows = [1, 2, 3, 4, 5].map((i) => ({
      id: `l${i}`, name: `Shop ${i}`, name_mm: null, address_mm: 'Taunggyi', city: 'Taunggyi',
    }))
    await act(async () => {
      builders[0].resolve({ data: [], error: null })
      builders[1].resolve({ data: rows, error: null })
      for (const i of [3, 4, 5, 6, 7, 8, 9]) builders[i].resolve({ data: [], error: null })
    })

    // Only now — every source settled — does the count appear.
    await waitFor(() => expect(screen.getByText(/5 ရလဒ် တွေ့သည်/)).toBeTruthy(), { timeout: 5000 })
    expect(screen.queryByText(/ရှာနေသည်/)).toBeNull()
    // The 5 listing rows streamed in.
    expect(screen.getByText('Shop 1')).toBeTruthy()
    expect(screen.getByText('Shop 5')).toBeTruthy()
  })
})
