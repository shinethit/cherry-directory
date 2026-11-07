// Manual sync (v9.25) — the user asked for a Manual Download (Sync)
// button (2026-11-07): after a slow-network load leaves data stale,
// tap it to re-download/sync by hand instead of waiting for auto-retry.
// It refetches every cached query under the prefixes below and reports
// REAL progress (queries settled / total). It never throws and never
// crash-screens: a failed refetch keeps the cached data visible and the
// button stays available to retry. The tap guard lives in useManualSync
// (disabled while a sync or any in-flight refetch is running), so a
// manual sync can never double-fetch against an auto-refresh.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { queryClient } from './queryClient'

// Query-key prefixes to re-sync. ['home'] covers all six Home keys
// (['home','posts'], ['home','featured'], …); the rest are the
// prefetch-warmed keys plus the other cached sections.
export const MANUAL_SYNC_KEYS = [
  ['home'],
  ['categories'],
  ['listings'],
  ['bookmarks'],
  ['profile-stats'],
  ['profile-month-points'],
  ['leaderboard'],
  ['reviews'],
  ['market-prices'],
  ['news'],
  ['fuel-stations'],
  ['emergency-contacts'],
  ['visit-stats'],
]

function queryKeyStartsWith(queryKey, prefix) {
  if (!Array.isArray(queryKey)) return false
  return prefix.every((segment, i) => queryKey[i] === segment)
}

export function matchesSyncPrefix(queryKey) {
  return MANUAL_SYNC_KEYS.some((prefix) => queryKeyStartsWith(queryKey, prefix))
}

// Refetch every cached, fetchable query under the sync prefixes.
// onProgress(settled, total) fires per settled query (0 first, so the
// button can show 0% immediately). Returns { total, settled, failed }.
// Never throws: per-query failures are counted, not raised — the cached
// data stays visible either way. Queries with no queryFn (seeded via
// setQueryData only) are skipped — there is nothing to refetch.
export async function runManualSync({ client = queryClient, onProgress } = {}) {
  const matched = client
    .getQueryCache()
    .findAll()
    .filter((query) => matchesSyncPrefix(query.queryKey) && typeof query.options?.queryFn === 'function')
  const total = matched.length
  let settled = 0
  onProgress?.(0, total)
  if (total === 0) return { total: 0, settled: 0, failed: 0 }
  const results = await Promise.allSettled(
    matched.map(async (query) => {
      try {
        // throwOnError: true so a failed refetch rejects here and is
        // counted — the default (swallow) would report every sync as
        // a success even when the network dropped it.
        await client.refetchQueries({ queryKey: query.queryKey, exact: true }, { throwOnError: true })
      } finally {
        settled += 1
        onProgress?.(settled, total)
      }
    }),
  )
  const failed = results.filter((r) => r.status === 'rejected').length
  return { total, settled, failed }
}

// Header sync-button state. busy is true while a manual sync is running
// OR any fetch is in flight (useIsFetching, reactive) — the button is
// disabled then, so a tap can never double-fetch against auto-refresh.
// status is 'ok' | 'partial' | 'error' | null and clears itself after
// ~4 s; progress is 0–100 while syncing, null otherwise.
export function useManualSync() {
  const client = useQueryClient()
  const fetchingCount = useIsFetching()
  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState(null)
  const [status, setStatus] = useState(null)
  const statusTimer = useRef(null)

  useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current)
    },
    [],
  )

  const busy = syncing || fetchingCount > 0

  const sync = useCallback(async () => {
    if (syncing) return false
    // Second guard (the button is already disabled while busy): a tap
    // racing an auto-refresh that started a moment ago is ignored.
    if (client.isFetching() > 0) return false
    setSyncing(true)
    setStatus(null)
    setProgress(0)
    try {
      const { total, failed } = await runManualSync({
        client,
        onProgress: (settled, totalCount) =>
          setProgress(totalCount ? Math.round((settled / totalCount) * 100) : 100),
      })
      setProgress(100)
      setStatus(failed > 0 ? (failed === total ? 'error' : 'partial') : 'ok')
      return failed === 0
    } catch {
      // runManualSync never throws; this is belt-and-braces so the
      // button can never get stuck in the syncing state.
      setStatus('error')
      return false
    } finally {
      setSyncing(false)
      if (statusTimer.current) clearTimeout(statusTimer.current)
      statusTimer.current = setTimeout(() => {
        setStatus(null)
        setProgress(null)
      }, 4000)
    }
  }, [client, syncing])

  return { sync, busy, syncing, progress, status }
}
