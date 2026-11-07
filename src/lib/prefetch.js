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
    .select('id, parent_id, name, name_mm, icon')
    .eq('type', 'directory')
    .eq('is_active', true)
    .order('sort_order'), 30000, 'Directory category tree').catch(() => ({ data: [] }))
  // v9.25 regen #4: the tree fetch already pulls the FULL directory
  // table's id/parent_id — cache it as ['category-map'] so a
  // ?cat=<subcategory> deep link can resolve offline. The
  // ['categories'] entry holds top-level rows only, so a subcategory
  // id is a cache miss there by construction and the fetch path needs
  // the network to learn target.parent_id. The map is warmed whenever
  // ['categories'] is (same prefetch task, same staleTime/gcTime via
  // the shared queryClient defaults, same 24 h persister) — no second
  // query and no new TASKS entry for rows this fetch already has.
  // Guarded: a failed tree fetch yields [] and must NOT wipe a good
  // cached map.
  if (allCats?.length) queryClient.setQueryData(['category-map'], allCats)
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
      const { count, error: countError } = await withTimeout(supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .in('category_id', ids)
        .eq('status', 'approved'), 30000, 'Directory category count')
      // v9.25 regen #5: a resolve-with-error count must fail this
      // settled entry (listing_count null, button stays enabled)
      // exactly like a rejection does — count null must not become
      // 0, which would disable a good category button.
      if (countError) throw countError
      return { ...cat, listing_count: count || 0 }
    })
  )
  return countResults.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { ...(data || [])[i], listing_count: null })
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
  // M-SHAPE (v9.20): this used to return a bare ARRAY of current_prices
  // rows, but MarketPricePage reads marketData.prices / marketData.recent
  // — setPrices(undefined) then crashed prices.filter(...) at render.
  // The fetcher now returns the { prices, recent } shape the page
  // expects (recent = latest verified price_reports with item + reporter
  // joins, as the Recent Reports section renders them).
  const { data: prices, error } = await withTimeout(supabase.from('current_prices').select('*'), 30000, 'Market prices')
  if (error) throw error
  const { data: recent, error: recentError } = await withTimeout(supabase
    .from('price_reports')
    .select('id, price, reported_at, item:price_items(icon, name, name_en), reporter:profiles(nickname)')
    .eq('is_verified', true)
    .order('reported_at', { ascending: false })
    .limit(8), 30000, 'Recent price reports')
  if (recentError) throw recentError
  return { prices: prices || [], recent: recent || [] }
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

// Visitor stats aggregate (RPC — never a raw table select).
export async function fetchVisitStats() {
  const { data, error } = await withTimeout(supabase.rpc('get_visit_stats'), 30000, 'Visit stats')
  if (error) throw error
  return data
}

// ── Runner ────────────────────────────────────────────────────

// v9.19: NO leaderboard task — the board is live data, fetched on
// demand by LeaderboardPage's own useQuery (5-min staleTime +
// persisted cache). Prefetching it would hit the OLD slow view on
// every boot until the 9.19 migration runs (code deploys BEFORE the
// migration), and its 15 s prefetch timeout fired on every boot
// while the view timed out. Prefetch failure is log-only
// (console.warn below, no toast/UI) — keep it that way.
// v9.25 regen #4: ['category-map'] is NOT a separate task —
// fetchCategories' tree fetch already pulls the full directory
// table, and fetchCategories writes it to ['category-map'] itself
// (see above). A separate task would re-fetch rows already in hand.
// v9.19: NO directory-listings task either — nothing reads the exact
// ['listings','directory'] key. DirectoryPage's listings are
// per-subcategory queries (['listings','directory', subId, ...],
// enabled only once a subcategory is picked) that no generic warm
// can serve; the page keeps old rows visible and shows skeletons
// only when empty. Same for events: CalendarPage never used
// useQuery — its month view is a date-range query and upcoming is a
// separate query, so fetchEvents warmed cache nobody read. Every
// remaining task warms the EXACT key its page reads on mount (same
// fetcher, same params) — a warmed key nobody reads is deleted,
// not kept for the Offline panel count.
const TASKS = [
  { key: ['categories'], label: 'Categories', queryFn: fetchCategories },
  { key: ['fuel-stations'], label: 'Fuel stations', queryFn: fetchFuelData },
  { key: ['emergency-contacts'], label: 'Emergency contacts', queryFn: fetchEmergencyContacts },
  { key: ['market-prices'], label: 'Market prices', queryFn: fetchMarketPrices },
  // v9.19: warm the EXACT key NewsPage reads on mount — ['news', type,
  // pageSize] with its defaults (type '', pageSize 30). The old ['news']
  // key matched no page (fetchNews() defaults to pageSize 20), so the
  // warmed rows sat in cache unread while the page fetched again.
  { key: ['news', '', 30], label: 'News', queryFn: () => fetchNews({ type: '', pageSize: 30 }) },
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
        console.warn('[prefetch] failed:', task.label, err?.message || err)
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
