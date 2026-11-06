import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Runtime proof (v9.17 Issue 5): a prefetch run writes
// localStorage['cherry-directory-cache'] and inspectLocalStorage()
// reads it back non-zero. Vitest runs in node env (no jsdom in this
// repo), so the test installs a small in-memory localStorage stub and
// mocks only the network (supabase) — the real queryClient, the real
// persistQueryClient + sync-storage persister, the real runPrefetch
// and the real inspectLocalStorage all execute.
//
// NOTE: createSyncStoragePersister throttles writes by 1000 ms
// (trailing), so the assertions wait 1500 ms after the run — the
// same delay OfflineCachePanel's Re-save applies before re-reading.
vi.mock('./supabase', () => {
  const ROWS = {
    categories: [
      { id: 'c1', name: 'Food', name_mm: 'အစားအသောက်', parent_id: null, type: 'directory', is_active: true, sort_order: 1 },
      { id: 'c2', name: 'Shop', name_mm: 'ဆိုင်', parent_id: null, type: 'directory', is_active: true, sort_order: 2 },
    ],
    listings: [
      { id: 'l1', name: 'Shop A', name_mm: 'ဆိုင်အေ', status: 'approved', category_id: 'c1', rating_avg: 5 },
      { id: 'l2', name: 'Shop B', name_mm: 'ဆိုင်ဘီ', status: 'approved', category_id: 'c2', rating_avg: 4 },
    ],
    fuel_types: [{ id: 'petrol92', name: 'Petrol 92', name_mm: 'ဓာတ်ဆီ ၉၂', sort_order: 1 }],
    fuel_stations: [{ id: 's1', name: 'Station', name_mm: 'ဆိုင်', is_active: true, sort_order: 1, fuel_type_names: ['Petrol 92'] }],
    emergency_contacts: [{ id: 'e1', name: 'Police', name_mm: 'ရဲ', phone_1: '199', is_active: true, sort_order: 1 }],
    current_prices: [{ item_id: 'i1', price: 1000 }],
    posts: [
      { id: 'p1', title: 'News 1', title_mm: 'သတင်း ၁', status: 'published', is_pinned: false, type: 'news', created_at: '2026-11-05T00:00:00Z' },
      { id: 'p2', title: 'Event 1', title_mm: 'ပွဲ ၁', status: 'published', is_pinned: true, type: 'event', created_at: '2026-11-05T00:00:00Z' },
    ],
  }
  function builderFor(table) {
    const rows = ROWS[table] || []
    const b = {}
    for (const m of ['select', 'eq', 'neq', 'is', 'order', 'limit', 'range', 'gte', 'lte', 'gt', 'lt', 'in', 'or', 'ilike', 'not', 'like']) {
      b[m] = () => b
    }
    b.single = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    b.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null })
    b.then = (onF, onR) => Promise.resolve({ data: rows, error: null, count: rows.length }).then(onF, onR)
    return b
  }
  return {
    supabase: {
      from: (table) => builderFor(table),
      rpc: () => {
        const b = {}
        b.then = (onF, onR) => Promise.resolve({
          data: { total: 5, today: 1, this_week: 3, this_month: 5, by_device: [], by_country: [], by_hour: [], daily: [] },
          error: null,
        }).then(onF, onR)
        return b
      },
    },
  }
})

function makeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
    clear: () => { map.clear() },
  }
}

import { queryClient } from './queryClient'
import { persistQueryClient } from '@tanstack/query-persist-client-core'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { runPrefetch, PREFETCH_TASKS } from './prefetch'
import { inspectLocalStorage, getState } from './cacheStatus'

describe('prefetch writes the offline cache (v9.17 Issue 5)', () => {
  let storage
  let stopPersist

  beforeAll(async () => {
    storage = makeStorage()
    globalThis.localStorage = storage
    const persister = createSyncStoragePersister({ storage, key: 'cherry-directory-cache' })
    const [unsubscribe, restore] = persistQueryClient({ queryClient, persister, maxAge: 24 * 60 * 60 * 1000 })
    stopPersist = unsubscribe
    await restore
  })

  afterAll(() => {
    stopPersist?.()
    queryClient.clear()
    delete globalThis.localStorage
  })

  it('runPrefetch fills all 6 keys and inspectLocalStorage reads them back non-zero', async () => {
    const ran = await runPrefetch({ force: true })
    expect(ran).toBe(true)
    // Persister throttle (1000 ms, trailing) — wait for the write to land.
    await new Promise(r => setTimeout(r, 1500))

    const state = getState()
    expect(state.succeeded).toBe(6)
    expect(state.failed).toBe(0)

    const info = inspectLocalStorage()
    expect(info.exists).toBe(true)
    expect(info.size).toBeGreaterThan(0)
    expect(info.queryCount).toBe(6)
    const keys = info.keys.map(k => k.key)
    for (const k of ['categories', 'fuel-stations', 'emergency-contacts', 'market-prices', 'news//30', 'visit-stats']) {
      expect(keys).toContain(k)
    }
    expect(info.keys.every(k => k.hasData)).toBe(true)
  }, 10000)

  it('TASKS contains no leaderboard key (v9.19 — the board is live data, never prefetched)', () => {
    expect(PREFETCH_TASKS.length).toBe(6)
    expect(PREFETCH_TASKS.every(t => !t.key.includes('leaderboard'))).toBe(true)
    expect(PREFETCH_TASKS.map(t => t.key.join('/'))).not.toContain('leaderboard/month')
  })

  it('every TASKS key is the exact key its page reads on mount (v9.19 — no dead cache)', () => {
    // Directory listings + events were dropped: nothing read their keys
    // (per-subcategory / date-range queries cannot be warmed generically).
    // News is warmed as ['news', '', 30] — NewsPage's mount defaults.
    const keys = PREFETCH_TASKS.map(t => t.key.join('/'))
    expect(keys).not.toContain('listings/directory')
    expect(keys).not.toContain('events')
    expect(keys).toContain('news//30')
    expect(PREFETCH_TASKS.find(t => t.key[0] === 'news').queryFn).toBeTypeOf('function')
  })

  it('main.jsx wires PersistQueryClientProvider on the same key + client', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const mainSrc = readFileSync(join(root, 'main.jsx'), 'utf8')
    expect(mainSrc).toContain('PersistQueryClientProvider')
    expect(mainSrc).toContain("key: 'cherry-directory-cache'")
    expect(mainSrc).toContain("from './lib/queryClient'")
    expect(mainSrc).not.toContain('new QueryClient(')
  })

  it('OfflineCachePanel re-saves via runPrefetch and re-reads after the throttle', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'components')
    const panelSrc = readFileSync(join(root, 'OfflineCachePanel.jsx'), 'utf8')
    expect(panelSrc).toContain('runPrefetch')
    expect(panelSrc).toContain('inspectLocalStorage()')
    expect(panelSrc).toContain('ပြန်သိမ်းမည်')
  })
})

describe('fetchMarketPrices shape (v9.20 M-SHAPE)', () => {
  it('returns { prices, recent } — the shape MarketPricePage reads, never a bare array', async () => {
    const { fetchMarketPrices } = await import('./prefetch')
    const out = await fetchMarketPrices()
    // A bare array made setPrices(undefined) crash prices.filter(...) at render.
    expect(Array.isArray(out)).toBe(false)
    expect(out.prices).toEqual([{ item_id: 'i1', price: 1000 }])
    expect(out.recent).toEqual([])
  })

  it('MarketPricePage guards the effect with || [] so prices.filter never sees undefined', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'pages')
    const src = readFileSync(join(root, 'MarketPricePage.jsx'), 'utf8')
    expect(src).toContain('setPrices(marketData.prices || [])')
    expect(src).toContain('setRecent(marketData.recent || [])')
    expect(src).not.toContain('onAdded={load}')
    expect(src).toContain('onAdded={() => refetchPrices()}')
  })
})
