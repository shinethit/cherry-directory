// @vitest-environment jsdom
// v9.24: Home crashed with `TypeError: ne.has is not a function` —
// useBookmarkedSet's queryFn returned a Set, and the query cache is
// persisted to localStorage as JSON (PersistQueryClientProvider,
// main.jsx; the persister's default serialize is JSON.stringify).
// JSON.stringify(new Set(['a'])) is '{}', so a restored entry was a
// plain object with no .has — Home threw on every load until the entry
// went stale (staleTime 5 min, so even Retry re-crashed). A fresh
// browser (empty localStorage) never saw it. The fix stores an ARRAY
// (JSON-safe) and converts to a Set in `select`, which also normalizes
// legacy '{}' entries to an empty Set. These tests seed the query cache
// with the exact restored shapes and render the same `.has`-in-`.map`
// pattern HomePage uses — they fail before the fix, pass after.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useBookmarkedSet } from './useBookmarksDB'

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: { user: { id: 'u1' } },
}))

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockAuth }))
vi.mock('../lib/errorHandler', () => ({ handleSupabaseError: vi.fn() }))

// Chainable supabase builder: the bookmarks query resolves one row.
function chainable() {
  const builder = {
    select() { return builder },
    eq() { return builder },
    in() { return builder },
    then(resolve) { resolve({ data: [{ target_id: 'a' }], error: null }) },
  }
  return builder
}
vi.mock('../lib/supabase', () => ({ supabase: { from: () => chainable() } }))

const IDS = ['a', 'b']
const KEY = ['bookmarks', 'u1', 'set', 'listing', 'a,b']

// Same pattern as HomePage.jsx:928 — `.has` inside a `.map` on the
// hook's data.
function Probe({ ids }) {
  const { data } = useBookmarkedSet(ids)
  return (
    <ul>
      {ids.map((id) => (
        <li key={id}>{`${id}:${data ? (data.has(id) ? 'yes' : 'no') : 'loading'}`}</li>
      ))}
    </ul>
  )
}

function renderProbe(client) {
  return render(
    <QueryClientProvider client={client}>
      <Probe ids={IDS} />
    </QueryClientProvider>
  )
}

function seededClient(seed) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(KEY, seed)
  return client
}

afterEach(() => { cleanup() })

describe('v9.24: restored persisted bookmark data never throws', () => {
  it("restored '{}' (a Set serialized to JSON by the persister) renders, all unbookmarked", () => {
    renderProbe(seededClient({}))
    expect(screen.getByText('a:no')).toBeTruthy()
    expect(screen.getByText('b:no')).toBeTruthy()
  })

  it("restored array form (the new persisted shape) marks the stored id", () => {
    renderProbe(seededClient(['a']))
    expect(screen.getByText('a:yes')).toBeTruthy()
    expect(screen.getByText('b:no')).toBeTruthy()
  })

  it('fresh fetch stores a JSON-safe array (the persisted form round-trips)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderProbe(client)
    await waitFor(() => expect(screen.getByText('a:yes')).toBeTruthy())
    expect(screen.getByText('b:no')).toBeTruthy()
    const stored = client.getQueryData(KEY)
    expect(Array.isArray(stored)).toBe(true)
    expect(stored).toEqual(['a'])
    expect(JSON.parse(JSON.stringify(stored))).toEqual(['a'])
  })
})
