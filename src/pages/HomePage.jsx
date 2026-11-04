import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, CalendarDays, RefreshCw, Home, User, Briefcase, GraduationCap, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PostCard, ListingCard, SectionHeader } from '../components/UI';
import { useAppConfig } from '../contexts/AppConfigContext';
import { useLang } from '../contexts/LangContext';
import { useAuth } from '../contexts/AuthContext';
import SplashScreen from '../components/SplashScreen';
import ShareButton from '../components/ShareButton';
import { usePWA } from '../hooks/usePWA'
import { yangonToday, formatMyanmarDateTime, mmtParts, MY_MONTHS } from '../lib/myanmarDate';
import { safeGet, safeSet } from '../lib/safeStorage';
import { loadPartial, createAutoRetryGuard } from '../lib/loadPartial';
import { formatPeakHour, devicePercentages } from '../lib/visitTracking';
import { showError } from '../lib/toast';

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

export default function HomePage() {
  const navigate = useNavigate();
  const config = useAppConfig();
  const { lang } = useLang();
  const { isLoggedIn, user } = useAuth();
  const { installable, installApp } = usePWA()

  // V2: after 5 s of loading, show a progress hint so the user knows the
  // app is still working instead of staring at skeletons in silence.
  const [slowLoad, setSlowLoad] = useState(false)

  // --- Splash consent: daily check (safe storage — never throws, H-2) ---
  const [consentGiven, setConsentGiven] = useState(() => {
    const lastShown = safeGet('cherry_consent_date');
    // Day boundary is 06:30 MMT today — the UTC date is wrong around midnight.
    return lastShown === yangonToday();
  });

  // --- Data states ---
  const [posts, setPosts] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [homeCategories, setHomeCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  // A3: a null count means the count query failed — render "—", never a
  // misleading "0". (Initial 0 is only shown while loading, as "…".)
  const [stats, setStats] = useState({ listings: 0, posts: 0 });
  const [quickLinks, setQuickLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Per-section errors: one failed query no longer marks the whole page as
  // errored (B-M1). dataError is set only when a core query fails or the
  // load times out; sectionErrors records which sections failed.
  const [dataError, setDataError] = useState(false);
  const [sectionErrors, setSectionErrors] = useState({});
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  // v9.7: one automatic retry after a timed-out load (2 s delay), then stop.
  const [autoRetrying, setAutoRetrying] = useState(false);
  const autoRetryGuardRef = useRef(createAutoRetryGuard());
  const autoRetryTimerRef = useRef(null);
  // v9.7: attempt id — a late arrival from an older attempt must never
  // overwrite a newer attempt's state (auto-retry overlaps the first run).
  const loadAttemptRef = useRef(0);
  const [recentFavorites, setRecentFavorites] = useState([]);

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



  // v9.7: never let a pending auto-retry timer fire after unmount.
  useEffect(() => () => {
    if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
  }, []);

  // --- Main data loading (listings, posts, categories, quick links) ---
  // 30 s timeout (v9.7, was 10 s): results stream in as they resolve —
  // a slow/failed query can no longer blank the whole page. On timeout
  // whatever arrived stays rendered, pending sections are marked failed,
  // and one auto-retry fires if a core section is still missing. Offline
  // (B-M3): skip Supabase entirely, clear loading, show the offline notice.
  // Only core sections (posts / featured / categories) set dataError (B-M1).
  const loadData = useCallback(async () => {
    const attempt = ++loadAttemptRef.current;
    // Offline: don't fire 7 queries that can only fail.
    if (!navigator.onLine) {
      setLoading(false);
      setDataError(false);
      setLoadTimedOut(false);
      setSlowLoad(false);
      return;
    }
    setLoading(true);
    setDataError(false);
    setLoadTimedOut(false);
    setSectionErrors({});
    setSlowLoad(false);
    const slowTimer = setTimeout(() => setSlowLoad(true), 5000);
    // Per-section streaming apply: each query's result is written to state
    // as soon as it resolves, so fast sections render while slow ones wait.
    const sectionNames = ['posts', 'featured', 'categories', 'listingsCount', 'events', 'quickLinks', 'postsCount'];
    const failed = {};
    const applySection = (i, r) => {
      // Ignore late arrivals from an older attempt (see loadAttemptRef).
      if (attempt !== loadAttemptRef.current) return;
      const name = sectionNames[i];
      const failedThis = r.status === 'rejected' || r.value?.error;
      if (failedThis) failed[name] = true;
      else delete failed[name];
      setSectionErrors({ ...failed });
      // Only core sections fail the whole page; the rest render empty.
      setDataError(['posts', 'featured', 'categories'].some(k => failed[k]));
      if (failedThis) {
        // A failed count is null ("—"), never a misleading "0" (A3).
        if (i === 3) setStats(prev => ({ ...prev, listings: null }));
        if (i === 6) setStats(prev => ({ ...prev, posts: null }));
        return;
      }
      if (r.status !== 'fulfilled') return;
      const data = r.value.data;
      switch (i) {
        case 0: setPosts(data || []); break;
        case 1: setFeatured(data || []); break;
        case 2: {
          const all = data || [];
          setAllCategories(all);
          setHomeCategories(all.filter(c => !c.parent_id));
          break;
        }
        case 3: setStats(prev => ({ ...prev, listings: r.value.count ?? 0 })); break;
        case 4: setUpcomingEvents(data || []); break;
        case 5: setQuickLinks(data || []); break;
        case 6: setStats(prev => ({ ...prev, posts: r.value.count ?? 0 })); break;
        default: break;
      }
    };
    try {
      const { results, timedOut } = await loadPartial([
        supabase.from('posts').select('*, author:profiles(full_name), category:categories(name, name_mm, icon)').eq('status', 'published').neq('type', 'event').order('created_at', { ascending: false }).limit(4),
        supabase.from('listings').select('*, category:categories(name, name_mm, icon)').eq('status', 'approved').eq('is_featured', true).limit(4),
        supabase.from('categories').select('*').eq('type', 'directory').eq('is_active', true).order('is_featured', { ascending: false }).order('sort_order'),
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('posts').select('id, title, title_mm, event_start, event_end, event_location, cover_url').eq('type', 'event').eq('status', 'published').gte('event_start', new Date().toISOString()).order('event_start').limit(3),
        supabase.from('quick_links').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'published')
      ], LOAD_TIMEOUT_MS, applySection);

      if (attempt !== loadAttemptRef.current) return;
      // Sections still pending at the timeout are marked failed so they
      // show their own empty/failed state, never skeletons forever.
      results.forEach((r, i) => {
        if (r.status === 'pending') {
          failed[sectionNames[i]] = true;
          if (i === 3) setStats(prev => ({ ...prev, listings: null }));
          if (i === 6) setStats(prev => ({ ...prev, posts: null }));
        }
      });
      setSectionErrors({ ...failed });
      setDataError(['posts', 'featured', 'categories'].some(k => failed[k]));
      setLoadTimedOut(timedOut);
      // Auto-retry once (2 s delay) if the load timed out with a core
      // section still missing; the guard guarantees it never loops.
      if (timedOut) {
        const coreMissing = [0, 1, 2].some(i => results[i].status !== 'fulfilled' || results[i].value?.error);
        if (coreMissing && autoRetryGuardRef.current.shouldRetry()) {
          setAutoRetrying(true);
          autoRetryTimerRef.current = setTimeout(() => {
            setAutoRetrying(false);
            loadData();
          }, 2000);
        }
      }
    } catch (err) {
      // loadPartial never rejects on timeout; this is only for an
      // unexpected failure of the loader itself.
      console.error('Data load error:', err);
      if (attempt === loadAttemptRef.current) setDataError(true);
    } finally {
      clearTimeout(slowTimer);
      if (attempt === loadAttemptRef.current) {
        setSlowLoad(false);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (consentGiven) {
      loadData();
    }
  }, [consentGiven, loadData]);

  // --- Community stats (silent fail) ---
  // Same 30 s timeout as the main load (v9.7, was 10 s): each count is
  // applied as it resolves, so one slow count can no longer blank all six
  // — pending counts become "—" at the timeout instead. No auto-retry
  // here (non-core section; a manual refresh re-runs it).
  const loadCommunityStats = useCallback(async () => {
    setCommunityStatsLoading(true);
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
        count('rentals', q => q.eq('post_type', 'owner')),
        count('rentals', q => q.eq('post_type', 'tenant')),
        count('tutoring', q => q.eq('post_type', 'tutor')),
        count('tutoring', q => q.eq('post_type', 'student')),
        count('jobs', q => q.eq('post_type', 'employer')),
        count('jobs', q => q.eq('post_type', 'jobseeker')),
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
    }
  }, [])

  // Lazy-load after first paint (B-H3): the main 7 queries go first, the
  // 6 community counts follow once the browser is idle.
  useEffect(() => {
    if (!consentGiven) return
    if (!navigator.onLine) { setCommunityStatsLoading(false); return }
    let timer
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => loadCommunityStats(), { timeout: 2000 })
      return () => window.cancelIdleCallback(id)
    }
    timer = setTimeout(() => loadCommunityStats(), 500)
    return () => clearTimeout(timer)
  }, [consentGiven, loadCommunityStats]);

  // v9.12: visitor aggregates for the Hero card — once on mount, idle-time
  // so it never competes with the main load. Fail-safe: any error leaves
  // visitStats null and the card shows "—".
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
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(load, { timeout: 2000 })
      return () => { alive = false; window.cancelIdleCallback(id) }
    }
    const t = setTimeout(load, 500)
    return () => { alive = false; clearTimeout(t) }
  }, [])

  const loadFavorites = useCallback(async () => {
    if (!isLoggedIn || !user) { setRecentFavorites([]); return; }
    try {
      const { data: bmarks } = await supabase
        .from('bookmarks')
        .select('target_id')
        .eq('user_id', user.id)
        .eq('target_type', 'listing')
        .order('created_at', { ascending: false })
        .limit(6);
      if (!bmarks?.length) { setRecentFavorites([]); return; }
      const ids = bmarks.map(b => b.target_id);
      const { data } = await supabase
        .from('listings')
        .select('id, name, name_mm, logo_url, cover_url, rating_avg, rating_count, category:categories(icon)')
        .in('id', ids)
        .eq('status', 'approved');
      const map = Object.fromEntries((data || []).map(l => [l.id, l]));
      setRecentFavorites(ids.map(id => map[id]).filter(Boolean).slice(0, 4));
    } catch (e) {
      console.warn('favorites load:', e);
      // Don't leave stale favourites on screen after a failed load (B-M4).
      setRecentFavorites([]);
    }
  }, [isLoggedIn, user]);

  useEffect(() => {
    if (consentGiven) loadFavorites();
  }, [consentGiven, loadFavorites]);

  const handleRefresh = () => {
    // Manual retry: cancel any pending auto-retry and reset its guard so
    // this retry can auto-retry once again if it also times out (v9.7).
    if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
    autoRetryTimerRef.current = null;
    autoRetryGuardRef.current.reset();
    setAutoRetrying(false);
    loadData();
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

  // v9.12: visitor aggregates for the Hero card (derived once per render).
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
        <div>
          <h1 className="font-display font-bold text-xl text-white">Cherry Directory</h1>
          <p className="text-xs text-white/60 font-myanmar">{cityName}</p>
        </div>
        <div className="flex items-center gap-3">
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

      {/* V2: loading for more than 5 s — show a progress hint. */}
      {loading && slowLoad && (
        <p className="px-4 text-center text-xs text-white/60 font-myanmar">တင်နေသည်… ခဏစောင့်ပါ</p>
      )}

      {/* Offline notice (B-M3): shown instead of a silent empty page when
          there is no connection — Supabase calls are skipped, retry reloads. */}
      {!isOnline && !loading && (
        <div className="mx-4 card-dark rounded-2xl p-4 text-center space-y-2 border border-amber-500/30">
          <p className="text-sm text-amber-400 font-myanmar">အင်တာနက် မရှိပါ — Offline ဖြစ်နေသည်</p>
          <button onClick={handleRefresh} className="btn-primary text-sm px-6 py-3 min-h-[44px]">ပြန်ကြိုးစားမည်</button>
        </div>
      )}

      {/* Data error banner — shown when a core query fails or the load times out.
          v9.7: never tells an online user to "check internet" — slowness is
          not no-internet (the offline notice above already covers that). */}
      {dataError && !loading && !autoRetrying && (
        <div className="mx-4 card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
          <p className="text-sm text-red-400 font-myanmar">Data အချို့ တင်မရသေးပါ — ပြန်ကြိုးစားမည်</p>
          <button onClick={handleRefresh} className="btn-primary text-sm px-6 py-3 min-h-[44px]">ပြန်ကြိုးစားမည်</button>
        </div>
      )}

      {/* v9.7: auto-retry in progress — honest in-progress notice while the
          single automatic retry is pending/running. */}
      {autoRetrying && !loading && (
        <div className="mx-4 card-dark rounded-2xl p-4 text-center space-y-2 border border-amber-500/30">
          <p className="text-sm text-amber-400 font-myanmar">Data တင်တာ ကြာနေသည် — ထပ်ကြိုးစားနေသည်</p>
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
              <div className="glass rounded-lg px-2 py-1.5 text-center">
                <p className="font-display font-bold text-sm text-white leading-none">{loading ? '…' : stats.listings == null ? '—' : stats.listings.toLocaleString()}</p>
                <p className="text-[8px] text-white/60 mt-0.5 leading-tight">လုပ်ငန်း</p>
              </div>
              <div className="glass rounded-lg px-2 py-1.5 text-center">
                <p className="font-display font-bold text-sm text-white leading-none">{loading ? '…' : stats.posts == null ? '—' : stats.posts.toLocaleString()}</p>
                <p className="text-[8px] text-white/60 mt-0.5 leading-tight">သတင်း</p>
              </div>
              <div className="glass rounded-lg px-2 py-1.5 text-center">
                <p className="font-display font-bold text-sm text-gold-400 leading-none">အခမဲ့</p>
                <p className="text-[8px] text-white/60 mt-0.5 leading-tight">သုံးနိုင်သည်</p>
              </div>
            </div>

          </div>

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
              <p className="text-sm font-display font-bold text-white">🔑 {lang === 'mm' ? 'Account ရှိရင် — အပေါ်ကအကုန် +' : 'With an account — all of the above +'}</p>
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

      {/* Visitor summary — v9.12: real aggregates only (RPC). "—" when the
          migration has not run yet or the RPC fails; never a fake 0. */}
      <div className="px-4">
        <div className="card-dark rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-base text-white">👀 {lang === 'mm' ? 'လာကြည့်သူများ' : 'Visitors'}</h2>
            <Link to="/visitors" className="inline-flex items-center gap-1 text-sm font-display font-bold text-brand-300 hover:text-brand-200">
              {lang === 'mm' ? 'အသေးစိတ် →' : 'Details →'} <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
              <p className="font-display font-bold text-lg text-white leading-none">{visitStatsLoading ? '…' : visitStats === null ? '—' : Number(visitStats.total).toLocaleString()}</p>
              <p className="text-[10px] text-white/50 font-myanmar mt-1">{lang === 'mm' ? 'စုစုပေါင်း လာကြည့်သူ' : 'Total visits'}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
              <p className="font-display font-bold text-lg text-white leading-none">{visitStatsLoading ? '…' : visitStats === null ? '—' : Number(visitStats.today).toLocaleString()}</p>
              <p className="text-[10px] text-white/50 font-myanmar mt-1">{lang === 'mm' ? 'ဒီနေ့' : 'Today'}</p>
            </div>
          </div>
          {visitStats !== null && (
            <div className="space-y-1.5 text-xs text-white/60 font-myanmar">
              <p>📱 {visitPct.phone}% · 💻 {visitPct.desktop}%{visitPct.tablet > 0 ? ` · 📟 ${visitPct.tablet}%` : ''}</p>
              {visitTopCountry && (
                <p>🌍 {visitTopCountry.name || visitTopCountry.code} {visitTopCountryPct}%</p>
              )}
              {visitPeak && (
                <p>🕐 {lang === 'mm' ? 'အကြည့်များဆုံးအချိန်: ' : 'Peak time: '}{visitPeak}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4">
        <div className="grid grid-cols-3 gap-1.5">
          {loading ? (
            [1, 2, 3, 4].map(n => <ShimmerSkeleton key={n} className="h-20 rounded-2xl" />)
          ) : (
            quickLinks.map(link => (
              <button
                key={link.id}
                onClick={() => link.url.startsWith('http') ? window.open(link.url, '_blank') : navigate(link.url)}
                className={`px-2 py-2.5 flex flex-col items-center gap-1 rounded-xl border transition-colors text-center ${link.css_classes}`}
              >
                <span className="text-lg leading-none">{link.icon}</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-display font-semibold leading-tight line-clamp-2">{lang === 'mm' ? (link.title_mm || link.title) : link.title}</p>
                </div>
              </button>
            ))
          )}
        </div>
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
              onClick={() => navigate('/jobs')}
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
      {loading ? (
        <div className="px-4 grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <ShimmerSkeleton key={n} className="h-20 rounded-2xl" />)}
        </div>
      ) : homeCategories.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-white/60 text-sm font-myanmar">Category မရှိသေး</p>
        </div>
      ) : (
        <div>
          <SectionHeader title="အမျိုးအစားများ" subtitle="Category" action="အားလုံး" onAction={() => navigate('/directory')} />
          <div className="px-4 grid grid-cols-4 gap-1.5">
            {homeCategories.map(cat => {
              const subs = allCategories.filter(c => c.parent_id === cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => subs.length > 0 ? setSelectedCat(cat) : navigate(`/directory?cat=${cat.id}`)}
                  className={`flex flex-col items-center gap-0.5 py-2 px-1 card-dark hover:bg-white/8 transition-colors rounded-lg ${cat.is_featured ? 'border border-amber-500/20' : ''}`}
                >
                  <span className="text-xl">{cat.icon}</span>
                  <span className="text-[9px] text-white/60 text-center leading-tight font-myanmar line-clamp-2">{lang === 'mm' ? (cat.name_mm || cat.name) : cat.name}</span>
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
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 px-4">
            {recentFavorites.map(l => {
              const img = l.cover_url || l.logo_url;
              const displayName = lang === 'mm' ? (l.name_mm || l.name) : l.name;
              return (
                <button
                  key={l.id}
                  onClick={() => navigate('/directory/' + l.id)}
                  className="flex-shrink-0 w-32 card-dark rounded-2xl p-2 text-left hover:border-brand-400/30 transition-colors"
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
          {loading
            ? [1, 2, 3].map(n => <ShimmerSkeleton key={n} className="h-20" />)
            : featured.length > 0
              ? featured.map(l => <ListingCard key={l.id} listing={l} compact />)
              : <p className="text-white/50 text-sm font-myanmar text-center py-4">Featured လုပ်ငန်း မရှိသေးပါ</p>}
        </div>
      </div>

      {/* News & Events — header stays even when empty (A16) */}
      <div>
        <SectionHeader title="သတင်းနှင့် ဖြစ်ရပ်များ" subtitle="News & Events" action="အားလုံး" onAction={() => navigate('/news')} />
        <div className="px-4 space-y-3">
          {loading
            ? [1, 2].map(n => <ShimmerSkeleton key={n} className="h-48" />)
            : posts.length > 0
              ? posts.slice(0, 4).map(p => <PostCard key={p.id} post={p} />)
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
          {loading
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
          sits at bottom-[164px], update prompt at bottom-[88px]). */}
      {installable && (
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