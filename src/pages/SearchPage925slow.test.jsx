// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../contexts/LangContext'
import SearchPage from './SearchPage'

// v9.25 regen #2 (slow-network): a failed/slow search must keep the
// previous query's results on screen (not wipe them with empty arrays),
// show the error status with a retry button, and the retry must re-run
// the same search. Follows the SearchPage922.test.jsx builder pattern.

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

afterEach(() => {
  cleanup()
})

const rowsFor = (prefix, n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    name: `Shop ${i + 1}`,
    name_mm: null,
    address_mm: 'Taunggyi',
    city: 'Taunggyi',
  }))

async function settleRun(startIndex, { listingRows = [], errorAll = false } = {}) {
  await waitFor(() => expect(builders.length).toBe(startIndex + 10), { timeout: 5000 })
  await act(async () => {
    builders[startIndex].resolve({ data: [], error: null })
    if (errorAll) {
      for (let i = startIndex + 1; i < startIndex + 10; i++) {
        builders[i].resolve({ data: null, error: { message: 'boom' } })
      }
    } else {
      builders[startIndex + 1].resolve({ data: listingRows, error: null })
      for (let i = startIndex + 2; i < startIndex + 10; i++) {
        builders[i].resolve({ data: [], error: null })
      }
    }
  })
}

describe('v9.25 slow: failed search keeps previous results + retry', () => {
  it('a failed run restores the last good results, shows a retry button, and retry re-runs the search', async () => {
    render(
      <MemoryRouter initialEntries={['/search?q=upper']}>
        <LangProvider>
          <SearchPage />
        </LangProvider>
      </MemoryRouter>
    )

    // First search succeeds: 2 listing rows.
    await settleRun(0, { listingRows: rowsFor('l', 2) })
    await waitFor(() => expect(screen.getByText(/2 ရလဒ် တွေ့သည်/)).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('Shop 1')).toBeTruthy()
    expect(screen.getByText('Shop 2')).toBeTruthy()

    // Second query — every source fails (slow network).
    fireEvent.change(screen.getByDisplayValue('upper'), { target: { value: 'house' } })
    await settleRun(10, { errorAll: true })

    // Error status shows, but the previous query's rows stay on screen.
    await waitFor(() =>
      expect(screen.getByText(/ရှာဖွေရာတွင် အမှားဖြစ်သွားသည်/)).toBeTruthy()
    , { timeout: 5000 })
    expect(screen.getByText('Shop 1')).toBeTruthy()
    expect(screen.getByText('Shop 2')).toBeTruthy()
    expect(screen.queryByText(/ရလဒ် မတွေ့ပါ/)).toBeNull()

    // Retry button re-runs the same search…
    const retry = screen.getByText('ပြန်ကြိုးစားမည်')
    expect(builders.length).toBe(20)
    await act(async () => { fireEvent.click(retry) })
    await settleRun(20, { listingRows: [{ id: 'h1', name: 'House Shop', name_mm: null, address_mm: 'Taunggyi', city: 'Taunggyi' }] })

    // …and the new results replace the old ones.
    await waitFor(() => expect(screen.getByText(/1 ရလဒ် တွေ့သည်/)).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('House Shop')).toBeTruthy()
    expect(screen.queryByText('Shop 1')).toBeNull()
    expect(screen.queryByText(/ရှာဖွေရာတွင် အမှားဖြစ်သွားသည်/)).toBeNull()
  })
})
