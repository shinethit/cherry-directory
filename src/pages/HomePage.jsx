import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CalendarDays, Users, Wifi, WifiOff, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PostCard, ListingCard, SectionHeader, Skeleton } from '../components/UI';
import { useAppConfig } from '../contexts/AppConfigContext';
import { useLang } from '../contexts/LangContext';

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

// Shimmer skeleton
const ShimmerSkeleton = ({ className }) => (
  <div className={`relative overflow-hidden bg-white/5 rounded-2xl ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
  </div>
);

export default function HomePage() {
  const navigate = useNavigate();
  const config = useAppConfig();
  const { lang } = useLang();

  // UI states
  const [confirmed, setConfirmed] = useState(false);       // user clicked "Start"
  const [loading, setLoading] = useState(true);
  const [dataLoadError, setDataLoadError] = useState(false);
  const [dataLoadSuccess, setDataLoadSuccess] = useState(false);
  const [showReadyButton, setShowReadyButton] = useState(false);
  const [showErrorButtons, setShowErrorButtons] = useState(false);
  const timeoutRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  // Data states
  const [posts, setPosts] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [homeCategories, setHomeCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [stats, setStats] = useState({ listings: 0, posts: 0 });
  const [quickLinks, setQuickLinks] = useState([]);

  // Visitor stats
  const [visitorCount, setVisitorCount] = useState(null);
  const [countryStats, setCountryStats] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Helpers
  const closeAndNavigate = (url) => {
    setSelectedCat(null);
    setSelectedSub(null);
    setTimeout(() => navigate(url), 20);
  };

  // Online/Offline listener
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

  // Track visit (every page load)
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
    trackVisit();
  }, []);

  // Fetch visitor stats
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
    fetchStats();
  }, []);

  // Main data loading
  const loadData = useCallback(async () => {
    setLoading(true);
    setDataLoadError(false);
    setShowReadyButton(false);
    setShowErrorButtons(false);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // 8s timeout for error buttons
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        console.warn('Data loading timeout');
        setShowErrorButtons(true);
      }
    }, 8000);

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

      setDataLoadSuccess(true);
      setShowReadyButton(true);
    } catch (err) {
      console.error('Data load error:', err);
      setDataLoadError(true);
      setShowErrorButtons(true);
    } finally {
      setLoading(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [loading]);

  useEffect(() => {
    loadData();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [loadData]);

  // Button handlers
  const handleReady = () => {
    setConfirmed(true);        // user wants to see content
    setShowReadyButton(false);
  };

  const handleRetry = () => {
    loadData();
  };

  const handleContinueAnyway = () => {
    setConfirmed(true);
    setShowErrorButtons(false);
    setDataLoadSuccess(true);
  };

  // If user hasn't clicked "Start", show splash / ready / error screen
  if (!confirmed) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#0d0015] to-[#1a0030] p-6 text-center">
        {loading && !showErrorButtons && (
          <>
            <div className="w-16 h-16 mb-4 relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-brand-400/30" />
              <div className="relative flex items-center justify-center w-full h-full rounded-full bg-brand-600/30 backdrop-blur-sm">
                <span className="text-4xl">🍒</span>
              </div>
            </div>
            <h2 className="text-white font-display font-bold text-xl">Loading Data...</h2>
            <p className="text-white/50 text-sm mt-2 font-myanmar">ကျေးဇူးပြု၍ စောင့်ပါ။</p>
            <div className="mt-4 flex gap-1">
              <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" />
            </div>
          </>
        )}

        {showErrorButtons && (
          <div className="max-w-sm">
            <AlertCircle size={48} className="text-amber-400 mx-auto mb-4" />
            <h2 className="text-white font-display font-bold text-xl">ဒေတာရယူရန် ခက်ခဲနေပါသည်</h2>
            <p className="text-white/50 text-sm mt-2 font-myanmar">
              အင်တာနက်ချိတ်ဆက်မှုကို စစ်ဆေးပါ။
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleRetry}
                className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm"
              >
                <RefreshCw size={16} /> ပြန်စမ်းမည်
              </button>
              <button
                onClick={handleContinueAnyway}
                className="flex-1 btn-ghost text-sm"
              >
                ဆက်သွားမည်
              </button>
            </div>
          </div>
        )}

        {!loading && !showErrorButtons && showReadyButton && (
          <div className="max-w-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check size={32} className="text-green-400" />
            </div>
            <h2 className="text-white font-display font-bold text-xl">အဆင်သင့်ဖြစ်ပါပြီ</h2>
            <p className="text-white/50 text-sm mt-2 font-myanmar">
              ဒေတာအားလုံး ပြင်ဆင်ပြီးပါပြီ။ အောက်ပါခလုတ်ကို နှိပ်၍ စတင်အသုံးပြုနိုင်ပါသည်။
            </p>
            <button
              onClick={handleReady}
              className="mt-6 btn-primary flex items-center justify-center gap-2 w-full text-sm"
            >
              <Search size={16} /> စတင်အသုံးပြုမည်
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- MAIN CONTENT (shown after user clicks "Start") ---
  const cityName = config?.app_city || 'တောင်ကြီးမြို့';
  const appName = config?.app_name || 'Cherry Directory';

  return (
    <div className="space-y-6 py-4">
      {/* Hero Section */}
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