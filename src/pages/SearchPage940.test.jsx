// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from '../contexts/LangContext'
import SearchPage from './SearchPage'

// v9.40 (E): Search category-name search already resolves ANY depth
// (it queries the categories table fresh) — pin that a level-3
// category name finds its listings: "General" matches General
// Hospital (Health -> Hospital -> General Hospital) and the row
// filed under it appears. Follows the SearchPage922.test.jsx
// builder pattern.
//
// NOTE: this file has NO filesystem-path comparisons at all, so the
// 9.19/9.25 backslash-path rule does not apply here — stated
// explicitly per the brief.

const GEN_ID = 'general-id'

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

describe('v9.40 (E) Search finds a level-3 category by name', () => {
  it('"General" matches General Hospital (level 3) and shows its listing', async () => {
    render(
      <MemoryRouter initialEntries={['/search?q=General']}>
        <LangProvider>
          <SearchPage />
        </LangProvider>
      </MemoryRouter>
    )

    // The 400 ms debounce fires runSearch: 10 builders register
    // (categories + 9 sources).
    await waitFor(() => expect(builders.length).toBe(10), { timeout: 5000 })
    expect(builders[0].table).toBe('categories')

    // The categories query matches the level-3 id — the category
    // search is a plain table query, so depth does not matter.
    await act(async () => {
      builders[0].resolve({ data: [{ id: GEN_ID }], error: null })
    })

    // The category-listings follow-up query appears (11th builder).
    await waitFor(() => expect(builders.length).toBe(11), { timeout: 5000 })
    expect(builders[10].table).toBe('listings')

    const genRow = {
      id: 'general-row-0', name: 'General 1', name_mm: 'General 1',
      address_mm: 'Taunggyi', city: 'Taunggyi',
    }
    await act(async () => {
      for (let i = 1; i < 10; i++) builders[i].resolve({ data: [], error: null })
      builders[10].resolve({ data: [genRow], error: null })
    })

    await waitFor(() => expect(screen.getByText('General 1')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText(/1 ရလဒ် တွေ့သည်/)).toBeTruthy()
  }, 20000)
})
