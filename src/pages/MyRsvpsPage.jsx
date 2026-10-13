import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, CheckCircle, Star, Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { supabase } from '../lib/supabase'
import { useSEO } from '../hooks/useSEO'
import { EmptyState } from '../components/UI'
import { getOptimizedUrl } from '../lib/cloudinary'
import { getCountdown } from '../lib/countdown'

export default function MyRsvpsPage() {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useAuth()
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'တက်မည့် ဖြစ်ရပ်များ' : 'My RSVPs' })

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('event_rsvps')
        .select('status, post:posts(id, title, title_mm, cover_url, event_start, event_end, event_location, type, status)')
        .eq('user_id', user.id)
      const list = (data || [])
        .map(r => (r.post ? { ...r.post, _rsvp: r.status } : null))
        .filter(p => p && p.type === 'event' && p.status === 'published')
      setItems(list)
    } catch (e) { console.warn(e) }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  async function cancelRsvp(postId) {
    if (!confirm(lang === 'mm' ? 'RSVP ပယ်ဖျက်မှာ သေချာလား?' : 'Cancel RSVP?')) return
    await supabase.from('event_rsvps').delete().match({ post_id: postId, user_id: user.id })
    setItems(prev => prev.filter(i => i.id !== postId))
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70dvh] px-8 text-center">
        <Calendar size={48} className="text-brand-400 mb-4" />
        <h2 className="font-display font-bold text-xl text-white mb-2">
          {lang === 'mm' ? 'Login လိုအပ်သည်' : 'Login Required'}
        </h2>
        <p className="text-white/50 font-myanmar mb-6">
          {lang === 'mm' ? 'RSVP များ ကြည့်ရန် Login ဝင်ပါ' : 'Sign in to view your RSVPs'}
        </p>
        <button onClick={() => navigate('/login')} className="btn-primary">
          {lang === 'mm' ? 'Login ဝင်ရောက်မည်' : 'Sign In'}
        </button>
      </div>
    )
  }

  const now = new Date()
  const upcoming = items.filter(i => new Date(i.event_end || i.event_start) >= now)
    .sort((a, b) => new Date(a.event_start) - new Date(b.event_start))
  const past = items.filter(i => new Date(i.event_end || i.event_start) < now)
    .sort((a, b) => new Date(b.event_start) - new Date(a.event_start))

  const list = tab === 'upcoming' ? upcoming : past

  return (
    <div className="pb-8 min-h-[80dvh]">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              🎟️ {lang === 'mm' ? 'တက်မည့် ဖြစ်ရပ်များ' : 'My RSVPs'}
            </h1>
            <p className="text-[10px] text-white/40 mt-0.5 font-myanmar">
              {lang === 'mm' ? items.length + ' ခု' : items.length + ' events'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 px-4 mb-4">
        <button
          onClick={() => setTab('upcoming')}
          className={'px-4 py-2 rounded-full text-xs font-semibold transition-colors ' + (
            tab === 'upcoming'
              ? 'bg-brand-600/60 text-brand-200 border border-brand-400/40'
              : 'bg-white/5 text-white/50 border border-white/10'
          )}
        >
          {lang === 'mm' ? 'လာမည့်' : 'Upcoming'} {upcoming.length > 0 && '(' + upcoming.length + ')'}
        </button>
        <button
          onClick={() => setTab('past')}
          className={'px-4 py-2 rounded-full text-xs font-semibold transition-colors ' + (
            tab === 'past'
              ? 'bg-brand-600/60 text-brand-200 border border-brand-400/40'
              : 'bg-white/5 text-white/50 border border-white/10'
          )}
        >
          {lang === 'mm' ? 'ပြီးသွားသည်' : 'Past'} {past.length > 0 && '(' + past.length + ')'}
        </button>
      </div>

      <div className="px-4 space-y-2">
        {loading ? (
          [1, 2, 3].map(n => <div key={n} className="h-24 rounded-2xl bg-white/4 animate-pulse" />)
        ) : list.length === 0 ? (
          <EmptyState
            icon="🎟️"
            title={tab === 'upcoming'
              ? (lang === 'mm' ? 'လာမည့် RSVP မရှိ' : 'No upcoming RSVPs')
              : (lang === 'mm' ? 'RSVP မှတ်တမ်း မရှိ' : 'No past RSVPs')}
            message={lang === 'mm' ? 'Calendar မှ Event များ RSVP လုပ်ပါ' : 'RSVP to events from the calendar'}
          />
        ) : (
          list.map(ev => {
            const cover = ev.cover_url ? getOptimizedUrl(ev.cover_url, { width: 300 }) : null
            const cd = getCountdown(ev.event_start, lang)
            const isPast = new Date(ev.event_end || ev.event_start) < now
            return (
              <div key={ev.id} className={'card-dark rounded-2xl overflow-hidden ' + (isPast ? 'opacity-60' : '')}>
                <div onClick={() => navigate('/news/' + ev.id)} className="flex gap-3 p-3 cursor-pointer">
                  <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {cover ? (
                      <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-2xl">📅</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate font-myanmar">
                      {lang === 'mm' ? (ev.title_mm || ev.title) : ev.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ' + (
                        ev._rsvp === 'going'
                          ? 'bg-green-500/15 text-green-400 border-green-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      )}>
                        {ev._rsvp === 'going' ? <CheckCircle size={9} /> : <Star size={9} />}
                        {ev._rsvp === 'going'
                          ? (lang === 'mm' ? 'တက်မည်' : 'Going')
                          : (lang === 'mm' ? 'စိတ်ဝင်စား' : 'Interested')}
                      </span>
                      {cd && <span className={'text-[10px] font-bold ' + cd.cls}>{cd.label}</span>}
                    </div>
                    {ev.event_start && (
                      <p className="text-[10px] text-white/40 mt-1 flex items-center gap-1">
                        <Clock size={9} />
                        {new Date(ev.event_start).toLocaleString(lang === 'mm' ? 'my-MM' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {ev.event_location && (
                      <p className="text-[10px] text-white/40 mt-0.5 flex items-center gap-1 truncate font-myanmar">
                        <MapPin size={9} /> {ev.event_location}
                      </p>
                    )}
                  </div>
                </div>
                {!isPast && (
                  <div className="border-t border-white/8">
                    <button
                      onClick={() => cancelRsvp(ev.id)}
                      className="w-full py-2.5 text-xs text-white/40 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                    >
                      {lang === 'mm' ? 'RSVP ပယ်ဖျက်' : 'Cancel RSVP'}
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
