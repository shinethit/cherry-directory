import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PostCard, ListingCard, SectionHeader, Skeleton } from '../components/UI'
import { useAppConfig } from '../hooks/useAppConfig'
import { useLang } from '../contexts/LangContext'

export default function HomePage() {
  const navigate = useNavigate()
  const config = useAppConfig()
  const { lang } = useLang()
  const [posts, setPosts] = useState([])
  const [featured, setFeatured] = useState([])
  const [homeCategories, setHomeCategories] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedSub, setSelectedSub] = useState(null)
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [stats, setStats] = useState({ listings: 0, posts: 0 })
  const [quickLinks, setQuickLinks] = useState([]) // ← Quick Links အတွက် State အသစ်
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [
          { data: postsData }, 
          { data: featuredData }, 
          { data: catsData }, 
          { count: listingCount }, 
          { data: eventsData },
          { data: linksData } // ← Quick Links ဆွဲထုတ်ခြင်း
        ] = await Promise.all([
          supabase.from('posts').select('*, author:profiles(full_name), category:categories(name, name_mm, icon)').eq('status', 'published').neq('type', 'event').order('created_at', { ascending: false }).limit(4),
          supabase.from('listings').select('*, category:categories(name, name_mm, icon)').eq('status', 'approved').eq('is_featured', true).limit(4),
          supabase.from('categories').select('*').eq('type', 'directory').eq('is_active', true).order('is_featured', { ascending: false }).order('sort_order'),
          supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
          supabase.from('posts').select('id, title, title_mm, event_start, event_end, event_location, cover_url').eq('type', 'event').eq('status', 'published').gte('event_start', new Date().toISOString()).order('event_start').limit(3),
          supabase.from('quick_links').select('*').eq('is_active', true).order('sort_order') // ← Database မှ လှမ်းခေါ်ခြင်း
        ])
        
        setPosts(postsData || [])
        setFeatured(featuredData || [])
        const all = catsData || []
        setAllCategories(all)
        setHomeCategories(all.filter(c => !c.parent_id))
        setUpcomingEvents(eventsData || [])
        setStats({ listings: listingCount || 0 })
        setQuickLinks(linksData || []) // ← သိမ်းဆည်းခြင်း
      } catch (e) { 
        console.warn('Load Error:', e) 
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-6 py-4">
      {/* ── 1. Hero Section ── */}
      <div className="px-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 p-6 border border-white/10">
          <div className="relative">
            <p className="text-gold-400 text-xs font-display font-semibold tracking-widest uppercase mb-1">{config.app_city || 'တောင်ကြီးမြို့'}</p>
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
        </div>
      </div>

      {/* ── 2. Quick Actions (Database မှ Auto ပြခြင်း) ── */}
      <div className="px-4">
        <div className="grid grid-cols-2 gap-3">
          {loading ? (
            [1,2,3,4].map(n => <Skeleton key={n} className="h-20 rounded-2xl" />)
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

      {/* ── 3. Quick Category Grid ── */}
      {loading ? (
        <div className="px-4 grid grid-cols-4 gap-2">
          {[1,2,3,4,5,6,7,8].map(n => <Skeleton key={n} className="h-20 rounded-2xl" />)}
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
              const subs = allCategories.filter(c => c.parent_id === cat.id)
              return (
                <button
                  key={cat.id}
                  onClick={() => subs.length > 0 ? setSelectedCat(cat) : navigate(`/directory?cat=${cat.id}`)}
                  className={`flex flex-col items-center gap-1.5 p-3 card-dark hover:bg-white/8 transition-colors rounded-2xl ${cat.is_featured ? 'border border-amber-500/20' : ''}`}
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-[9px] text-white/60 text-center leading-tight font-myanmar">{lang === 'mm' ? (cat.name_mm || cat.name) : cat.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Sub-category bottom sheet */}
      {selectedCat && (() => {
        const subs = allCategories.filter(c => c.parent_id === selectedCat.id)
        return (
          <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedCat(null)}>
            <div className="w-full max-w-lg bg-[#140020] border border-white/10 rounded-t-3xl overflow-hidden pb-safe" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedCat.icon}</span>
                  <p className="font-display font-bold text-white">{lang === 'mm' ? (selectedCat.name_mm || selectedCat.name) : selectedCat.name}</p>
                </div>
                <button onClick={() => setSelectedCat(null)} className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-white/50">✕</button>
              </div>
              <div className="px-4 py-3 grid grid-cols-3 gap-2 max-h-[50dvh] overflow-y-auto pb-8">
                <button
                  onClick={() => { navigate(`/directory?cat=${selectedCat.id}`); setSelectedCat(null) }}
                  className="flex flex-col items-center gap-1 p-3 card-dark rounded-xl hover:bg-white/8 transition-colors">
                  <span className="text-xl">📋</span>
                  <span className="text-[9px] text-white/50 text-center font-myanmar">{lang === 'mm' ? 'အားလုံး' : 'All'}</span>
                </button>
                {subs.map(sub => {
                  const subSubs = allCategories.filter(c => c.parent_id === sub.id)
                  return (
                    <button key={sub.id}
                      onClick={() => { if (subSubs.length > 0) { setSelectedSub(sub); } else { navigate(`/directory?cat=${sub.id}`); setSelectedCat(null) } }}
                      className="flex flex-col items-center gap-1 p-3 card-dark rounded-xl hover:bg-white/8 transition-colors">
                      <span className="text-xl">{sub.icon}</span>
                      <span className="text-[9px] text-white/60 text-center leading-tight font-myanmar">{lang === 'mm' ? (sub.name_mm || sub.name) : sub.name}</span>
                      {subSubs.length > 0 && <span className="text-[8px] text-brand-300/70">{subSubs.length} ▸</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Sub-sub-category bottom sheet */}
      {selectedSub && (() => {
        const subSubs = allCategories.filter(c => c.parent_id === selectedSub.id)
        return (
          <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelectedSub(null)}>
            <div className="w-full max-w-lg bg-[#140020] border border-white/10 rounded-t-3xl overflow-hidden pb-safe" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedSub.icon}</span>
                  <p className="font-display font-bold text-white">{lang === 'mm' ? (selectedSub.name_mm || selectedSub.name) : selectedSub.name}</p>
                </div>
                <button onClick={() => setSelectedSub(null)} className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-white/50">✕</button>
              </div>
              <div className="px-4 py-3 grid grid-cols-3 gap-2 max-h-[50dvh] overflow-y-auto pb-8">
                <button
                  onClick={() => { navigate(`/directory?cat=${selectedSub.id}`); setSelectedSub(null); setSelectedCat(null) }}
                  className="flex flex-col items-center gap-1 p-3 card-dark rounded-xl hover:bg-white/8 transition-colors">
                  <span className="text-xl">📋</span>
                  <span className="text-[9px] text-white/50 text-center font-myanmar">{lang === 'mm' ? 'အားလုံး' : 'All'}</span>
                </button>
                {subSubs.map(ss => (
                  <button key={ss.id}
                    onClick={() => { navigate(`/directory?cat=${ss.id}`); setSelectedSub(null); setSelectedCat(null) }}
                    className="flex flex-col items-center gap-1 p-3 card-dark rounded-xl hover:bg-white/8 transition-colors">
                    <span className="text-xl">{ss.icon}</span>
                    <span className="text-[9px] text-white/60 text-center leading-tight font-myanmar">{lang === 'mm' ? (ss.name_mm || ss.name) : ss.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── 4. Featured Listings ── */}
      {(loading || featured.length > 0) && (
        <div>
          <SectionHeader title="Featured လုပ်ငန်းများ" subtitle="Highlighted businesses" action="အားလုံး" onAction={() => navigate('/directory?featured=true')} />
          <div className="px-4 space-y-2">
            {loading
              ? [1,2,3].map(n => <Skeleton key={n} className="h-20" />)
              : featured.map(l => <ListingCard key={l.id} listing={l} compact />)
            }
          </div>
        </div>
      )}

      {/* ── 5. Latest News & Events ── */}
      {(loading || posts.length > 0) && (
        <div>
          <SectionHeader title="သတင်းနှင့် ဖြစ်ရပ်များ" subtitle="News & Events" action="အားလုံး" onAction={() => navigate('/news')} />
          <div className="px-4 space-y-3">
            {loading
              ? [1,2].map(n => <Skeleton key={n} className="h-48" />)
              : posts.slice(0, 4).map(p => <PostCard key={p.id} post={p} />)
            }
          </div>
        </div>
      )}

      {/* ── 6. Upcoming Events strip ── */}
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
              ? [1, 2].map(n => <Skeleton key={n} className="h-16" />)
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
              ))
            }
          </div>
        </div>
      )}

      <div className="h-4" />

      {/* ── 7. Mini footer ── */}
      <div className="px-4 pb-6">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {[
            { path: '/help',    label: '❓ သုံးစွဲနည်း' },
            { path: '/about',   label: '🍒 About'       },
            { path: '/privacy', label: '🔒 Privacy'     },
            { path: '/terms',   label: '📄 Terms'       },
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
          {config.app_name || 'Cherry Directory'} • {config.app_city || 'Taunggyi'}
        </p>
      </div>
    </div>
  )
}
