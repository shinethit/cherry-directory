// @vitest-environment jsdom
// v9.25 slow-network fixes — manual sync button (worker D).
// The Header sync button re-downloads data by hand: tapping it refetches
// every cached query under MANUAL_SYNC_KEYS, shows REAL progress %
// (queries settled / total) on the button, reports success/failure
// plainly, keeps cached data visible on failure, stays usable to retry,
// and never double-fetches while an auto-refresh is in flight.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runManualSync, useManualSync, matchesSyncPrefix, MANUAL_SYNC_KEYS } from './manualSync'

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(srcDir, rel), 'utf8')

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  })
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('runManualSync (v9.25)', () => {
  it('covers the home + section prefixes', () => {
    expect(MANUAL_SYNC_KEYS).toContainEqual(['home'])
    expect(MANUAL_SYNC_KEYS).toContainEqual(['categories'])
    expect(MANUAL_SYNC_KEYS).toContainEqual(['listings'])
    expect(MANUAL_SYNC_KEYS).toContainEqual(['bookmarks'])
    expect(MANUAL_SYNC_KEYS).toContainEqual(['profile-stats'])
    expect(MANUAL_SYNC_KEYS).toContainEqual(['profile-month-points'])
    expect(MANUAL_SYNC_KEYS).toContainEqual(['leaderboard'])
    expect(MANUAL_SYNC_KEYS).toContainEqual(['reviews'])
    expect(MANUAL_SYNC_KEYS).toContainEqual(['market-prices'])
    expect(MANUAL_SYNC_KEYS).toContainEqual(['news'])
    expect(MANUAL_SYNC_KEYS).toContainEqual(['fuel-stations'])
    expect(MANUAL_SYNC_KEYS).toContainEqual(['emergency-contacts'])
    expect(MANUAL_SYNC_KEYS).toContainEqual(['visit-stats'])
  })

  it('matchesSyncPrefix matches by prefix only', () => {
    expect(matchesSyncPrefix(['home', 'posts'])).toBe(true)
    expect(matchesSyncPrefix(['home'])).toBe(true)
    expect(matchesSyncPrefix(['news', '', 30])).toBe(true)
    expect(matchesSyncPrefix(['listings', 'abc'])).toBe(true)
    expect(matchesSyncPrefix(['homepage'])).toBe(false)
    expect(matchesSyncPrefix(['other'])).toBe(false)
  })

  it('no cached queries → total 0, no throw', async () => {
    const client = freshClient()
    const seen = []
    const result = await runManualSync({ client, onProgress: (s, t) => seen.push([s, t]) })
    expect(result).toEqual({ total: 0, settled: 0, failed: 0 })
    expect(seen).toEqual([[0, 0]])
  })
})

// Harness: the same wiring Header.jsx uses — a button driven by
// useManualSync plus three cached queries (fast, slow, failing).
function Harness({ client, hookRef, slowDeferreds, fastCalls, failCalls }) {
  const m = useManualSync()
  if (hookRef) hookRef.current = m
  const fast = useQuery({
    queryKey: ['home', 'posts'],
    queryFn: async () => {
      fastCalls.count += 1
      return [{ id: 1 }]
    },
  })
  useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const d = deferred()
      slowDeferreds.push(d)
      return d.promise
    },
  })
  const failing = useQuery({
    queryKey: ['listings', 'x'],
    queryFn: async () => {
      failCalls.count += 1
      throw new Error('offline')
    },
  })
  return (
    <div>
      <button onClick={m.sync} disabled={m.busy}>
        {m.syncing ? `${m.progress ?? 0}%` : 'Sync'}
      </button>
      {m.status && <div role="status">{m.status}</div>}
      <div>{fast.data ? 'FAST-DATA' : 'NO-FAST'}</div>
      <div>{failing.data ? 'CACHED-DATA' : 'NO-DATA'}</div>
    </div>
  )
}

describe('sync button behaviour (v9.25)', () => {
  it('tapping triggers a refetch, shows real progress %, a failed query keeps cached data and the button stays usable', async () => {
    const client = freshClient()
    client.setQueryData(['listings', 'x'], [{ id: 9 }])
    const slowDeferreds = []
    const fastCalls = { count: 0 }
    const failCalls = { count: 0 }
    render(
      <QueryClientProvider client={client}>
        <Harness client={client} slowDeferreds={slowDeferreds} fastCalls={fastCalls} failCalls={failCalls} />
      </QueryClientProvider>,
    )
    const button = screen.getByRole('button', { name: 'Sync' })
    // Initial mount fetches start (slow one pending) → busy. The first
    // paint happens before the fetch starts, so wait for it.
    await waitFor(() => expect(button.disabled).toBe(true))
    // Let the initial fast + failing fetches settle.
    await waitFor(() => expect(fastCalls.count).toBe(1))
    await waitFor(() => expect(failCalls.count).toBe(1))
    expect(screen.getByText('CACHED-DATA')).toBeTruthy()
    // Resolve the slow initial fetch → nothing in flight → usable.
    slowDeferreds[0].resolve([{ id: 2 }])
    await waitFor(() => expect(button.disabled).toBe(false))

    // Tap sync: fast + failing settle, slow one pending → 2/3 = 67%.
    fireEvent.click(button)
    await waitFor(() => expect(button.textContent).toBe('67%'))
    expect(button.disabled).toBe(true)
    expect(fastCalls.count).toBe(2)
    // Resolve the slow refetch → sync finishes; the failing query
    // counts as failed, so the status reports it plainly.
    slowDeferreds[1].resolve([{ id: 2 }])
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('partial'))
    // Cached data is still visible and the button is usable to retry.
    expect(screen.getByText('CACHED-DATA')).toBeTruthy()
    await waitFor(() => expect(button.disabled).toBe(false))
    expect(button.textContent).toBe('Sync')
  })

  it('a sync tap while an auto-refresh is in flight is ignored (no double-fetch)', async () => {
    const client = freshClient()
    const hookRef = { current: null }
    const unrelated = deferred()
    function GuardHarness() {
      const m = useManualSync()
      hookRef.current = m
      useQuery({
        queryKey: ['unrelated'],
        queryFn: async () => unrelated.promise,
      })
      return <div />
    }
    render(
      <QueryClientProvider client={client}>
        <GuardHarness />
      </QueryClientProvider>,
    )
    // The unrelated fetch is in flight → sync() refuses.
    await waitFor(() => expect(client.isFetching()).toBeGreaterThan(0))
    await expect(hookRef.current.sync()).resolves.toBe(false)
    // Once it drains, the same call works.
    unrelated.resolve('ok')
    await waitFor(() => expect(client.isFetching()).toBe(0))
    await expect(hookRef.current.sync()).resolves.toBe(true)
  })
})

describe('Header wires the sync button (v9.25, source)', () => {
  it('Header imports useManualSync, renders the button with progress % and a result pill', () => {
    const header = read('components/Header.jsx')
    expect(header).toContain("import { useManualSync } from '../lib/manualSync'")
    expect(header).toContain('manualSync.sync')
    expect(header).toContain('aria-label="ဒေတာ ပြန်ဆွဲမည်"')
    expect(header).toContain('manualSync.progress')
    expect(header).toContain('manualSync.status')
    expect(header).toContain('ဒေတာ အသစ် ရပြီ')
    expect(header).toContain('ပြန်ဆွဲမရပါ')
    // Disabled while a sync or any in-flight refetch runs.
    expect(header).toContain('disabled={manualSync.busy}')
  })
})
