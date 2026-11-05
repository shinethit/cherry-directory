import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, CheckCircle, Star, Clock, XCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { useSEO } from '../hooks/useSEO'
import { goBackOrHome } from '../lib/navigation'
import { EmptyState } from '../components/UI'
import { getOptimizedUrl } from '../lib/cloudinary'
import { getCountdown } from '../lib/countdown'
import { formatMyanmarDateTime } from '../lib/myanmarDate'
import { confirmDialog } from '../lib/confirmDialog'
import { showError, showSuccess } from '../lib/toast'

// RSVP status → honest label (never collapse a real status into "Interested").
const RSVP_STATUS = {
  going:       { mm: 'တက်မည်',        en: 'Going',       cls: 'bg-green-500/15 text-green-400 border-green-500/30', icon: CheckCircle },
  interested:  { mm: 'စိတ်ဝင်စား',     en: 'Interested',  cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Star },
  not_going:   { mm: 'မတက်ပါ',        en: 'Not going',   cls: 'bg-white/10 text-white/50 border-white/15',        icon: XCircle },
  maybe:       { mm: 'မသေချာသေး',     en: 'Maybe',       cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Star },
}

export default function MyRsvpsPage() {
  const navigate = useNavigate()
  const { user, isLoggedIn, refreshProfile } = useAuth()
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'တက်မည့် ဖြစ်ရပ်များ' : 'My RSVPs' })

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState('upcoming')

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setLoadError('')
    try {
      // 30 s timeout (was none): a hung query left the list on skeletons forever.
      const { data, error } = await withTimeout(supabase
        .from('event_rsvps')
        .select('status, post:posts(id, title, title_mm, cover_url, event_start, event_end, event_location, type, status)')
        .eq('user_id', user.id), 30000, 'My RSVPs')
      if (error) throw error
      // Keep RSVPs whose event is unpublished/withdrawn — show them as
      // "ပွဲဖျက်သိမ်းပြီး/မထုတ်ဝေတော့ပါ" instead of silently dropping them.
      // Only drop rows whose event no longer exists at all (post === null).
      const list = (data || [])
        .map(r => (r.post ? { ...r.post, _rsvp: r.status } : null))
        .filter(p => p && p.type === 'event')
      setItems(list)
    } catch (e) {
      console.warn(e)
      // V4: never render the raw Supabase English message — store a
      // marker only; the screen renders fixed Myanmar text + Retry.
      setLoadError('load_failed')
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  async function cancelRsvp(postId) {
    if (!(await confirmDialog(lang === 'mm' ? 'RSVP ပယ်ဖျက်မှာ သေချာလား?' : 'Cancel RSVP?'))) return
    const prev = items
    setItems(prev => prev.filter(i => i.id !== postId))
    const { error } = await supabase.from('event_rsvps').delete().match({ post_id: postId, user_id: user.id })
    if (error) {
      console.error('Cancel RSVP failed:', error)
      showError(error.message || (lang === 'mm' ? 'RSVP ပယ်ဖျက်မရပါ — ထပ်ကြိုးစားပါ' : 'Could not cancel RSVP — please try again'))
      setItems(prev)
    } else {
      showSuccess(lang === 'mm' ? 'RSVP ပယ်ဖျက်ပြီးပါပြီ' : 'RSVP cancelled')
      refreshProfile()
    }
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
  const nowMs = now.getTime()
  // Event end/start as a timestamp, or null when the date is missing or
  // invalid. new Date(null) is 1970 — a dateless event must NEVER sort
  // as "past" (F-LOW-8): unknown dates count as upcoming.
  function eventEndMs(ev) {
    const t = new Date(ev.event_end || ev.event_start).getTime()
    return Number.isNaN(t) ? null : t
  }
  const upcoming = items.filter(i => { const t = eventEndMs(i); return t === null || t >= nowMs })
    .sort((a, b) => {
      const ta = eventEndMs(a), tb = eventEndMs(b)
      if (ta === null && tb === null) return 0
      if (ta === null) return 1
      if (tb === null) return -1
      return ta - tb
    })
  const past = items.filter(i => { const t = eventEndMs(i); return t !== null && t < nowMs })
    .sort((a, b) => eventEndMs(b) - eventEndMs(a))

  const list = tab === 'upcoming' ? upcoming : past

  return (
    <div className="pb-8 min-h-[80dvh]">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => goBackOrHome(navigate, '/calendar')} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              🎟️ {lang === 'mm' ? 'တက်မည့် ဖြစ်ရပ်များ' : 'My RSVPs'}
            </h1>
            <p className="text-[10px] text-white/60 mt-0.5 font-myanmar">
              {/* F13: on error the count is unknown — show "—", never "0 ခု". */}
              {loadError ? '—' : lang === 'mm' ? list.length + ' ခု' : list.length + ' events'}
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
        ) : loadError ? (
          <div className="flex flex-col items-center py-16 text-center px-8">
            <span className="text-5xl mb-4">⚠️</span>
            <p className="font-display font-semibold text-white/70">
              {lang === 'mm' ? 'RSVP များ ရယူမရပါ' : 'Could not load your RSVPs'}
            </p>
            <p className="text-xs text-white/60 mt-1 font-myanmar max-w-xs">
              {lang === 'mm' ? 'တင်မရပါ — ပြန်ကြိုးစားမည်' : 'Could not load — please try again'}
            </p>
            <button onClick={load} className="btn-primary text-sm mt-4 px-5 py-2">
              {lang === 'mm' ? 'ထပ်ကြိုးစားမည်' : 'Retry'}
            </button>
          </div>
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
            // Unknown dates are upcoming, never past (F-LOW-8).
            const isPast = eventEndMs(ev) !== null && eventEndMs(ev) < nowMs
            const isUnpublished = ev.status !== 'published'
            const rsvpMeta = RSVP_STATUS[ev._rsvp] || RSVP_STATUS.interested
            const RsvpIcon = rsvpMeta.icon
            return (
              <div key={ev.id} className={'card-dark rounded-2xl overflow-hidden ' + (isPast || isUnpublished ? 'opacity-60' : '')}>
                <div onClick={() => navigate('/news/' + ev.id)} tabIndex={0} role="button" onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/news/' + ev.id) } }} className="flex gap-3 p-3 cursor-pointer">
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
                    {isUnpublished && (
                      <p className="text-[10px] text-red-400 font-myanmar mt-0.5">
                        {lang === 'mm' ? '⚠️ ပွဲဖျက်သိမ်းပြီး / မထုတ်ဝေတော့ပါ' : '⚠️ Event cancelled / unpublished'}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ' + rsvpMeta.cls}>
                        <RsvpIcon size={9} />
                        {lang === 'mm' ? rsvpMeta.mm : rsvpMeta.en}
                      </span>
                      {cd && <span className={'text-[10px] font-bold ' + cd.cls}>{cd.label}</span>}
                    </div>
                    {ev.event_start && (
                      <p className="text-[10px] text-white/60 mt-1 flex items-center gap-1">
                        <Clock size={9} />
                        {lang === 'mm'
                          ? 'ပွဲရက်: ' + formatMyanmarDateTime(ev.event_start)
                          : 'Date: ' + new Date(ev.event_start).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {ev.event_location && (
                      <p className="text-[10px] text-white/60 mt-0.5 flex items-center gap-1 truncate font-myanmar">
                        <MapPin size={9} /> {ev.event_location}
                      </p>
                    )}
                  </div>
                </div>
                {!isPast && !isUnpublished && (
                  <div className="border-t border-white/8">
                    <button
                      onClick={() => cancelRsvp(ev.id)}
                      className="w-full py-2.5 text-xs text-white/60 hover:text-red-400 hover:bg-red-500/5 transition-colors"
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
