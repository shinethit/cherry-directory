import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cat, Search, CalendarDays, Users, Wifi, WifiOff, RefreshCw, Home, User, Briefcase, GraduationCap, Droplets, Wind } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PostCard, ListingCard, SectionHeader, Skeleton } from '../components/UI';
import { useAppConfig } from '../contexts/AppConfigContext';
import { useLang } from '../contexts/LangContext';
import SplashScreen from '../components/SplashScreen';
import ShareButton from '../components/ShareButton';
import { usePWA } from '../hooks/usePWA'
import { subscribe as subscribeCache, inspectLocalStorage } from '../lib/cacheStatus';

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
  const { installable, installApp } = usePWA()

  // Offline cache status
  const [cacheStatusState, setCacheStatusState] = useState(null)
  const [cacheStorage, setCacheStorage] = useState({ exists: false, queryCount: 0 })
  
  // --- Splash consent: daily check ---
  const [consentGiven, setConsentGiven] = useState(() => {
    const lastShown = localStorage.getItem('cherry_consent_date');
    const today = new Date().toISOString().split('T')[0];
    return lastShown === today;
  });

  // --- Data states ---
  const [posts, setPosts] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [homeCategories, setHomeCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [stats, setStats] = useState({ listings: 0, posts: 0 });
  const [quickLinks, setQuickLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState(false);

  const [visitorCount, setVisitorCount] = useState(null);
  const [countryStats, setCountryStats] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // --- Power status (sorted by last_reported) ---
  const [powerAreas, setPowerAreas] = useState([]);
  const [powerLoading, setPowerLoading] = useState(true);
  const powerChannelRef = useRef(null);

  // --- Weather alerts (latest 4) ---
  const [weatherAlerts, setWeatherAlerts] = useState([]);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const weatherChannelRef = useRef(null);

  // --- Community stats (rent, tutoring, jobs) – silent fail if tables missing ---
  const [rentListingsCount, setRentListingsCount] = useState(0);
  const [rentSeekersCount, setRentSeekersCount] = useState(0);
  const [tutorOffersCount, setTutorOffersCount] = useState(0);
  const [tutorRequestsCount, setTutorRequestsCount] = useState(0);
  const [jobOpeningsCount, setJobOpeningsCount] = useState(0);
  const [jobSeekersCount, setJobSeekersCount] = useState(0);
  const [communityStatsLoading, setCommunityStatsLoading] = useState(true);

  // --- Track display phase: idle → saving → done → ready ---
  const [displayPhase, setDisplayPhase] = useState('idle')

  useEffect(() => {
    if (!cacheStatusState) return

    // Prefetch just started
    if (cacheStatusState.running) {
      setDisplayPhase('saving')
      return
    }

    // Prefetch just finished
    if (cacheStatusState.lastRunAt) {
      setDisplayPhase('done')
      const t = setTimeout(() => setDisplayPhase('ready'), 2000)
      return () => clearTimeout(t)
    }
  }, [cacheStatusState?.running, cacheStatusState?.lastRunAt])

  // --- Offline cache status subscription ---
  useEffect(() => {
    const unsub = subscribeCache(setCacheStatusState)
    const refresh = () => setCacheStorage(inspectLocalStorage())
    refresh()
    const id = setInterval(refresh, 3000)
    return () => { unsub(); clearInterval(id) }
  }, [])

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



  // --- Main data loading (listings, posts, categories, quick links) ---
  const loadData = useCallback(async () => {
    setLoading(true);
    setDataError(false);
    try {
      const results = await Promise.allSettled([
        supabase.from('posts').select('*, author:profiles(full_name), category:categories(name, name_mm, icon)').eq('status', 'published').neq('type', 'event').order('created_at', { ascending: false }).limit(4),
        supabase.from('listings').select('*, category:categories(name, name_mm, icon)').eq('status', 'approved').eq('is_featured', true).limit(4),
        supabase.from('categories').select('*').eq('type', 'directory').eq('is_active', true).order('is_featured', { ascending: false }).order('sort_order'),
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('posts').select('id, title, title_mm, event_start, event_end, event_location, cover_url').eq('type', 'event').eq('status', 'published').gte('event_start', new Date().toISOString()).order('event_start').limit(3),
        supabase.from('quick_links').select('*').eq('is_active', true).order('sort_order')
      ]);

      setPosts(results[0]?.status === 'fulfilled' ? results[0].value.data || [] : []);
      setFeatured(results[1]?.status === 'fulfilled' ? results[1].value.data || [] : []);
      const all = results[2]?.status === 'fulfilled' ? results[2].value.data || [] : [];
      setAllCategories(all);
      setHomeCategories(all.filter(c => !c.parent_id));
      setStats({ listings: results[3]?.status === 'fulfilled' ? results[3].value.count || 0 : 0 });
      setUpcomingEvents(results[4]?.status === 'fulfilled' ? results[4].value.data || [] : []);
      setQuickLinks(results[5]?.status === 'fulfilled' ? results[5].value.data || [] : []);
    } catch (err) {
      console.error('Data load error:', err);
      setDataError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (consentGiven) {
      loadData();
    }
  }, [consentGiven, loadData]);

  // --- Power status (sorted by last_reported descending) ---
  const loadPowerStatus = useCallback(async () => {
    setPowerLoading(true);
    try {
      const { data } = await supabase
        .from('current_power_status')
        .select('*')
        .order('last_reported', { ascending: false, nullsLast: true });
      setPowerAreas(data || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setPowerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (consentGiven) {
      loadPowerStatus();
      powerChannelRef.current = supabase
        .channel('power-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'power_cut_reports' }, loadPowerStatus)
        .subscribe();
      return () => {
        if (powerChannelRef.current) supabase.removeChannel(powerChannelRef.current);
      };
    }
  }, [consentGiven, loadPowerStatus]);

  // --- Weather alerts (latest 4, order by severity then posted_at) ---
  const loadWeatherAlerts = useCallback(async () => {
    setWeatherLoading(true);
    try {
      const { data } = await supabase
        .from('weather_alerts')
        .select('*')
        .eq('status', 'active')
        .order('severity', { ascending: false }) // danger first
        .order('posted_at', { ascending: false })
        .limit(4);
      setWeatherAlerts(data || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    if (consentGiven) {
      loadWeatherAlerts();
      weatherChannelRef.current = supabase
        .channel('weather-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'weather_alerts' }, loadWeatherAlerts)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'weather_alerts' }, loadWeatherAlerts)
        .subscribe();
      return () => {
        if (weatherChannelRef.current) supabase.removeChannel(weatherChannelRef.current);
      };
    }
  }, [consentGiven, loadWeatherAlerts]);

  // --- Community stats (silent fail) ---
  const loadCommunityStats = useCallback(async () => {
    setCommunityStatsLoading(true);

    // Helper: run a count query silently
    async function count(table, filterFn) {
      try {
        let q = supabase.from(table).select('*', { count: 'exact', head: true });
        if (filterFn) q = filterFn(q);
        const { count: c, error } = await q;
        if (error) return 0;
        return c || 0;
      } catch {
        return 0;
      }
    }

    // Rentals — post_type: 'owner' | 'tenant'
    const rentAvailable = await count('rentals', q => q.eq('post_type', 'owner'))
    const rentSeekers   = await count('rentals', q => q.eq('post_type', 'tenant'))

    // Tutoring — post_type: 'tutor' | 'student'
    const tutorOffers   = await count('tutoring', q => q.eq('post_type', 'tutor'))
    const tutorRequests = await count('tutoring', q => q.eq('post_type', 'student'))

    // Jobs — post_type: 'employer' | 'jobseeker'
    const jobOpenings   = await count('jobs', q => q.eq('post_type', 'employer'))
    const jobSeekers    = await count('jobs', q => q.eq('post_type', 'jobseeker'))

    setRentListingsCount(rentAvailable)
    setRentSeekersCount(rentSeekers)
    setTutorOffersCount(tutorOffers)
    setTutorRequestsCount(tutorRequests)
    setJobOpeningsCount(jobOpenings)
    setJobSeekersCount(jobSeekers)

    setCommunityStatsLoading(false)
  }, [])

  useEffect(() => {
    if (consentGiven) {
      loadCommunityStats();
    }
  }, [consentGiven, loadCommunityStats]);

  const handleRefresh = () => {
    loadData();
    loadPowerStatus();
    loadWeatherAlerts();
    loadCommunityStats();
  };

  const handleConsent = () => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('cherry_consent_date', today);
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

  // Helper for severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'danger': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'warning': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <div className="space-y-3 py-3 pb-24">
      {/* Header with Share & Refresh */}
      <div className="px-4 flex justify-between items-center mb-1">
        <div>
          <h1 className="font-display font-bold text-lg text-white">Cherry Directory</h1>
          <p className="text-xs text-white/40 font-myanmar">{cityName}</p>
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

      {/* Hero Section with Stats */}
      <div className="px-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 p-4 border border-white/10">

          <div className="flex gap-3">

            {/* LEFT: Title + description + search */}
            <div className="flex-1 min-w-0">
              <p className="text-gold-400 text-[10px] font-display font-semibold tracking-widest uppercase mb-0.5">{cityName}</p>
              <h2 className="font-display font-bold text-lg text-white leading-tight mb-1.5">
                Cherry Directory 🍒
              </h2>
              {/* Offline cache status — animated */}
              {(displayPhase === 'saving' || displayPhase === 'done') ? (
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1 text-[10px]">
                    <span className="text-blue-300 font-myanmar flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                      {displayPhase === 'saving'
                        ? (lang === 'mm' ? 'Data သိမ်းနေသည်' : 'Saving data')
                        : (lang === 'mm' ? 'သိမ်းပြီးပါပြီ' : 'Save complete')}
                    </span>
                    <span className="text-blue-200 font-mono font-bold">
                      {cacheStatusState?.succeeded + cacheStatusState?.failed || 0}/{cacheStatusState?.totalTasks || 0}
                      <span className="text-blue-400 ml-1">
                        ({Math.round(((cacheStatusState?.succeeded + cacheStatusState?.failed || 0) / Math.max(1, cacheStatusState?.totalTasks || 1)) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="relative h-3 rounded-full bg-white/10" style={{ overflow: 'visible' }}>
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500 ease-out"
                      style={{ width: `${((cacheStatusState?.succeeded + cacheStatusState?.failed || 0) / Math.max(1, cacheStatusState?.totalTasks || 1)) * 100}%` }}
                    />
                    <div
                      className="absolute cat-runner"
                      style={{
                        top: '-8px',
                        left: `${Math.max(4, Math.min(94, ((cacheStatusState?.succeeded + cacheStatusState?.failed || 0) / Math.max(1, cacheStatusState?.totalTasks || 1)) * 100))}%`,
                        transform: 'translateX(-50%)',
                        transition: 'left 0.6s ease-out',
                      }}
                    >
                      <svg width="28" height="24" viewBox="0 0 64 56" fill="none" style={{ display: 'block', filter: 'drop-shadow(0 0 4px rgba(147,197,253,0.9))' }}>
                        <path d="M4 38 Q 12 30 18 34" stroke="#93c5fd" strokeWidth="3" strokeLinecap="round" fill="none" />
                        <ellipse cx="32" cy="40" rx="18" ry="10" fill="#93c5fd" />
                        <rect x="20" y="48" width="4" height="6" rx="2" fill="#60a5fa" />
                        <rect x="42" y="48" width="4" height="6" rx="2" fill="#60a5fa" />
                        <circle cx="46" cy="26" r="11" fill="#93c5fd" />
                        <polygon points="40,18 42,10 46,16" fill="#93c5fd" />
                        <polygon points="50,16 53,10 55,18" fill="#93c5fd" />
                        <polygon points="42,17 43,13 45,17" fill="#bfdbfe" />
                        <polygon points="51,16 52,13 54,17" fill="#bfdbfe" />
                        <circle cx="43" cy="25" r="1.5" fill="#1e40af" />
                        <circle cx="50" cy="25" r="1.5" fill="#1e40af" />
                        <circle cx="46.5" cy="29" r="1" fill="#1e3a8a" />
                        <rect x="38" y="46" width="4" height="8" rx="2" fill="#60a5fa" />
                        <rect x="46" y="46" width="4" height="8" rx="2" fill="#60a5fa" />
                      </svg>
                    </div>
                  </div>
                </div>
              ) : displayPhase === 'ready' ? (
                <div className="flex items-center gap-1.5 mb-1.5 text-[10px]">
                  <svg width="14" height="12" viewBox="0 0 64 56" fill="none" style={{ display: 'block' }}>
                    <ellipse cx="32" cy="40" rx="18" ry="10" fill="#4ade80" />
                    <circle cx="46" cy="26" r="11" fill="#4ade80" />
                    <polygon points="40,18 42,10 46,16" fill="#4ade80" />
                    <polygon points="50,16 53,10 55,18" fill="#4ade80" />
                    <circle cx="43" cy="25" r="1.5" fill="#14532d" />
                    <circle cx="50" cy="25" r="1.5" fill="#14532d" />
                  </svg>
                  <span className="text-green-300 font-myanmar">
                    {lang === 'mm'
                      ? `Offline ရနိုင် · ${cacheStatusState?.succeeded || cacheStorage.queryCount || 23} မျိုး`
                      : `Offline ready · ${cacheStatusState?.succeeded || cacheStorage.queryCount || 23} items`}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mb-1.5 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                  <span className="text-white/40 font-myanmar">
                    {lang === 'mm' ? 'ပြင်ဆင်နေသည်...' : 'Preparing...'}
                  </span>
                </div>
              )}

              
                <p className="text-white/60 text-[10px] font-myanmar mb-2.5 leading-relaxed">
                မြို့တွင်း လုပ်ငန်းများ၊ သတင်းများ၊ ဖြစ်ရပ်များ အားလုံး တစ်နေရာတည်းတွင် ရှာဖွေနိုင်
              </p>
              <button onClick={() => navigate('/directory')} className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3">
                <Search size={13} /> လုပ်ငန်းရှာမယ်
              </button>
            </div>

            {/* RIGHT: Vertical stats — 1 col x 3 rows */}
            <div className="flex flex-col gap-1.5 flex-shrink-0 w-[70px]">
              <div className="glass rounded-lg px-2 py-1.5 text-center">
                <p className="font-display font-bold text-sm text-white leading-none">{stats.listings.toLocaleString()}</p>
                <p className="text-[8px] text-white/60 mt-0.5 leading-tight">လုပ်ငန်း</p>
              </div>
              <div className="glass rounded-lg px-2 py-1.5 text-center">
                <p className="font-display font-bold text-sm text-white leading-none">{posts.length > 0 ? `${posts.length}+` : '0'}</p>
                <p className="text-[8px] text-white/60 mt-0.5 leading-tight">သတင်း</p>
              </div>
              <div className="glass rounded-lg px-2 py-1.5 text-center">
                <p className="font-display font-bold text-sm text-gold-400 leading-none">Free</p>
                <p className="text-[8px] text-white/60 mt-0.5 leading-tight">သုံးရေး</p>
              </div>
            </div>

          </div>

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
                  <p className="text-[10px] font-display font-semibold leading-tight truncate">{lang === 'mm' ? (link.title_mm || link.title) : link.title}</p>
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
              className="w-full flex items-center justify-between py-1 hover:opacity-80 transition-opacity"
            >
              <span className="text-[9px] text-white/50 font-myanmar truncate mr-1">
                {lang === 'mm' ? 'ငှားရန်' : 'For rent'}
              </span>
              <span className="text-xs font-display font-bold text-white flex-shrink-0">
                {communityStatsLoading ? '...' : rentListingsCount}
              </span>
            </button>
            <button
              onClick={() => navigate('/rent?type=seeker')}
              className="w-full flex items-center justify-between py-1 hover:opacity-80 transition-opacity"
            >
              <span className="text-[9px] text-white/50 font-myanmar truncate mr-1">
                {lang === 'mm' ? 'ငှားလို' : 'Seeker'}
              </span>
              <span className="text-xs font-display font-bold text-white flex-shrink-0">
                {communityStatsLoading ? '...' : rentSeekersCount}
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
              className="w-full flex items-center justify-between py-1 hover:opacity-80 transition-opacity"
            >
              <span className="text-[9px] text-white/50 font-myanmar truncate mr-1">
                {lang === 'mm' ? 'ဆရာ' : 'Tutor'}
              </span>
              <span className="text-xs font-display font-bold text-white flex-shrink-0">
                {communityStatsLoading ? '...' : tutorOffersCount}
              </span>
            </button>
            <button
              onClick={() => navigate('/tutoring?type=request')}
              className="w-full flex items-center justify-between py-1 hover:opacity-80 transition-opacity"
            >
              <span className="text-[9px] text-white/50 font-myanmar truncate mr-1">
                {lang === 'mm' ? 'ကျောင်းသား' : 'Student'}
              </span>
              <span className="text-xs font-display font-bold text-white flex-shrink-0">
                {communityStatsLoading ? '...' : tutorRequestsCount}
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
              className="w-full flex items-center justify-between py-1 hover:opacity-80 transition-opacity"
            >
              <span className="text-[9px] text-white/50 font-myanmar truncate mr-1">
                {lang === 'mm' ? 'ခေါ်စာ' : 'Hiring'}
              </span>
              <span className="text-xs font-display font-bold text-white flex-shrink-0">
                {communityStatsLoading ? '...' : jobOpeningsCount}
              </span>
            </button>
            <button
              onClick={() => navigate('/jobs?type=seeker')}
              className="w-full flex items-center justify-between py-1 hover:opacity-80 transition-opacity"
            >
              <span className="text-[9px] text-white/50 font-myanmar truncate mr-1">
                {lang === 'mm' ? 'ရှာသူ' : 'Seeker'}
              </span>
              <span className="text-xs font-display font-bold text-white flex-shrink-0">
                {communityStatsLoading ? '...' : jobSeekersCount}
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
          <p className="text-white/30 text-sm font-myanmar">Category မရှိသေး</p>
          <p className="text-white/20 text-xs mt-1 font-myanmar">Admin &gt; Categories မှ ထည့်နိုင်သည်</p>
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
                  <span className="text-[9px] text-white/60 text-center leading-tight font-myanmar">{lang === 'mm' ? (cat.name_mm || cat.name) : cat.name}</span>
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

      {/* Featured Listings */}
      {(loading || featured.length > 0) && (
        <div>
          <SectionHeader title="Featured လုပ်ငန်းများ" subtitle="Highlighted businesses" action="အားလုံး" onAction={() => navigate('/directory?featured=true')} />
          <div className="px-4 space-y-2">
            {loading
              ? [1, 2, 3].map(n => <ShimmerSkeleton key={n} className="h-20" />)
              : featured.map(l => <ListingCard key={l.id} listing={l} compact />)}
          </div>
        </div>
      )}

      {/* News & Events */}
      {(loading || posts.length > 0) && (
        <div>
          <SectionHeader title="သတင်းနှင့် ဖြစ်ရပ်များ" subtitle="News & Events" action="အားလုံး" onAction={() => navigate('/news')} />
          <div className="px-4 space-y-3">
            {loading
              ? [1, 2].map(n => <ShimmerSkeleton key={n} className="h-48" />)
              : posts.slice(0, 4).map(p => <PostCard key={p.id} post={p} />)}
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      {(loading || upcomingEvents.length > 0) && (
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
              : upcomingEvents.map(ev => (
                  <div
                    key={ev.id}
                    onClick={() => navigate(`/news/${ev.id}`)}
                    className="card-listing cursor-pointer p-3 flex items-center gap-3"
                  >
                    <div className="flex-shrink-0 w-11 text-center bg-brand-600/30 border border-brand-400/25 rounded-xl py-1.5">
                      <p className="text-[8px] text-brand-300 font-display font-bold uppercase leading-none">
                        {new Date(ev.event_start).toLocaleDateString('en-US', { month: 'short' })}
                      </p>
                      <p className="text-base font-display font-bold text-white leading-tight">
                        {new Date(ev.event_start).getDate()}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-display font-semibold text-white truncate">
                        {ev.title_mm || ev.title}
                      </p>
                      <p className="text-[10px] text-white/40 mt-0.5 truncate font-myanmar">
                        {ev.event_location || new Date(ev.event_start).toLocaleTimeString('my-MM', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <CalendarDays size={16} className="text-white/20 flex-shrink-0" />
                  </div>
                ))}
          </div>
        </div>
      )}

      {/* Power Status Dashboard (read‑only, sorted by last_reported) */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-display font-semibold text-white/80 flex items-center gap-1">
            ⚡ {lang === 'mm' ? 'လျှပ်စစ်အခြေအနေ' : 'Power Status'}
          </h3>
          <button onClick={() => navigate('/power')} className="text-[9px] text-brand-300 hover:text-brand-200">
            {lang === 'mm' ? 'အားလုံးကြည့်မည် →' : 'View all →'}
          </button>
        </div>

        {powerLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(n => <ShimmerSkeleton key={n} className="h-24 rounded-2xl" />)}
          </div>
        ) : powerAreas.length === 0 ? (
          <div className="text-center py-4 text-white/30 text-sm font-myanmar">
            {lang === 'mm' ? 'ရပ်ကွက်စာရင်း မရှိသေး' : 'No neighborhoods available'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {powerAreas.slice(0, 6).map(area => {
              const isCut = area.current_status === 'cut';
              const isRestored = area.current_status === 'restored';
              return (
                <div key={area.id} className={`p-3 rounded-2xl border transition-all ${
                  isCut      ? 'bg-red-500/8   border-red-500/25'   :
                  isRestored ? 'bg-green-500/8 border-green-500/25' :
                               'bg-white/4    border-white/8'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-display font-semibold text-sm text-white">{area.name}</p>
                      <p className="text-[9px] text-white/40 mt-0.5">{area.township}</p>
                    </div>
                    <span className={`text-[10px] font-bold ${
                      isCut ? 'text-red-400' : isRestored ? 'text-green-400' : 'text-white/30'
                    }`}>
                      {isCut ? '🔴 ဖြတ်' : isRestored ? '🟢 လာ' : '⚪ မသိ'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {powerAreas.length > 6 && (
          <p className="text-[9px] text-white/30 text-center mt-2">
            + {powerAreas.length - 6} {lang === 'mm' ? 'ရပ်ကွက်များ' : 'more areas'}
          </p>
        )}
      </div>

      {/* Weather Dashboard (read‑only, latest 4 alerts) */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-display font-semibold text-white/80 flex items-center gap-1">
            🌧️ {lang === 'mm' ? 'မိုးလေဝသ/ရေကြီး သတိပေးချက်' : 'Weather & Flood Alerts'}
          </h3>
          <button onClick={() => navigate('/weather')} className="text-[9px] text-brand-300 hover:text-brand-200">
            {lang === 'mm' ? 'အားလုံးကြည့်မည် →' : 'View all →'}
          </button>
        </div>

        {weatherLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(n => <ShimmerSkeleton key={n} className="h-24 rounded-2xl" />)}
          </div>
        ) : weatherAlerts.length === 0 ? (
          <div className="text-center py-4 text-white/30 text-sm font-myanmar">
            {lang === 'mm' ? 'သတိပေးချက် မရှိပါ' : 'No active alerts'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {weatherAlerts.map(alert => {
              const severityColor = getSeverityColor(alert.severity);
              return (
                <div key={alert.id} className={`p-3 rounded-2xl border ${severityColor} bg-opacity-10`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-display font-semibold text-sm text-white">
                        {lang === 'mm' ? alert.title_mm : alert.title}
                      </p>
                      {alert.location && (
                        <p className="text-[9px] text-white/40 mt-0.5 font-myanmar">📍 {alert.location}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-bold uppercase">{alert.severity === 'danger' ? '⚠️' : alert.severity === 'warning' ? '⚡' : 'ℹ️'}</span>
                  </div>
                  {alert.content_mm && (
                    <p className="text-[10px] text-white/50 mt-1 line-clamp-2 font-myanmar">{alert.content_mm}</p>
                  )}
                  {alert.inle_level_cm && (
                    <div className="flex items-center gap-1 mt-2 text-[9px]">
                      <Droplets size={10} />
                      <span className="text-white/60">Inle Lake: {alert.inle_level_cm} cm</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
              className="text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors font-myanmar font-semibold bg-white/5 border border-white/10 px-4 py-2 rounded-full shadow-sm"
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-center text-[10px] text-white/30 mt-5 font-display font-medium tracking-wider uppercase">
          {appName} • {cityName}
        </p>
      </div>

      {/* PWA Install Button */}
      {installable && (
        <button
          onClick={installApp}
          className="fixed bottom-24 right-4 z-50 bg-brand-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse hover:bg-brand-500 transition-all"
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