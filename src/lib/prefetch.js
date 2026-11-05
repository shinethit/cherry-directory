// Background prefetch — v9.17 (Issue 4 / Issue 5). Under VPN every page
// mount re-fetched from the network (only 3 hooks used useQuery), so
// browsing felt slow; and the Offline panel always showed 0 because
// nothing ever wrote localStorage['cherry-directory-cache'].
// This runner warms the React Query cache (persisted to localStorage by
// PersistQueryClientProvider in main.jsx) on idle after boot and on
// visibilitychange, so pages render cached data instantly and revalidate
// quietly. Every task is per-query withTimeout(15 s) + allSettled style:
// one slow/failed task never blocks the rest or the UI, and runPrefetch
// never throws. Progress is reported via cacheStatus so the Profile
// Offline panel shows real counts. The fetchers below are the single
// source of truth — the pages import them for their useQuery queryFns,
// so prefetch and page always ask for the same data.
import { queryClient } from './queryClient'
import { supabase } from './supabase'
import { withTimeout } from './withTimeout'
import { startRun, recordItem, finishRun, failRun } from './cacheStatus'

// ── Fetchers (shared with the pages) ──────────────────────────

// Directory categories with listing counts (same query as
// DirectoryPage.loadCategories: one tree fetch + one count per
// top-level category, best-effort counts).
export async function fetchCategories() {
  const { data, error } = await withTimeout(supabase
    .from('categories')
    .select('*')
    .eq('type', 'directory')
    .eq('is_active', true)
    .is('parent_id', null)
    .order('sort_order'), 30000, 'Directory categories')
  if (error) throw error
  const { data: allCats } = await withTimeout(supabase
    .from('categories')
    .select('id, parent_id')
    .eq('type', 'directory')
    .eq('is_active', true), 30000, 'Directory category tree').catch(() => ({ data: [] }))
  const collectDescendantIds = (all, rootId) => {
    const ids = [rootId]
    let frontier = [rootId]
    while (frontier.length) {
      const next = (all || []).filter(c => frontier.includes(c.parent_id)).map(c => c.id)
      ids.push(...next)
      frontier = next
    }
    return ids
  }
  const countResults = await Promise.allSettled(
    (data || []).map(async (cat) => {
      const ids = collectDescendantIds(allCats || [], cat.id)
      const { count } = await withTimeout(supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .in('category_id', ids)
        .eq('status', 'approved'), 30000, 'Directory category count')
      return { ...cat, listing_count: count || 0 }
    })
  )
  return countResults.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { ...(data || [])[i], listing_count: null })
}

// Default directory browse (top approved listings, rating order) —
// the ['listings','directory'] cache entry. Per-category pages use the
// same base key plus their filter params.
export async function fetchDirectoryListings() {
  const { data, error } = await withTimeout(supabase
    .from('listings')
    .select('*, category:categories(name, name_mm, icon)')
    .eq('status', 'approved')
    .order('rating_avg', { ascending: false, nullsFirst: false })
    .order('name', { ascending: true })
    .range(0, 19), 30000, 'Directory listings')
  if (error) throw error
  return data || []
}

// Fuel stations + types, merged exactly like FuelPage.load did.
export async function fetchFuelData() {
  const [ftRes, stRes] = await withTimeout(Promise.allSettled([
    supabase.from('fuel_types').select('*').order('sort_order'),
    supabase.from('fuel_stations').select('*').eq('is_active', true).order('sort_order'),
  ]), 30000, 'Fuel stations')
  if (stRes.status === 'rejected' || stRes.value?.error) {
    throw (stRes.status === 'rejected' ? stRes.reason : stRes.value.error)
  }
  const types = (ftRes.status === 'fulfilled' && !ftRes.value.error) ? (ftRes.value.data || []) : []
  const stations = (stRes.value.data || []).map(s => ({
    id: s.id,
    name: s.name,
    name_mm: s.name_mm,
    township: s.township,
    address: s.address,
    notes: s.notes,
    operating_hours: s.operating_hours,
    phone: s.phone,
    latitude: s.latitude,
    longitude: s.longitude,
    fuel_type_names: s.fuel_type_names || [],
  }))
  return { types, stations }
}

export async function fetchEmergencyContacts() {
  const { data, error } = await withTimeout(supabase
    .from('emergency_contacts')
    .select('*')
    .eq('is_active', true)
    .order('sort_order'), 30000, 'Emergency contacts')
  if (error) throw error
  return data || []
}

export async function fetchMarketPrices() {
  const { data, error } = await withTimeout(supabase.from('current_prices').select('*'), 30000, 'Market prices')
  if (error) throw error
  return data || []
}

// News: published posts (first page) + pinned, same shape as NewsPage.load.
export async function fetchNews({ type = '', pageSize = 20 } = {}) {
  let pinnedQuery = supabase
    .from('posts')
    .select('*, author:profiles(full_name), category:categories(name, name_mm, icon)')
    .eq('status', 'published')
    .eq('is_pinned', true)
    .order('created_at', { ascending: false })
    .limit(3)
  let postsQuery = supabase
    .from('posts')
    .select('*, author:profiles(full_name), category:categories(name, name_mm, icon)')
    .eq('status', 'published')
    .eq('is_pinned', false)
    .order('created_at', { ascending: false })
    .limit(pageSize + 1)
  if (type) {
    pinnedQuery = pinnedQuery.eq('type', type)
    postsQuery = postsQuery.eq('type', type)
  }
  const [pinnedRes, postsRes] = await withTimeout(Promise.allSettled([
    pinnedQuery,
    postsQuery,
  ]), 30000, 'News')
  const pinned = pinnedRes.status === 'fulfilled' && !pinnedRes.value.error ? (pinnedRes.value.data || []) : []
  if (postsRes.status === 'rejected' || postsRes.value?.error) {
    throw (postsRes.status === 'rejected' ? postsRes.reason : postsRes.value.error)
  }
  const rows = postsRes.value.data || []
  // N5 (v9.17): fetch one extra row; Load more shows only if it exists.
  return { pinned, posts: rows.slice(0, pageSize), hasMore: rows.length > pageSize }
}

// Events: published event posts, same source as CalendarPage.
export async function fetchEvents() {
  const { data, error } = await withTimeout(supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .eq('type', 'event')
    .order('created_at', { ascending: false })
    .limit(50), 30000, 'Events')
  if (error) throw error
  return data || []
}

// Leaderboard default view (month) — same query as LeaderboardPage.
export async function fetchLeaderboardMonth() {
  const { data, error } = await withTimeout(supabase
    .from('leaderboard_month')
    .select('*')
    .gt('period_points', 0)
    .order('period_points', { ascending: false })
    .order('id', { ascending: true })
    .limit(100), 30000, 'Leaderboard')
  if (error) throw error
  return data || []
}

// Visitor stats aggregate (RPC — never a raw table select).
export async function fetchVisitStats() {
  const { data, error } = await withTimeout(supabase.rpc('get_visit_stats'), 30000, 'Visit stats')
  if (error) throw error
  return data
}

// ── Runner ────────────────────────────────────────────────────

const TASKS = [
  { key: ['categories'], label: 'Categories', queryFn: fetchCategories },
  { key: ['listings', 'directory'], label: 'Directory listings', queryFn: fetchDirectoryListings },
  { key: ['fuel-stations'], label: 'Fuel stations', queryFn: fetchFuelData },
  { key: ['emergency-contacts'], label: 'Emergency contacts', queryFn: fetchEmergencyContacts },
  { key: ['market-prices'], label: 'Market prices', queryFn: fetchMarketPrices },
  { key: ['news'], label: 'News', queryFn: fetchNews },
  { key: ['events'], label: 'Events', queryFn: fetchEvents },
  { key: ['leaderboard', 'month'], label: 'Leaderboard (month)', queryFn: fetchLeaderboardMonth },
  { key: ['visit-stats'], label: 'Visitor stats', queryFn: fetchVisitStats },
]

export const PREFETCH_TASKS = TASKS
export const PREFETCH_INTERVAL_MS = 15 * 60 * 1000

let lastRunAt = 0
let running = false

function countOf(data) {
  if (Array.isArray(data)) return data.length
  if (data && typeof data === 'object') {
    if (Array.isArray(data.posts)) return data.posts.length
    if (Array.isArray(data.stations)) return data.stations.length
    return 1
  }
  return 0
}

// Runs all tasks (15 s per query, failures recorded not thrown).
// Skips when a run finished <15 min ago unless force is true.
// Returns true when a run actually happened.
export async function runPrefetch({ force = false } = {}) {
  if (running) return false
  if (!force && Date.now() - lastRunAt < PREFETCH_INTERVAL_MS) return false
  running = true
  startRun(TASKS.length)
  try {
    for (const task of TASKS) {
      try {
        await withTimeout(
          queryClient.prefetchQuery({ queryKey: task.key, queryFn: task.queryFn }),
          15000,
          task.label
        )
        const data = queryClient.getQueryData(task.key)
        recordItem({ key: task.key.join('/'), label: task.label, count: countOf(data), status: 'ok' })
      } catch (err) {
        console.warn('[prefetch] failed:', task.label, err)
        recordItem({ key: task.key.join('/'), label: task.label, count: 0, status: 'error' })
      }
    }
    lastRunAt = Date.now()
    return true
  } catch (err) {
    failRun(err)
    return false
  } finally {
    running = false
    finishRun()
  }
}

// Idle-time boot scheduling: requestIdleCallback when available, else a
// 3 s timer so it never competes with first paint. Re-runs on
// visibilitychange when >15 min have passed since the last run.
export function schedulePrefetch() {
  const kick = () => { runPrefetch().catch(() => {}) }
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(kick, { timeout: 3000 })
  } else if (typeof window !== 'undefined') {
    setTimeout(kick, 3000)
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Date.now() - lastRunAt > PREFETCH_INTERVAL_MS) {
        runPrefetch().catch(() => {})
      }
    })
  }
}
