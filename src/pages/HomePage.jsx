import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CalendarDays, Users, Wifi, WifiOff, RefreshCw, Home, User, Briefcase, GraduationCap, Droplets, Wind } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PostCard, ListingCard, SectionHeader, Skeleton } from '../components/UI';
import { useAppConfig } from '../contexts/AppConfigContext';
import { useLang } from '../contexts/LangContext';
import SplashScreen from '../components/SplashScreen';
import ShareButton from '../components/ShareButton';
import { usePWA } from '../hooks/usePWA';

// Helper: country code → full name
const countryNames = {
  MM: 'မြန်မာ', TH: 'ထိုင်း', SG: 'စင်ကာပူ', US: 'အမေရိကန်', GB: 'ယူကေ',
  JP: 'ဂျပန်', KR: 'ကိုရီးယား', MY: 'မလေးရှား', VN: 'ဗီယက်နမ်', LA: 'လာအို',
  KH: 'ကမ္ဘောဒီးယား', IN: 'အိန္ဒိယ', AU: 'ဩစတြေးလျ', DE: 'ဂျာမနီ', FR: 'ပြင်သစ်',
};

function getCountryDisplay(code) {
  if (!code) return 'မသိ';
  return countryNames[code] || code;
}

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
  const { installable, installApp } = usePWA();

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

  // --- Visitor stats ---
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

  // --- Track visit (every page load) ---
  useEffect(() => {
    const trackVisit = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        const countryCode = data.country_code || 'XX';
        await supabase.from('visits').insert({ country_code: countryCode });
      } catch (err) {
        console.warn('Visit tracking failed:', err);
        await supabase.from('visits').insert({ country_code: 'XX' }).catch(() => {});
      }
    };
    if (consentGiven) trackVisit();
  }, [consentGiven]);

  // --- Fetch visitor stats (last 7 days) ---
  useEffect(() => {
    const fetchStats = async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('visits')
        .select('country_code')
        .gte('visited_at', sevenDaysAgo);

      if (error) {
        console.warn('Failed to fetch visitor stats:', error);
        return;
      }

      setVisitorCount(data.length);
      const counts = {};
      data.forEach(({ country_code }) => {
        const code = country_code?.trim();
        if (code && code !== 'XX' && code !== '') {
          counts[code] = (counts[code] || 0) + 1;
        }
      });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
      setCountryStats(sorted);
    };
    if (consentGiven) fetchStats();
  }, [consentGiven]);

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
    try {
      const { count: rentAvailable } = await supabase
        .from('rent')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'available')
        .catch(() => ({ count: 0 }));
      setRentListingsCount(rentAvailable || 0);

      const { count: rentSeekers } = await supabase
        .from('rent')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'seeker')
        .catch(() => ({ count: 0 }));
      setRentSeekersCount(rentSeekers || 0);

      const { count: tutorOffers } = await supabase
        .from('tutoring')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'offer')
        .catch(() => ({ count: 0 }));
      setTutorOffersCount(tutorOffers || 0);

      const { count: tutorRequests } = await supabase
        .from('tutoring')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'request')
        .catch(() => ({ count: 0 }));
      setTutorRequestsCount(tutorRequests || 0);

      const { count: jobs } = await supabase
        .from('job_board')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .catch(() => ({ count: 0 }));
      setJobOpeningsCount(jobs || 0);

      const { count: jobSeekers } = await supabase
        .from('job_seekers')
        .select('*', { count: 'exact', head: true })
        .catch(() => ({ count: 0 }));
      setJobSeekersCount(jobSeekers || 0);
    } catch (e) {
      setRentListingsCount(0);
      setRentSeekersCount(0);
      setTutorOffersCount(0);
      setTutorRequestsCount(0);
      setJobOpeningsCount(0);
      setJobSeekersCount(0);
    } finally {
      setCommunityStatsLoading(false);
    }
  }, []);

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
    <div className="space-y-6 py-4 pb-24">
      {/* Header with Share & Refresh */}
      <div className="px-4 flex justify-between items-center">
        <div>
          <h1 className="font-display font-bold text-xl text-white">Cherry Directory</h1>
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
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 p-6 border border-white/10">
          <div className="absolute top-3 right-3 flex items-center gap-3 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full text-[10px] text-white/70">
            <div className="flex items-center gap-1">
              <Users size={12} />
              <span>{visitorCount !== null ? visitorCount : '...'}</span>
            </div>
            <div className="flex items-center gap-1">
              {isOnline ? <Wifi size={12} className="text-green-400" /> : <WifiOff size={12} className="text-red-400" />}
              <span className="text-[9px]">{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
          <div className="relative">
            <p className="text-gold-400 text-xs font-display font-semibold tracking-widest uppercase mb-1">{cityName}</p>
            <h2 className="font-display font-bold text-2xl text-white leading-tight mb-3">
              Cherry<br />Directory 🍒
            </h2>
            <p className="text-white/60 text-sm font-myanmar mb-4">မြို့တွင်း လုပ်ငန်းများ၊ သတင်းများ၊ ဖြစ်ရပ်များ<br />အားလုံး တစ်နေရာတည်းတွင် ရှာဖွေနိုင်</p>
            <button onClick={() => navigate('/directory')} className="btn-primary flex items-center gap-2 text-sm">
              <Search size={16} /> လုပ်ငန်းရှာမယ်
            </button>
          </div>
          <div className="relative flex gap-3 mt-4">
            <div className="glass rounded-xl px-3 py-2 flex-1 text-center">
              <p className="font-display font-bold text-lg text-white">{stats.listings.toLocaleString()}</p>
              <p className="text-[10px] text-white/50">လုပ်ငန်းများ</p>
            </div>
            <div className="glass rounded-xl px-3 py-2 flex-1 text-center">
              <p className="font-display font-bold text-lg text-white">{posts.length > 0 ? `${posts.length}+` : '0'}</p>
              <p className="text-[10px] text-white/50">သတင်းများ</p>
            </div>
            <div className="glass rounded-xl px-3 py-2 flex-1 text-center">
              <p className="font-display font-bold text-lg text-gold-400">Free</p>
              <p className="text-[10px] text-white/50">အသုံးပြုရေး</p>
            </div>
          </div>
          {countryStats.length > 0 && (
            <div className="mt-4 pt-2 border-t border-white/20 flex flex-wrap gap-2 justify-center">
              {countryStats.map(([code, count]) => (
                <div key={code} className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-full text-[9px]">
                  <span>{getCountryDisplay(code)}</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4">
        <div className="grid grid-cols-2 gap-3">
          {loading ? (
            [1, 2, 3, 4].map(n => <ShimmerSkeleton key={n} className="h-20 rounded-2xl" />)
          ) : (
            quickLinks.map(link => (
              <button
                key={link.id}
                onClick={() => link.url.startsWith('http') ? window.open(link.url, '_blank') : navigate(link.url)}
                className={`p-4 flex items-center gap-3 rounded-2xl border transition-colors ${link.css_classes}`}
              >
                <span className="text-2xl">{link.icon}</span>
                <div className="text-left">
                  <p className="text-sm font-display font-semibold">{lang === 'mm' ? (link.title_mm || link.title) : link.title}</p>
                  <p className="text-[10px] opacity-70">{link.subtitle}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Community Stats Row */}
      <div className="px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { icon: Home, label: 'ငှားရန်ရှိသောအိမ်', value: rentListingsCount, link: '/rent?type=available' },
            { icon: User, label: 'ငှားလိုသောအိမ်ငှား', value: rentSeekersCount, link: '/rent?type=seeker' },
            { icon: GraduationCap, label: 'အချိန်ပေးနိုင်သောဆရာ', value: tutorOffersCount, link: '/tutoring?type=offer' },
            { icon: GraduationCap, label: 'ဆရာလိုနေသောကျောင်းသား', value: tutorRequestsCount, link: '/tutoring?type=request' },
            { icon: Briefcase, label: 'အလုပ်ခေါ်စာ', value: jobOpeningsCount, link: '/jobs' },
            { icon: Briefcase, label: 'အလုပ်ရှာနေသူ', value: jobSeekersCount, link: '/jobs?type=seeker' },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => navigate(item.link)}
              className="card-dark p-3 rounded-2xl text-center hover:bg-white/10 transition-colors"
            >
              <div className="flex justify-center mb-1">
                <item.icon size={20} className="text-brand-400" />
              </div>
              <p className="text-[10px] text-white/50 font-myanmar mb-0.5">{item.label}</p>
              <p className="font-display font-bold text-lg text-white">
                {communityStatsLoading ? '...' : item.value}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Category Grid */}
      {loading ? (
        <div className="px-4 grid grid-cols-4 gap-2">
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
          <div className="px-4 grid grid-cols-4 gap-2">
            {homeCategories.map(cat => {
              const subs = allCategories.filter(c => c.parent_id === cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => subs.length > 0 ? setSelectedCat(cat) : navigate(`/directory?cat=${cat.id}`)}
                  className={`flex flex-col items-center gap-1.5 p-3 card-dark hover:bg-white/8 transition-colors rounded-2xl ${cat.is_featured ? 'border border-amber-500/20' : ''}`}
                >
                  <span className="text-2xl">{cat.icon}</span>
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