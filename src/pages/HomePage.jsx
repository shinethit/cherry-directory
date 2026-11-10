import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { Search, CalendarDays, RefreshCw, Home, User, Briefcase, GraduationCap, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PostCard, ListingCard, SectionHeader } from '../components/UI';
import { useBookmarkedSet } from '../hooks/useBookmarksDB';
import { useAppConfig } from '../contexts/AppConfigContext';
import { useLang } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';
import SplashScreen from '../components/SplashScreen';
import LoadProgress from '../components/LoadProgress';
import LoadRing from '../components/LoadRing';
import ShareButton from '../components/ShareButton';
import { usePWA } from '../hooks/usePWA'
import { yangonToday, formatMyanmarDateTime, mmtParts, MY_MONTHS } from '../lib/myanmarDate';
import { safeGet, safeSet } from '../lib/safeStorage';
import { loadPartial } from '../lib/loadPartial';
import { fetchCategories } from '../lib/prefetch';
import { formatPeakHour, devicePercentages } from '../lib/visitTracking';
import { subscribeUpdateToastVisible } from '../lib/floatingBanners';
import { showError } from '../lib/toast';
import { getRecoveryLines } from '../lib/recoverySteps';
import { APP_VERSION } from '../lib/appVersion';

// How long the main Home queries may run before the page stops waiting
// (v9.7: 30 s, was 10 s — slow mobile data needs the headroom). 30 s is
// the ceiling, not the target: results are applied as they arrive, and on
// timeout whatever arrived stays rendered instead of a blank page.
export const LOAD_TIMEOUT_MS = 30000;

// Helper: country code → full name

// Shimmer skeleton component
const ShimmerSkeleton = ({ className }) => (
  <div className={`relative overflow-hidden bg-white/5 rounded-2xl ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
  </div>
);

// Per-section failed state (v9.25 regen #2): a failed section says
// "တင်မရသေးပါ" with a small retry — never "မရှိသေး".
const SectionFailed = ({ onRetry }) => (
  <div className="py-4 text-center space-y-2">
    <p className="text-white/60 text-sm font-myanmar">တင်မရသေးပါ</p>
    <button onClick={onRetry} className="text-xs text-brand-300 font-myanmar underline min-h-[44px] px-4">ပြန်ကြိုးစားမည်</button>
  </div>
);

// Stale-data strip (v9.25 regen #2): shown above a section whose refetch
// failed while cached data is still on screen — the old data stays
// visible, with a small retry. Only renders when data exists.
const StaleStrip = ({ onRetry }) => (
  <div className="py-2 px-3 flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
    <p className="text-xs text-amber-300 font-myanmar">အဟောင်းပြထားသည် — အင်တာနက် နှေးနေသည်</p>
    <button onClick={onRetry} className="text-xs text-amber-200 font-myanmar underline flex-shrink-0 min-h-[32px] px-2">ပြန်ကြိုးစားမည်</button>
  </div>
);

// v9.35 (D1): animated count-up for the Hero total ring — counts
// 0 → target over ~900ms on load (ease-out cubic), ending on the
// exact final total. A null/0 target shows 0 (the caller shows '…'
// or '—' instead while loading / on error).
function useCountUp(target) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!target) { setValue(0); return }
    let raf = 0
    let finished = false
    const start = performance.now()
    const tick = (now) => {
      if (finished) return
      const p = Math.min(1, (now - start) / 900)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // v9.35 (D1) fallback: rAF can stall on a heavily loaded machine
    // (jsdom rAF is timer-based), so the count-up might never land on
    // the exact final number. Guarantee the end state with a timeout
    // that sets the final value unconditionally AND stops the rAF
    // chain — without the stop, a starved rAF tick arriving late with
    // p < 1 would overwrite the final value with a smaller one and the
    // number would jump backwards after landing. If rAF already
    // finished this is a no-op (same value). Cleared on cleanup.
    const done = setTimeout(() => {
      finished = true
      cancelAnimationFrame(raf)
      setValue(target)
    }, 950)
    return () => { finished = true; cancelAnimationFrame(raf); clearTimeout(done) }
  }, [target])
  return value
}

export default function HomePage() {
  const navigate = useNavigate();
  const config = useAppConfig();
  const { lang } = useLang();
  const { isLoggedIn, user } = useAuth();
  const { installable, installApp } = usePWA()
  // v9.14 (F-1): at most one floating banner — the install pill hides
  // while the update toast is visible; the toast always wins.
  const [updateToastVisible, setUpdateToastVisible] = useState(false)
  useEffect(() => subscribeUpdateToastVisible(setUpdateToastVisible), [])

  // --- Splash consent: daily check (safe storage — never throws, H-2) ---
  const [consentGiven, setConsentGiven] = useState(() => {
    const lastShown = safeGet('cherry_consent_date');
    // Day boundary is 06:30 MMT today — the UTC date is wrong around midnight.
    return lastShown === yangonToday();
  });

  // --- Home data via useQuery (v9.25 regen #2) ---
  // The 7 loadPartial entries are now 6 persisted queries (same fetchers
  // as the old loadPartial array), so a revisit renders instantly from
  // the PersistQueryClientProvider cache (localStorage
  // 'cherry-directory-cache', 24 h) while a background refetch updates
  // it. The two count queries share one ['home','counts'] key. Each query
  // retries once after 2 s (react-query retry: the old whole-page
  // guarded retry behaviour — one retry, 2 s delay — now scoped
  // per section instead of whole-page).
  const queryClient = useQueryClient();
  const throwIfError = (res) => {
    if (res.error) throw res.error;
    return res.data;
  };
  const postsQ = useQuery({
    queryKey: ['home', 'posts'],
    queryFn: async () => throwIfError(await supabase.from('posts').select('*, author:profiles(full_name), category:categories(name, name_mm, icon)').eq('status', 'published').neq('type', 'event').order('created_at', { ascending: false }).limit(4)) || [],
    enabled: consentGiven,
    retryDelay: 2000,
  });
  const featuredQ = useQuery({
    queryKey: ['home', 'featured'],
    queryFn: async () => throwIfError(await supabase.from('listings').select('*, category:categories(name, name_mm, icon)').eq('status', 'approved').eq('is_featured', true).limit(4)) || [],
    enabled: consentGiven,
    retryDelay: 2000,
  });
  const categoriesQ = useQuery({
    queryKey: ['home', 'categories'],
    queryFn: async () => throwIfError(await supabase.from('categories').select('*').eq('type', 'directory').eq('is_active', true).order('is_featured', { ascending: false }).order('sort_order')) || [],
    enabled: consentGiven,
    retryDelay: 2000,
  });
  // v9.31 (A): per-category listing counts for the Home Category grid
  // tiles — the SAME ['categories'] data the Directory page reads
  // (fetchCategories: top-level rows + descendant-inclusive counts,
  // listing_count null on a failed count, never a fake 0 — S17).
  // Warmed by the prefetch runner on boot, so on the common path this
  // reads cache and adds no network query. Kept out of the 7-section
  // progress / core-error set: a failed count must never blank Home.
  // No retryDelay here (unlike the 6 section queries): the client
  // default retry covers it, exactly like DirectoryPage's own
  // ['categories'] query — and the loadPartial source-guard pins the
  // section count at 6.
  const categoryCountsQ = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    enabled: consentGiven,
  });
  const categoryCountById = new Map((categoryCountsQ.data ?? []).map(c => [c.id, c.listing_count]));
  // v9.35 (D2): largest top-level category count — every tile ring's
  // fill is relative to this (largest = full ring). 0 while the
  // counts have not arrived, so every ring stays visibly empty
  // (still waiting) until then. Driven entirely by the live
  // ['categories'] data — a category added later gets its ring
  // automatically, nothing is hardcoded.
  const maxCategoryCount = Math.max(0, ...((categoryCountsQ.data ?? [])
    .filter(c => !c.parent_id && typeof c.listing_count === 'number')
    .map(c => c.listing_count)));
  const countsQ = useQuery({
    queryKey: ['home', 'counts'],
    queryFn: async () => {
      const [l, p] = await Promise.all([
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'published').neq('type', 'event'),
      ]);
      if (l.error) throw l.error;
      if (p.error) throw p.error;
      return { listings: l.count ?? 0, posts: p.count ?? 0 };
    },
    enabled: consentGiven,
    retryDelay: 2000,
  });
  const eventsQ = useQuery({
    queryKey: ['home', 'events'],
    queryFn: async () => throwIfError(await supabase.from('posts').select('id, title, title_mm, event_start, event_end, event_location, cover_url').eq('type', 'event').eq('status', 'published').gte('event_start', new Date().toISOString()).order('event_start').limit(3)) || [],
    enabled: consentGiven,
    retryDelay: 2000,
  });
  const quickLinksQ = useQuery({
    queryKey: ['home', 'quick-links'],
    queryFn: async () => throwIfError(await supabase.from('quick_links').select('*').eq('is_active', true).order('sort_order')) || [],
    enabled: consentGiven,
    retryDelay: 2000,
  });

  // Derived data — data is undefined until the first fetch settles, so a
  // revisit renders the cached rows immediately (isLoading is false when
  // cache exists; only isFetching is true during the background refetch).
  const posts = postsQ.data ?? [];
  const featured = featuredQ.data ?? [];
  const allCategories = categoriesQ.data ?? [];
  const homeCategories = allCategories.filter(c => !c.parent_id);
  const upcomingEvents = eventsQ.data ?? [];
  const quickLinks = quickLinksQ.data ?? [];
  // v9.33: Home quick access is 3 tiles in ONE row only — News, Market
  // Prices, Public Chat. The Emergency (/emergency) and Add Business
  // (/submit) tiles are NOT rendered here: Emergency stays one tap away
  // in the header menu (Header.jsx menuItems) + the Hero 🆘 button +
  // Community, and Submit stays on the global floating "တင်မည်" button
  // (BottomNav, every route except /chat). The rows are admin-managed DB
  // data (quick_links), so filter at render time — deleting the rows
  // would need a DB step and they could be re-added.
  const visibleQuickLinks = quickLinks.filter(l => l.url !== '/emergency' && l.url !== '/submit');
  // A3: a null count means the count query failed — render "—", never a
  // misleading "0". (Initial 0 is only shown while loading, as "…".)
  const stats = countsQ.isError
    ? { listings: null, posts: null }
    : (countsQ.data ?? { listings: 0, posts: 0 });
  // v9.35 (D1): Hero total ring count-up — animates 0 → the real
  // total on load, ending on the exact final number.
  const totalCountUp = useCountUp(stats.listings ?? 0);
  // Any section still waiting on its FIRST fetch (no cached data yet).
  const loading = postsQ.isLoading || featuredQ.isLoading || categoriesQ.isLoading
    || countsQ.isLoading || eventsQ.isLoading || quickLinksQ.isLoading;
  // Whether any section has data on screen (cached or fresh).
  const hasAnyData = postsQ.data !== undefined || featuredQ.data !== undefined
    || categoriesQ.data !== undefined || countsQ.data !== undefined
    || eventsQ.data !== undefined || quickLinksQ.data !== undefined;
  // Background refetch in progress while data is already on screen.
  const isRefetching = (postsQ.isFetching || featuredQ.isFetching || categoriesQ.isFetching
    || countsQ.isFetching || eventsQ.isFetching || quickLinksQ.isFetching) && hasAnyData;
  // The red error card may render ONLY when there is no data at all
  // (B-M1). A core section failing while other data is on screen shows
  // the amber stale strip above that section instead.
  const coreError = postsQ.isError || featuredQ.isError || categoriesQ.isError;
  const dataError = coreError && !hasAnyData && isOnline;

  // Real load progress (v9.25 regen #2): sections settled / 7 total —
  // the 6 home queries + the community-counts group (still loadPartial).
  // A section counts as settled once it has data OR has errored, so a
  // failed section still completes the bar instead of hanging it at 86%.
  const [communitySettled, setCommunitySettled] = useState(false);
  const sectionsDone = [postsQ, featuredQ, categoriesQ, countsQ, eventsQ, quickLinksQ]
    .filter(q => q.data !== undefined || q.isError).length + (communitySettled ? 1 : 0);
  const sectionsTotal = 7;

  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const [recentFavorites, setRecentFavorites] = useState([]);
  // UI4 (v9.20): one batched bookmark query per list instead of one
  // per card.
  const { data: featuredBookmarked } = useBookmarkedSet(featured.map(l => l.id))
  const { data: postsBookmarked } = useBookmarkedSet(posts.map(p => p.id), 'post')

  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  // NOTE (H-5): the power/weather realtime channels and fetches were
  // removed in v9.3 — the data they fed was never rendered anywhere.

  // --- Community stats (rent, tutoring, jobs) – silent fail if tables missing ---
  const [rentListingsCount, setRentListingsCount] = useState(0);
  const [rentSeekersCount, setRentSeekersCount] = useState(0);
  const [tutorOffersCount, setTutorOffersCount] = useState(0);
  const [tutorRequestsCount, setTutorRequestsCount] = useState(0);
  const [jobOpeningsCount, setJobOpeningsCount] = useState(0);
  const [jobSeekersCount, setJobSeekersCount] = useState(0);
  const [communityStatsLoading, setCommunityStatsLoading] = useState(true);

  // --- Visitor stats (v9.12) — aggregates only, via the get_visit_stats
  // RPC. Null means the RPC failed (migration not run yet / network
  // blocked) — render "—", never a fake 0.
  const [visitStats, setVisitStats] = useState(null);
  const [visitStatsLoading, setVisitStatsLoading] = useState(true);

  // --- Online/Offline listener ---
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);




  // --- Community stats (silent fail) ---
  // Same 30 s timeout as the main load (v9.7, was 10 s): each count is
  // applied as it resolves, so one slow count can no longer blank all six
  // — pending counts become "—" at the timeout instead. No auto-retry
  // here (non-core section; a manual refresh re-runs it).
  const loadCommunityStats = useCallback(async () => {
    setCommunityStatsLoading(true);
    setCommunitySettled(false);
    try {
      // Helper: run a count query silently — null on failure (FB-5), so a
      // failed load shows "—" instead of a misleading "0".
      async function count(table, filterFn) {
        try {
          let q = supabase.from(table).select('*', { count: 'exact', head: true });
          if (filterFn) q = filterFn(q);
          const { count: c, error } = await q;
          if (error) return null;
          return c || 0;
        } catch {
          return null;
        }
      }

      // 6 counts in parallel (was 6 sequential awaits), each applied as
      // soon as it resolves.
      const setters = [setRentListingsCount, setRentSeekersCount, setTutorOffersCount, setTutorRequestsCount, setJobOpeningsCount, setJobSeekersCount];
      const { results } = await loadPartial([
        // S32 (v9.17): labels promise currently-available posts, so
        // count only available/active ones. M1: jobs post_type is
        // 'offer'/'seeker' (DB check constraint), not 'employer'/'jobseeker'.
        count('rentals', q => q.eq('post_type', 'owner').eq('status', 'available')),
        count('rentals', q => q.eq('post_type', 'tenant').eq('status', 'available')),
        count('tutoring', q => q.eq('post_type', 'tutor').eq('status', 'available')),
        count('tutoring', q => q.eq('post_type', 'student').eq('status', 'available')),
        count('jobs', q => q.eq('post_type', 'offer').eq('status', 'active')),
        count('jobs', q => q.eq('post_type', 'seeker').eq('status', 'active')),
      ], LOAD_TIMEOUT_MS, (i, outcome) => {
        if (outcome.status === 'fulfilled') setters[i](outcome.value);
      });

      // Counts still pending (or rejected) at the timeout show "—".
      results.forEach((r, i) => {
        if (r.status !== 'fulfilled') setters[i](null);
      });
    } catch (e) {
      // Unexpected loader failure: keep the previous counts, don't blank
      // all six (v9.7 — the old catch nulled every count on any failure).
      console.warn('Community stats load failed:', e)
    } finally {
      setCommunityStatsLoading(false)
      setCommunitySettled(true)
    }
  }, [])

  // Lazy-load after first paint (B-H3): the main 7 queries go first, the
  // 6 community counts follow once the browser is idle.
  useEffect(() => {
    if (!consentGiven) return
    if (!navigator.onLine) { setCommunityStatsLoading(false); setCommunitySettled(true); return }
    let timer
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => loadCommunityStats(), { timeout: 2000 })
      return () => window.cancelIdleCallback(id)
    }
    timer = setTimeout(() => loadCommunityStats(), 500)
    return () => clearTimeout(timer)
  }, [consentGiven, loadCommunityStats]);

  // v9.12: visitor aggregates for the Hero strip — once on mount, idle-time
  // so it never competes with the main load. Fail-safe: any error leaves
  // visitStats null and the strip shows "—".
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const { data, error } = await supabase.rpc('get_visit_stats')
        if (alive && !error && data) setVisitStats(data)
      } catch {
        // RPC missing or network blocked — card shows "—".
      } finally {
        if (alive) setVisitStatsLoading(false)
      }
    }
    // v9.14 (F-8b): one-time re-fetch ~5 s after mount so the user's own
    // visit (recorded on this load) appears in the Hero strip without a
    // reload. Fires at most once per mount — never a loop.
    const refetchTimer = setTimeout(() => { if (alive) load() }, 5000)
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(load, { timeout: 2000 })
      return () => { alive = false; window.cancelIdleCallback(id); clearTimeout(refetchTimer) }
    }
    const t = setTimeout(load, 500)
    return () => { alive = false; clearTimeout(t); clearTimeout(refetchTimer) }
  }, [])

  const loadFavorites = useCallback(async () => {
    if (!isLoggedIn || !user) { setRecentFavorites([]); return; }
    try {
      const { data: bmarks, error: bmarksError } = await supabase
        .from('bookmarks')
        .select('target_id')
        .eq('user_id', user.id)
        .eq('target_type', 'listing')
        .order('created_at', { ascending: false })
        .limit(6);
      // v9.25 regen #5: supabase-js RESOLVES with { data: null,
      // error } on a dead connection instead of throwing — without
      // this check the empty branch below ran and setRecentFavorites([])
      // wiped the last good favourites, against the catch below
      // ("keep the last good favourites on a failed load").
      if (bmarksError) return
      if (!bmarks?.length) { setRecentFavorites([]); return; }
      const ids = bmarks.map(b => b.target_id);
      const { data, error: listingsError } = await supabase
        .from('listings')
        .select('id, name, name_mm, logo_url, cover_url, rating_avg, rating_count, category:categories(icon)')
        .in('id', ids)
        .eq('status', 'approved');
      // v9.25 regen #5: same trap — a resolve-with-error listings
      // fetch yields null data, and the map below would wipe the
      // favourites with []. Return and keep the last good list.
      if (listingsError) return
      const map = Object.fromEntries((data || []).map(l => [l.id, l]));
      setRecentFavorites(ids.map(id => map[id]).filter(Boolean).slice(0, 4));
    } catch (e) {
      console.warn('favorites load:', e);
      // v9.25 regen #2: keep the last good favourites on a failed load —
      // clearing them blanked a good list on every slow-network retry.
    }
  }, [isLoggedIn, user]);

  useEffect(() => {
    if (consentGiven) loadFavorites();
  }, [consentGiven, loadFavorites]);

  const handleRefresh = () => {
    // Manual retry: invalidate the home queries (background refetch,
    // cached data stays on screen) and re-run the non-query loads.
    queryClient.invalidateQueries({ queryKey: ['home'] });
    // v9.31 (A): the category counts live under ['categories'], not
    // ['home'] — refresh them too so a tile count recovers on retry.
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    loadCommunityStats();
    loadFavorites();
  };

  const handleConsent = () => {
    // Guarded persist (H-1): a storage failure must never block entry —
    // consent is recorded in memory regardless, and the failure is toasted.
    const today = yangonToday();
    if (!safeSet('cherry_consent_date', today)) {
      showError('သိမ်းဆည်းမှု မအောင်မြင်ပါ — နောက်အကြိမ် ပြန်မေးပါမည်');
    }
    setConsentGiven(true);
  };

  const closeAndNavigate = (url) => {
    setSelectedCat(null);
    setSelectedSub(null);
    setTimeout(() => navigate(url), 20);
  };

  if (!consentGiven) {
    return <SplashScreen onConsent={handleConsent} />;
  }

  const cityName = config?.app_city || 'တောင်ကြီးမြို့';
  const appName = config?.app_name || 'Cherry Directory';

  // v9.12: visitor aggregates for the Hero strip (derived once per render).
  const visitPct = devicePercentages(visitStats?.by_device, visitStats?.total ?? 0);
  const visitPeak = formatPeakHour(visitStats?.by_hour);
  const visitTopCountry = visitStats?.by_country?.[0] || null;
  const visitTopCountryPct = visitStats && visitTopCountry && Number(visitStats.total) > 0
    ? Math.round((Number(visitTopCountry.count) / Number(visitStats.total)) * 100)
    : 0;

  return (
    <div className="space-y-3 py-3 pb-24">
      {/* Header with Share & Refresh */}
      <div className="px-4 flex justify-between items-center mb-1">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-xl text-white">Cherry Directory</h1>
          <p className="text-xs text-white/60 font-myanmar">{cityName}</p>
          {/* v9.33: running-bundle version, always visible — zero taps.
              APP_VERSION is the build-time package.json version (see
              src/lib/appVersion.js), so a stale PWA shows its own
              version (e.g. v9.30) and it auto-updates each release.
              Plain text, never a button — no onClick. */}
          <p data-testid="home-version-label" className="text-[10px] text-white/40 font-myanmar truncate">v{APP_VERSION}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* v9.25 regen #2: stale pill — background refetch in progress
              while cached data is on screen. Only when data exists. */}
          {isRefetching && (
            <span className="flex items-center gap-1 text-[11px] text-white/50 font-myanmar">
              <RefreshCw size={12} className="animate-spin" /> အသစ်ရယူနေသည်…
            </span>
          )}
          <ShareButton
            variant="prominent"
            customUrl="https://cutt.ly/cherrydir"
            title="Cherry Directory"
            description="တောင်ကြီးမြို့ ဒေသဆိုင်ရာ လမ်းညွှန်"
          />
          <button
            onClick={handleRefresh}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            title="Refresh data"
          >
            <RefreshCw size={18} className="text-white/70" />
          </button>
        </div>
      </div>

      {/* Real load progress (v9.25 regen #2): sections settled / total —
          real % only, never a fake spinner. Disappears when all 7 settle. */}
      {sectionsDone < sectionsTotal && (
        <LoadProgress done={sectionsDone} total={sectionsTotal} />
      )}

      {/* Offline notice (B-M3): shown instead of a silent empty page when
          there is no connection — Supabase calls are skipped, retry reloads. */}
      {!isOnline && !loading && (
        <div className="mx-4 card-dark rounded-2xl p-4 text-center space-y-2 border border-amber-500/30">
          <p className="text-sm text-amber-400 font-myanmar">အင်တာနက် မရှိပါ — Offline ဖြစ်နေသည်</p>
          <button onClick={handleRefresh} className="btn-primary text-sm px-6 py-3 min-h-[44px]">ပြန်ကြိုးစားမည်</button>
        </div>
      )}

      {/* Data error card — v9.25 regen #2: renders ONLY when a core query
          failed AND there is no data at all on screen. With cached data
          the amber stale strip above the section is shown instead.
          v9.7: never tells an online user to "check internet" — slowness is
          not no-internet (the offline notice above already covers that). */}
      {dataError && (
        <div className="mx-4 card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
          <p className="text-sm text-red-400 font-myanmar">Data အချို့ တင်မရသေးပါ — ပြန်ကြိုးစားမည်</p>
          <button onClick={handleRefresh} className="btn-primary text-sm px-6 py-3 min-h-[44px]">ပြန်ကြိုးစားမည်</button>
          {/* v9.23: same recovery hint as the crash screen — short,
              platform-aware, one line per platform. */}
          {getRecoveryLines().map((line) => (
            <p key={line} className="text-xs text-white/50 font-myanmar">{line}</p>
          ))}
        </div>
      )}

      {/* Hero Section with Stats */}
      <div className="px-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 p-4 border border-white/10">

          <div className="flex gap-3">

            {/* LEFT: Title + description + search */}
            <div className="flex-1 min-w-0">
              <h2 className="font-display font-bold text-xl text-white leading-tight mb-1.5">
                Cherry Directory 🍒
              </h2>

              <p className="text-white/80 text-xs font-myanmar mb-2.5 leading-relaxed">
                မြို့တွင်း လုပ်ငန်းများ၊ သတင်းများ၊ ဖြစ်ရပ်များ အားလုံး တစ်နေရာတည်းတွင် ရှာဖွေနိုင်
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => navigate('/directory')} className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3">
                  <Search size={13} /> လုပ်ငန်းရှာမယ်
                </button>
                {/* D1: Emergency one tap from Home — no digging through Community. */}
                <button onClick={() => navigate('/emergency')} className="flex items-center gap-1.5 text-xs py-2 px-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-display font-bold transition-colors">
                  🆘 အရေးပေါ်
                </button>
              </div>
            </div>

            {/* RIGHT: Vertical stats — 1 col x 3 rows */}
            <div className="flex flex-col gap-1.5 flex-shrink-0 w-[70px]">
              {/* v9.35 (D1): Hero total ring — the ONE ring in the Hero,
                  with the TOTAL shop count (same ['home','counts'] value
                  the old number line showed — no second total fetched,
                  no second total displayed). done = total so the ring
                  ends FULL; the count counts up 0 → final on load and
                  the ring + number stay visible permanently, never
                  auto-hide. While loading the ring stays empty ('…'). */}
              <div className="glass rounded-lg px-2 py-1.5 text-center flex flex-col items-center gap-1">
                <LoadRing done={stats.listings ?? 0} total={stats.listings ?? 0} size={40} text={false} />
                <p className="font-display font-bold text-sm text-white leading-none">{countsQ.isLoading ? '…' : stats.listings == null ? '—' : totalCountUp.toLocaleString()}</p>
                <p className="text-[8px] text-white/60 mt-0.5 leading-tight">{lang === 'mm' ? 'လုပ်ငန်း' : 'Listings'}</p>
              </div>
              <div className="glass rounded-lg px-2 py-1.5 text-center">
                <p className="font-display font-bold text-sm text-white leading-none">{countsQ.isLoading ? '…' : stats.posts == null ? '—' : stats.posts.toLocaleString()}</p>
                <p className="text-[8px] text-white/60 mt-0.5 leading-tight">{lang === 'mm' ? 'သတင်း' : 'News'}</p>
              </div>
              <div className="glass rounded-lg px-2 py-1.5 text-center">
                <p className="font-display font-bold text-sm text-gold-400 leading-none">{lang === 'mm' ? 'အခမဲ့' : 'Free'}</p>
                <p className="text-[8px] text-white/60 mt-0.5 leading-tight">{lang === 'mm' ? 'သုံးနိုင်သည်' : 'to use'}</p>
              </div>
            </div>

          </div>

          {/* Visitor strip — v9.13: the 9.12 standalone card moved INSIDE the
              Hero (same background, no separate box). Real aggregates only;
              "—" when the migration has not run yet or the RPC fails. */}
          <p className="mt-3 pt-2.5 border-t border-white/10 text-[11px] leading-relaxed text-white/60 font-myanmar">
            👀 {lang === 'mm' ? 'ဒီနေ့' : 'Today'} {visitStatsLoading ? '…' : visitStats === null ? '—' : Number(visitStats.today).toLocaleString()}
            {' · '}{lang === 'mm' ? 'စုစုပေါင်း' : 'Total'} {visitStatsLoading ? '…' : visitStats === null ? '—' : Number(visitStats.total).toLocaleString()}
            {' · '}📱 {visitStatsLoading ? '…' : visitStats === null ? '—' : visitPct.phone + '%'}
            {visitTopCountry && (<>{' · '}🌍 {visitTopCountry.name || visitTopCountry.code} {visitTopCountryPct}%</>)}
            {visitPeak && (<>{' · '}{lang === 'mm' ? 'အကြည့်များဆုံး' : 'Peak'} {visitPeak}</>)}
            {' · '}<Link to="/visitors" className="font-display font-bold text-brand-300 hover:text-brand-200">{lang === 'mm' ? 'အသေးစိတ် →' : 'Details →'}</Link>
          </p>

        </div>
      </div>

      {/* How-to-use guide — v9.10: prominent on Home, right under the Hero. Guest vs Account at a glance; full guide at /help. */}
      <div className="px-4">
        <div className="card-dark rounded-2xl p-4 space-y-3">
          <div>
            <h2 className="font-display font-bold text-base text-white">{lang === 'mm' ? '🍒 Cherry Directory ဆိုတာဘာလဲ' : '🍒 What is Cherry Directory?'}</h2>
            <p className="text-xs text-white/60 font-myanmar leading-relaxed mt-1">တောင်ကြီးမြို့ရဲ့ လုပ်ငန်း၊ သတင်း၊ ဈေးနှုန်း၊ အသိုင်းအဝိုင်း လမ်းညွှန် — အခမဲ့။</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-1.5">
              <p className="text-sm font-display font-bold text-white">👤 {lang === 'mm' ? 'ဧည့်သည် — Login မလိုဘူး' : 'Guest — no login needed'}</p>
              <ul className="space-y-1">
                <li className="text-xs text-white/60 font-myanmar flex items-start gap-2"><span className="text-brand-400 mt-0.5">•</span>လုပ်ငန်းရှာဖွေ + ဖုန်းဆက်</li>
                <li className="text-xs text-white/60 font-myanmar flex items-start gap-2"><span className="text-brand-400 mt-0.5">•</span>ဈေးနှုန်း ကြည့်/တင်</li>
                <li className="text-xs text-white/60 font-myanmar flex items-start gap-2"><span className="text-brand-400 mt-0.5">•</span>လုပ်ငန်းတင် (Admin စစ်ပြီးမှ ပေါ်)</li>
                <li className="text-xs text-white/60 font-myanmar flex items-start gap-2"><span className="text-brand-400 mt-0.5">•</span>Chat (နာမည်ပေးပြီး ပြော)</li>
                <li className="text-xs text-white/60 font-myanmar flex items-start gap-2"><span className="text-brand-400 mt-0.5">•</span>ဆီဆိုင် လမ်းညွှန်</li>
                <li className="text-xs text-white/60 font-myanmar flex items-start gap-2"><span className="text-brand-400 mt-0.5">•</span>သတင်း/ပွဲ ကြည့်</li>
              </ul>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-1.5">
              <p className="text-sm font-display font-bold text-white">🔑 {lang === 'mm' ? 'Account ရှိရင် — အပေါ်က အားလုံး +' : 'With an account — all of the above +'}</p>
              <ul className="space-y-1">
                <li className="text-xs text-white/60 font-myanmar flex items-start gap-2"><span className="text-brand-400 mt-0.5">•</span>Review ရေး + အဆင့်သတ်မှတ်</li>
                <li className="text-xs text-white/60 font-myanmar flex items-start gap-2"><span className="text-brand-400 mt-0.5">•</span>သိမ်းဆည်း (Saved)</li>
                <li className="text-xs text-white/60 font-myanmar flex items-start gap-2"><span className="text-brand-400 mt-0.5">•</span>အမှတ် + Leaderboard</li>
                <li className="text-xs text-white/60 font-myanmar flex items-start gap-2"><span className="text-brand-400 mt-0.5">•</span>Event RSVP</li>
                <li className="text-xs text-white/60 font-myanmar flex items-start gap-2"><span className="text-brand-400 mt-0.5">•</span>Push Notification</li>
              </ul>
            </div>
          </div>
          <Link to="/help" className="inline-flex items-center gap-1 text-sm font-display font-bold text-brand-300 hover:text-brand-200">
            {lang === 'mm' ? 'အပြည့်အစုံ ဖတ်ရန် → သုံးစွဲနည်း' : 'Read the full guide → How to Use'} <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* Quick Actions — v9.33: 3 tiles in one row (visibleQuickLinks);
          the Emergency + Add Business rows are filtered out above. */}
      <div className="px-4">
        {quickLinksQ.isError && visibleQuickLinks.length > 0 && (
          <div className="mb-1.5"><StaleStrip onRetry={() => quickLinksQ.refetch()} /></div>
        )}
        {quickLinksQ.isLoading ? (
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3].map(n => <ShimmerSkeleton key={n} className="h-20 rounded-2xl" />)}
          </div>
        ) : visibleQuickLinks.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5" data-testid="home-quick-access">
            {visibleQuickLinks.map(link => (
              <button
                key={link.id}
                // N3 (v9.17): noopener so an opened page cannot reach back via window.opener.
                onClick={() => link.url.startsWith('http') ? window.open(link.url, '_blank', 'noopener,noreferrer') : navigate(link.url)}
                className={`px-2 py-2.5 flex flex-col items-center gap-1 rounded-xl border transition-colors text-center ${link.css_classes}`}
              >
                <span className="text-lg leading-none">{link.icon}</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-display font-semibold leading-tight line-clamp-2">{lang === 'mm' ? (link.title_mm || link.title) : link.title}</p>
                </div>
              </button>
            ))}
          </div>
        ) : quickLinksQ.isError ? (
          <SectionFailed onRetry={() => quickLinksQ.refetch()} />
        ) : null}
      </div>

      {/* Community Stats Row — Grouped */}
      <div className="px-4">
        <div className="grid grid-cols-3 gap-2">

          {/* Rentals Group */}
          <div className="card-dark rounded-xl p-2.5">
            <div className="flex items-center gap-1 mb-1.5">
              <Home size={13} className="text-brand-400 flex-shrink-0" />
              <p className="text-[10px] font-myanmar font-semibold text-white/70 truncate">
                {lang === 'mm' ? 'ငှားရမ်း' : 'Rentals'}
              </p>
            </div>
            <button
              onClick={() => navigate('/rent?type=available')}
              className="w-full flex items-center justify-between py-2.5 hover:opacity-80 transition-opacity"
            >
              <span className="text-[9px] text-white/50 font-myanmar truncate mr-1">
                {lang === 'mm' ? 'ငှားရန်' : 'For rent'}
              </span>
              <span className="text-xs font-display font-bold text-white flex-shrink-0">
                {communityStatsLoading ? '...' : (rentListingsCount ?? '—')}
              </span>
            </button>
            <button
              onClick={() => navigate('/rent?type=seeker')}
              className="w-full flex items-center justify-between py-2.5 hover:opacity-80 transition-opacity"
            >
              <span className="text-[9px] text-white/50 font-myanmar truncate mr-1">
                {lang === 'mm' ? 'ငှားလို' : 'Seeker'}
              </span>
              <span className="text-xs font-display font-bold text-white flex-shrink-0">
                {communityStatsLoading ? '...' : (rentSeekersCount ?? '—')}
              </span>
            </button>
          </div>

          {/* Tutoring Group */}
          <div className="card-dark rounded-xl p-2.5">
            <div className="flex items-center gap-1 mb-1.5">
              <GraduationCap size={13} className="text-brand-400 flex-shrink-0" />
              <p className="text-[10px] font-myanmar font-semibold text-white/70 truncate">
                {lang === 'mm' ? 'ဆရာ/ကျောင်းသား' : 'Tutoring'}
              </p>
            </div>
            <button
              onClick={() => navigate('/tutoring?type=offer')}
              className="w-full flex items-center justify-between py-2.5 hover:opacity-80 transition-opacity"
            >
              <span className="text-[9px] text-white/50 font-myanmar truncate mr-1">
                {lang === 'mm' ? 'ဆရာ' : 'Tutor'}
              </span>
              <span className="text-xs font-display font-bold text-white flex-shrink-0">
                {communityStatsLoading ? '...' : (tutorOffersCount ?? '—')}
              </span>
            </button>
            <button
              onClick={() => navigate('/tutoring?type=request')}
              className="w-full flex items-center justify-between py-2.5 hover:opacity-80 transition-opacity"
            >
              <span className="text-[9px] text-white/50 font-myanmar truncate mr-1">
                {lang === 'mm' ? 'ကျောင်းသား' : 'Student'}
              </span>
              <span className="text-xs font-display font-bold text-white flex-shrink-0">
                {communityStatsLoading ? '...' : (tutorRequestsCount ?? '—')}
              </span>
            </button>
          </div>

          {/* Jobs Group */}
          <div className="card-dark rounded-xl p-2.5">
            <div className="flex items-center gap-1 mb-1.5">
              <Briefcase size={13} className="text-brand-400 flex-shrink-0" />
              <p className="text-[10px] font-myanmar font-semibold text-white/70 truncate">
                {lang === 'mm' ? 'အလုပ်' : 'Jobs'}
              </p>
            </div>
            <button
              onClick={() => navigate('/jobs?type=offer')}
              className="w-full flex items-center justify-between py-2.5 hover:opacity-80 transition-opacity"
            >
              <span className="text-[9px] text-white/50 font-myanmar truncate mr-1">
                {lang === 'mm' ? 'ခေါ်စာ' : 'Hiring'}
              </span>
              <span className="text-xs font-display font-bold text-white flex-shrink-0">
                {communityStatsLoading ? '...' : (jobOpeningsCount ?? '—')}
              </span>
            </button>
            <button
              onClick={() => navigate('/jobs?type=seeker')}
              className="w-full flex items-center justify-between py-2.5 hover:opacity-80 transition-opacity"
            >
              <span className="text-[9px] text-white/50 font-myanmar truncate mr-1">
                {lang === 'mm' ? 'ရှာသူ' : 'Seeker'}
              </span>
              <span className="text-xs font-display font-bold text-white flex-shrink-0">
                {communityStatsLoading ? '...' : (jobSeekersCount ?? '—')}
              </span>
            </button>
          </div>

        </div>
      </div>

      {/* Category Grid */}
      {categoriesQ.isLoading ? (
        <div className="px-4 grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <ShimmerSkeleton key={n} className="h-20 rounded-2xl" />)}
        </div>
      ) : homeCategories.length === 0 ? (
        categoriesQ.isError ? (
          <div className="px-4"><SectionFailed onRetry={() => categoriesQ.refetch()} /></div>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-white/60 text-sm font-myanmar">Category မရှိသေး</p>
          </div>
        )
      ) : (
        <div>
          <SectionHeader title="အမျိုးအစားများ" subtitle="Category" action="အားလုံး" onAction={() => navigate('/directory')} />
          {categoriesQ.isError && (
            <div className="px-4 mb-1.5"><StaleStrip onRetry={() => categoriesQ.refetch()} /></div>
          )}
          <div className="px-4 grid grid-cols-4 gap-1.5">
            {homeCategories.map(cat => {
              const subs = allCategories.filter(c => c.parent_id === cat.id);
              // v9.31 (A): listing count under the tile name — '–' while
              // unknown, never a fake 0 (S17); 0 renders 'မရှိသေး' exactly
              // like the Directory page's category list.
              const count = categoryCountById.get(cat.id);
              const countText = count == null ? '–' : count === 0 ? 'မရှိသေး' : `${count} လုပ်ငန်း`;
              return (
                <button
                  key={cat.id}
                  onClick={() => subs.length > 0 ? setSelectedCat(cat) : navigate(`/directory?cat=${cat.id}`)}
                  className={`flex flex-col items-center gap-0.5 py-2 px-1 min-w-0 card-dark hover:bg-white/8 transition-colors rounded-lg ${cat.is_featured ? 'border border-amber-500/20' : ''}`}
                >
                  <span className="text-xl">{cat.icon}</span>
                  <span className="text-[9px] text-white/60 text-center leading-tight font-myanmar line-clamp-2">{lang === 'mm' ? (cat.name_mm || cat.name) : cat.name}</span>
                  {/* v9.35 (D2): small ring + real count on EVERY tile —
                      the same shared LoadRing as the list ring and the
                      Hero total ring. Fill is this tile's count relative
                      to the largest category (maxCategoryCount); the ring
                      never auto-hides. While a tile's count has not
                      arrived (count null, or max still 0) the ring stays
                      visibly empty — "still waiting" — and animates to
                      its true fill when the counts land. Driven entirely
                      by the live categories data: a category added later
                      renders its tile + ring from this same map, no
                      hardcoded list. The count text below stays as the
                      9.31 wording ('–' / 'မရှိသေး' / 'N လုပ်ငန်း'). */}
                  <LoadRing done={count ?? 0} total={maxCategoryCount} size={30} text={false} />
                  <span className="text-[9px] text-white/40 text-center leading-tight font-myanmar truncate w-full">{countText}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Subcategory modals (unchanged) */}
      {selectedCat && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            padding: '1rem',
          }}
          onClick={() => setSelectedCat(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '24rem',
              background: '#140020',
              borderRadius: '1.5rem',
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedCat.icon}</span>
                <p className="font-display font-bold text-white">{lang === 'mm' ? (selectedCat.name_mm || selectedCat.name) : selectedCat.name}</p>
              </div>
              <button
                onClick={() => setSelectedCat(null)}
                className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-white/50 hover:bg-white/15 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="px-4 py-4 grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
              <button
                onClick={() => closeAndNavigate(`/directory?cat=${selectedCat.id}`)}
                className="flex flex-col items-center gap-1 p-3 card-dark rounded-xl hover:bg-white/8 transition-colors"
              >
                <span className="text-xl">📋</span>
                <span className="text-[9px] text-white/50 text-center font-myanmar">{lang === 'mm' ? 'အားလုံး' : 'All'}</span>
              </button>
              {allCategories.filter(c => c.parent_id === selectedCat.id).map(sub => {
                const subSubs = allCategories.filter(c => c.parent_id === sub.id);
                return (
                  <button
                    key={sub.id}
                    onClick={() => {
                      if (subSubs.length > 0) {
                        setSelectedSub(sub);
                        setSelectedCat(null);
                      } else {
                        closeAndNavigate(`/directory?cat=${sub.id}`);
                      }
                    }}
                    className="flex flex-col items-center gap-1 p-3 card-dark rounded-xl hover:bg-white/8 transition-colors"
                  >
                    <span className="text-xl">{sub.icon}</span>
                    <span className="text-[9px] text-white/60 text-center leading-tight font-myanmar">{lang === 'mm' ? (sub.name_mm || sub.name) : sub.name}</span>
                    {subSubs.length > 0 && <span className="text-[8px] text-brand-300/70">{subSubs.length} ▸</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedSub && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            padding: '1rem',
          }}
          onClick={() => setSelectedSub(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '24rem',
              background: '#140020',
              borderRadius: '1.5rem',
              border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedSub.icon}</span>
                <p className="font-display font-bold text-white">{lang === 'mm' ? (selectedSub.name_mm || selectedSub.name) : selectedSub.name}</p>
              </div>
              <button
                onClick={() => setSelectedSub(null)}
                className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-white/50 hover:bg-white/15 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="px-4 py-4 grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
              <button
                onClick={() => closeAndNavigate(`/directory?cat=${selectedSub.id}`)}
                className="flex flex-col items-center gap-1 p-3 card-dark rounded-xl hover:bg-white/8 transition-colors"
              >
                <span className="text-xl">📋</span>
                <span className="text-[9px] text-white/50 text-center font-myanmar">{lang === 'mm' ? 'အားလုံး' : 'All'}</span>
              </button>
              {allCategories.filter(c => c.parent_id === selectedSub.id).map(ss => (
                <button
                  key={ss.id}
                  onClick={() => closeAndNavigate(`/directory?cat=${ss.id}`)}
                  className="flex flex-col items-center gap-1 p-3 card-dark rounded-xl hover:bg-white/8 transition-colors"
                >
                  <span className="text-xl">{ss.icon}</span>
                  <span className="text-[9px] text-white/60 text-center leading-tight font-myanmar">{lang === 'mm' ? (ss.name_mm || ss.name) : ss.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Favorites Quick Access */}
      {isLoggedIn && recentFavorites.length > 0 && (
        <div>
          <SectionHeader
            title={lang === 'mm' ? 'သိမ်းထားသော' : 'Saved Items'}
            subtitle="Favorites"
            action={lang === 'mm' ? 'အားလုံး' : 'View all'}
            onAction={() => navigate('/saved')}
          />
          <div className="grid grid-cols-3 gap-2 px-4 pb-1">
            {recentFavorites.map(l => {
              const img = l.cover_url || l.logo_url;
              const displayName = lang === 'mm' ? (l.name_mm || l.name) : l.name;
              return (
                <button
                  key={l.id}
                  onClick={() => navigate('/directory/' + l.id)}
                  className="w-full min-w-0 card-dark rounded-2xl p-2 text-left hover:border-brand-400/30 transition-colors"
                >
                  <div className="w-full h-20 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden mb-2">
                    {img ? (
                      <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-2xl">{l.category?.icon || '🏢'}</span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-white truncate font-myanmar">
                    {displayName}
                  </p>
                  {l.rating_avg > 0 && (
                    <p className="text-[9px] text-amber-400 font-bold mt-0.5">
                      ★ {Number(l.rating_avg).toFixed(1)}
                      <span className="text-white/60 ml-1">({l.rating_count})</span>
                    </p>
                  )}
                </button>
              );
            })}
            <button
              onClick={() => navigate('/saved')}
              className="flex-shrink-0 w-32 card-dark rounded-2xl p-2 flex flex-col items-center justify-center gap-2 hover:border-brand-400/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-400/30 flex items-center justify-center">
                <ChevronRight size={20} className="text-brand-300" />
              </div>
              <p className="text-[10px] text-white/50 font-myanmar text-center">
                {lang === 'mm' ? 'အားလုံးကြည့်' : 'View all'}
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Featured Listings — header stays even when empty (A16) */}
      <div>
        <SectionHeader title="Featured လုပ်ငန်းများ" subtitle="Highlighted businesses" action="အားလုံး" onAction={() => navigate('/directory?featured=true')} />
        <div className="px-4 space-y-2">
          {featuredQ.isError && featured.length > 0 && (
            <StaleStrip onRetry={() => featuredQ.refetch()} />
          )}
          {featuredQ.isLoading
            ? [1, 2, 3].map(n => <ShimmerSkeleton key={n} className="h-20" />)
            : featured.length > 0
              ? featured.map(l => <ListingCard key={l.id} listing={l} compact bookmarked={featuredBookmarked?.has?.(l.id)} />)
              : featuredQ.isError
                ? <SectionFailed onRetry={() => featuredQ.refetch()} />
                : <p className="text-white/50 text-sm font-myanmar text-center py-4">Featured လုပ်ငန်း မရှိသေးပါ</p>}
        </div>
      </div>

      {/* News & Events — header stays even when empty (A16) */}
      <div>
        <SectionHeader title="သတင်းနှင့် ဖြစ်ရပ်များ" subtitle="News & Events" action="အားလုံး" onAction={() => navigate('/news')} />
        <div className="px-4 space-y-3">
          {postsQ.isError && posts.length > 0 && (
            <StaleStrip onRetry={() => postsQ.refetch()} />
          )}
          {postsQ.isLoading
            ? [1, 2].map(n => <ShimmerSkeleton key={n} className="h-48" />)
            : posts.length > 0
              ? posts.slice(0, 4).map(p => <PostCard key={p.id} post={p} bookmarked={postsBookmarked?.has?.(p.id)} />)
              : postsQ.isError
                ? <SectionFailed onRetry={() => postsQ.refetch()} />
                : <p className="text-white/50 text-sm font-myanmar text-center py-4">သတင်း မရှိသေးပါ</p>}
        </div>
      </div>

      {/* Upcoming Events — header stays even when empty (A16) */}
      <div>
        <SectionHeader
          title="လာမည့် ဖြစ်ရပ်များ"
          subtitle="Upcoming Events"
          action="Calendar"
          onAction={() => navigate('/calendar')}
        />
        <div className="px-4 space-y-2">
          {eventsQ.isError && upcomingEvents.length > 0 && (
            <StaleStrip onRetry={() => eventsQ.refetch()} />
          )}
          {eventsQ.isLoading
            ? [1, 2].map(n => <ShimmerSkeleton key={n} className="h-16" />)
            : upcomingEvents.length > 0
              ? upcomingEvents.map(ev => {
                // MMT helpers (H-23): device-timezone getMonth()/getDate()
                // showed the wrong day around midnight; mmtParts uses
                // Myanmar wall time instead.
                const evParts = mmtParts(ev.event_start)
                return (
                  <div
                    key={ev.id}
                    onClick={() => navigate(`/news/${ev.id}`)}
                    className="card-listing cursor-pointer p-3 flex items-center gap-3"
                  >
                    <div className="flex-shrink-0 w-11 text-center bg-brand-600/30 border border-brand-400/25 rounded-xl py-1.5">
                      <p className="text-[8px] text-brand-300 font-display font-bold uppercase leading-none">
                        {evParts ? MY_MONTHS[evParts.m - 1] : ''}
                      </p>
                      <p className="text-base font-display font-bold text-white leading-tight">
                        {evParts ? evParts.d : ''}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-display font-semibold text-white truncate">
                        {ev.title_mm || ev.title}
                      </p>
                      <p className="text-[10px] text-white/60 mt-0.5 truncate font-myanmar">
                        {ev.event_location || formatMyanmarDateTime(ev.event_start)}
                      </p>
                    </div>
                    <CalendarDays size={16} className="text-white/20 flex-shrink-0" />
                  </div>
                )
              })
              : eventsQ.isError
                ? <SectionFailed onRetry={() => eventsQ.refetch()} />
                : <p className="text-white/50 text-sm font-myanmar text-center py-4">လာမည့် ဖြစ်ရပ် မရှိသေးပါ</p>}
          </div>
        </div>

      <div className="h-4" />

      {/* Footer */}
      <div className="px-4 pb-6">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {[
            { path: '/help', label: '❓ သုံးစွဲနည်း' },
            { path: '/about', label: '🍒 About' },
            { path: '/privacy', label: '🔒 Privacy' },
            { path: '/terms', label: '📄 Terms' },
          ].map(({ path, label }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors font-myanmar font-semibold bg-white/5 border border-white/10 px-4 py-3 min-h-[44px] rounded-full shadow-sm"
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-center text-[10px] text-white/50 mt-5 font-display font-medium tracking-wider uppercase">
          {appName} • {cityName}
        </p>
      </div>

      {/* PWA Install Button — A4: parked above both banners (install banner
          sits at bottom-[164px], update prompt at bottom-[132px] since
          v9.14). Hidden while the update toast is visible (F-1) — at most
          one floating banner at a time. */}
      {installable && !updateToastVisible && (
        <button
          onClick={installApp}
          className="fixed bottom-[240px] right-4 z-50 bg-brand-600 text-white px-4 py-2.5 min-h-[44px] rounded-full shadow-lg flex items-center gap-2 animate-pulse hover:bg-brand-500 transition-all"
        >
          📲 App ထည့်မည်
        </button>
      )}

      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
}