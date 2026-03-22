import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Calendar, Newspaper, Search, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PostCard, ListingCard, SectionHeader, Skeleton } from '../components/UI'

const CATEGORIES = [
  { icon: '🍜', label: 'စားသောက်ဆိုင်' },
  { icon: '🏥', label: 'ဆေးရုံ' },
  { icon: '🎓', label: 'ပညာရေး' },
  { icon: '🏨', label: 'တည်းခိုရေး' },
  { icon: '🛍️', label: 'ဈေးဝယ်' },
  { icon: '🚌', label: 'သွားလာရေး' },
  { icon: '🏦', label: 'ဘဏ်' },
  { icon: '💄', label: 'အလှအပ' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [featured, setFeatured] = useState([])
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [stats, setStats] = useState({ listings: 0, posts: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: postsData }, { data: featuredData }, { count: listingCount }, { data: eventsData }] = await Promise.all([
        supabase.from('posts').select('*, author:profiles(full_name), category:categories(name, name_mm, icon)').eq('status', 'published').neq('type', 'event').order('created_at', { ascending: false }).limit(4),
        supabase.from('listings').select('*, category:categories(name, name_mm, icon)').eq('status', 'approved').eq('is_featured', true).limit(4),
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('posts').select('id, title, title_mm, event_start, event_end, event_location, cover_url').eq('type', 'event').eq('status', 'published').gte('event_start', new Date().toISOString()).order('event_start').limit(3),
      ])
      setPosts(postsData || [])
      setFeatured(featuredData || [])
      setUpcomingEvents(eventsData || [])
      setStats({ listings: listingCount || 0 })
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6 py-4">
      {/* Hero */}
      <div className="px-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 p-6 border border-white/10">
          {/* Background glow */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-400/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-gold-500/10 rounded-full blur-2xl" />

          <div className="relative">
            <p className="text-gold-400 text-xs font-display font-semibold tracking-widest uppercase mb-1">တောင်ကြီးမြို့</p>
            <h2 className="font-display font-bold text-2xl text-white leading-tight mb-3">
              Cherry<br />Directory 🍒
            </h2>
            <p className="text-white/60 text-sm font-myanmar mb-4">မြို့တွင်းဆိုင်များ၊ သတင်းများ၊ ဖြစ်ရပ်များ<br />အားလုံး တစ်နေရာတည်းတွင် ရှာဖွေနိုင်</p>

            <button onClick={() => navigate('/directory')} className="btn-primary flex items-center gap-2 text-sm">
              <Search size={16} /> ဆိုင်ရှာမယ်
            </button>
          </div>

          {/* Stats */}
          <div className="relative flex gap-3 mt-4">
            <div className="glass rounded-xl px-3 py-2 flex-1 text-center">
              <p className="font-display font-bold text-lg text-white">{stats.listings.toLocaleString()}</p>
              <p className="text-[10px] text-white/50">ဆိုင်များ</p>
            </div>
            <div className="glass rounded-xl px-3 py-2 flex-1 text-center">
              <p className="font-display font-bold text-lg text-white">{posts.length}+</p>
              <p className="text-[10px] text-white/50">သတင်းများ</p>
            </div>
            <div className="glass rounded-xl px-3 py-2 flex-1 text-center">
              <p className="font-display font-bold text-lg text-gold-400">Free</p>
              <p className="text-[10px] text-white/50">အသုံးပြုရေး</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Category Grid */}
      <div>
        <SectionHeader title="အမျိုးအစားများ" subtitle="Category" action="အားလုံး" onAction={() => navigate('/directory')} />
        <div className="px-4 grid grid-cols-4 gap-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.label}
              onClick={() => navigate(`/directory?cat=${cat.label}`)}
              className="flex flex-col items-center gap-1.5 p-3 card-dark hover:bg-white/8 transition-colors rounded-2xl"
            >
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-[9px] text-white/60 text-center leading-tight font-myanmar">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Featured Listings */}
      {(loading || featured.length > 0) && (
        <div>
          <SectionHeader title="Featured ဆိုင်များ" subtitle="Highlighted businesses" action="အားလုံး" onAction={() => navigate('/directory?featured=true')} />
          <div className="px-4 space-y-2">
            {loading
              ? [1,2,3].map(n => <Skeleton key={n} className="h-20" />)
              : featured.map(l => <ListingCard key={l.id} listing={l} compact />)
            }
          </div>
        </div>
      )}

      {/* Latest News & Events */}
      <div>
        <SectionHeader title="သတင်းနှင့် ဖြစ်ရပ်များ" subtitle="News & Events" action="အားလုံး" onAction={() => navigate('/news')} />
        <div className="px-4 space-y-3">
          {loading
            ? [1,2].map(n => <Skeleton key={n} className="h-48" />)
            : posts.slice(0, 4).map(p => <PostCard key={p.id} post={p} />)
          }
        </div>
      </div>

      {/* Upcoming Events strip */}
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
                  {/* Date chip */}
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

      {/* Quick Actions */}
      <div className="px-4">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/prices')} className="card-dark p-4 flex items-center gap-3 hover:bg-white/8 transition-colors rounded-2xl">
            <span className="text-2xl">🛒</span>
            <div className="text-left">
              <p className="text-sm font-display font-semibold text-white">ဈေးနှုန်းဘုတ်</p>
              <p className="text-[10px] text-white/40">Market Prices</p>
            </div>
          </button>
          <button onClick={() => navigate('/power')} className="card-dark p-4 flex items-center gap-3 hover:bg-white/8 transition-colors rounded-2xl">
            <span className="text-2xl">⚡</span>
            <div className="text-left">
              <p className="text-sm font-display font-semibold text-white">လျှပ်စစ်</p>
              <p className="text-[10px] text-white/40">Power Status</p>
            </div>
          </button>
          <button onClick={() => navigate('/chat')} className="card-dark p-4 flex items-center gap-3 hover:bg-white/8 transition-colors rounded-2xl">
            <span className="text-2xl">💬</span>
            <div className="text-left">
              <p className="text-sm font-display font-semibold text-white">Public Chat</p>
              <p className="text-[10px] text-white/40">ပြောဆိုရေး</p>
            </div>
          </button>
          <button onClick={() => navigate('/submit')} className="card-dark p-4 flex items-center gap-3 hover:bg-white/8 transition-colors rounded-2xl">
            <span className="text-2xl">➕</span>
            <div className="text-left">
              <p className="text-sm font-display font-semibold text-white">ဆိုင်ထည့်မယ်</p>
              <p className="text-[10px] text-white/40">Submit listing</p>
            </div>
          </button>
        </div>
      </div>

      <div className="h-4" />

      {/* Mini footer */}
      <div className="px-4 pb-2">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {[
            { path: '/help',    label: '❓ သုံးစွဲနည်း' },
            { path: '/about',   label: '🍒 About'       },
            { path: '/privacy', label: '🔒 Privacy'     },
            { path: '/terms',   label: '📄 Terms'       },
          ].map(({ path, label }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="text-[10px] text-white/25 hover:text-white/50 transition-colors font-myanmar"
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-center text-[9px] text-white/15 mt-2">Cherry Directory v2 • Taunggyi</p>
      </div>
    </div>
  )
}
