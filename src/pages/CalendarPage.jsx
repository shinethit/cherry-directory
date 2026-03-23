import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MapPin, Clock, CheckCircle, Star, Plus, Edit3 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../hooks/useAppConfig'
import { useSEO } from '../hooks/useSEO'
import { getOptimizedUrl } from '../lib/cloudinary'

// Myanmar month names
const MM_MONTHS = ['ဇန်နဝါရီ','ဖေဖော်ဝါရီ','မတ်','ဧပြီ','မေ','ဇွန်','ဇူလိုင်','သြဂုတ်','စက်တင်ဘာ','အောက်တိုဘာ','နိုဝင်ဘာ','ဒီဇင်ဘာ']
const EN_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MM_DAYS   = ['တ','လ','အ','ဗ','က','သ','နွ']
const EN_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatTime(iso, lang) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(lang === 'mm' ? 'my-MM' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDateRange(start, end, lang) {
  const s = new Date(start)
  const e = end ? new Date(end) : null
  const opts = { month: 'short', day: 'numeric' }
  const locale = lang === 'mm' ? 'my-MM' : 'en-US'
  if (!e || isSameDay(s, e)) return s.toLocaleDateString(locale, { ...opts, year: 'numeric' })
  return `${s.toLocaleDateString(locale, opts)} – ${e.toLocaleDateString(locale, opts)}`
}

// ── RSVP Button ───────────────────────────────────────────────
function RsvpButton({ postId }) {
  const { isLoggedIn, user, isModerator, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState(null) // null | 'going' | 'interested'
  const [counts, setCounts] = useState({ going: 0, interested: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {

    try {
        const [{ data: all }, { data: mine }] = await Promise.all([
          supabase.from('event_rsvps').select('status').eq('post_id', postId),
          user ? supabase.from('event_rsvps').select('status').eq('post_id', postId).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
        ])
        const c = { going: 0, interested: 0 }
        ;(all || []).forEach(r => { if (r.status in c) c[r.status]++ })
        setCounts(c)
        setStatus(mine?.status || null)
    
    } catch (e) { console.warn(e) }
  }
    load()
  }, [postId, user])

  async function rsvp(newStatus) {
    if (!isLoggedIn) { navigate('/login'); return }
    setLoading(true)
    if (status === newStatus) {
      await supabase.from('event_rsvps').delete().match({ post_id: postId, user_id: user.id })
      setCounts(c => ({ ...c, [newStatus]: Math.max(0, c[newStatus] - 1) }))
      setStatus(null)
    } else {
      if (status) setCounts(c => ({ ...c, [status]: Math.max(0, c[status] - 1) }))
      await supabase.from('event_rsvps').upsert({ post_id: postId, user_id: user.id, status: newStatus })
      setCounts(c => ({ ...c, [newStatus]: c[newStatus] + 1 }))
      setStatus(newStatus)
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => rsvp('going')}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
          status === 'going'
            ? 'bg-green-500/25 border-green-500/50 text-green-400'
            : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
        }`}
      >
        <CheckCircle size={12} />
        Going {counts.going > 0 && <span className="bg-white/15 px-1 rounded-full">{counts.going}</span>}
      </button>
      <button
        onClick={() => rsvp('interested')}
        disabled={loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
          status === 'interested'
            ? 'bg-amber-500/25 border-amber-500/50 text-amber-400'
            : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
        }`}
      >
        <Star size={11} />
        Interested {counts.interested > 0 && <span className="bg-white/15 px-1 rounded-full">{counts.interested}</span>}
      </button>
    </div>
  )
}

function EventCard({ event, compact = false }) {
  const navigate = useNavigate()
  const { lang } = useLang()
  const { user, isAdmin, isModerator } = useAuth()
  const cover = event.cover_url ? getOptimizedUrl(event.cover_url, { width: 400 }) : null
  const isMultiDay = event.event_end && !isSameDay(new Date(event.event_start), new Date(event.event_end))
  const isPast = event.event_end
    ? new Date(event.event_end) < new Date()
    : new Date(event.event_start) < new Date()
  const isToday = isSameDay(new Date(event.event_start || event.created_at), new Date())
  const canEdit = isAdmin || isModerator || event.author_id === user?.id

  return (
    <div
      onClick={() => navigate(`/news/${event.id}`)}
      className={`card-listing cursor-pointer overflow-hidden transition-all ${isPast ? 'opacity-60' : ''}`}
    >
      {!compact && cover && (
        <div className="h-36 overflow-hidden relative">
          <img src={cover} alt={event.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          {isToday && (
            <span className="absolute top-2 left-2 bg-green-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
              Today
            </span>
          )}
          {isPast && (
            <span className="absolute top-2 right-2 bg-white/20 text-white/60 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
              Ended
            </span>
          )}
          {/* Edit button overlay */}
          {canEdit && (
            <button
              onClick={e => { e.stopPropagation(); navigate(`/events/edit/${event.id}`) }}
              className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-lg flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <Edit3 size={13} className="text-white" />
            </button>
          )}
        </div>
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-start gap-2">
          {/* Date chip */}
          {event.event_start && (
            <div className="flex-shrink-0 w-12 text-center bg-brand-600/30 border border-brand-400/25 rounded-xl py-1.5 px-1">
              <p className="text-[9px] text-brand-300 font-display font-bold uppercase leading-none">
                {new Date(event.event_start).toLocaleDateString(lang === 'mm' ? 'my-MM' : 'en-US', { month: 'short' })}
              </p>
              <p className="text-lg font-display font-bold text-white leading-tight">
                {new Date(event.event_start).getDate()}
              </p>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1">
              <h3 className="font-display font-semibold text-sm text-white line-clamp-2 leading-snug flex-1">
                {lang === 'mm' ? (event.title_mm || event.title) : event.title}
              </h3>
              {/* Edit button for compact/no-cover cards */}
              {canEdit && compact && (
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/events/edit/${event.id}`) }}
                  className="flex-shrink-0 w-6 h-6 bg-white/8 rounded-lg flex items-center justify-center hover:bg-white/12 transition-colors"
                >
                  <Edit3 size={11} className="text-white/50" />
                </button>
              )}
            </div>
            {event.event_start && (
              <div className="flex items-center gap-1 mt-1 text-white/40">
                <Clock size={10} />
                <span className="text-[10px]">
                  {formatTime(event.event_start, lang)}
                  {isMultiDay ? ` — ${formatDateRange(event.event_start, event.event_end, lang)}` : ''}
                </span>
              </div>
            )}
            {event.event_location && (
              <div className="flex items-center gap-1 mt-0.5 text-white/40">
                <MapPin size={10} />
                <span className="text-[10px] truncate font-myanmar">{event.event_location}</span>
              </div>
            )}
          </div>
        </div>

        {!compact && !isPast && (
          <div onClick={e => e.stopPropagation()}>
            <RsvpButton postId={event.id} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Calendar Page ─────────────────────────────────────────
export default function CalendarPage() {
  const navigate = useNavigate()
  const { lang } = useLang()
  const config = useAppConfig()
  const { isLoggedIn, isModerator, isAdmin, user } = useAuth()
  const MONTHS = lang === 'mm' ? MM_MONTHS : EN_MONTHS
  const DAYS   = lang === 'mm' ? MM_DAYS   : EN_DAYS
  useSEO({ title: lang === 'mm' ? 'Event Calendar' : 'Event Calendar' })

  const today = new Date()
  const [viewYear, setViewYear]   = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selected, setSelected]   = useState(today)
  const [events, setEvents]       = useState([])      // all events for this month
  const [upcoming, setUpcoming]   = useState([])      // next 5 upcoming
  const [loading, setLoading]     = useState(true)

  // Build calendar grid for current view month
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const gridCells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : new Date(viewYear, viewMonth, i - firstDay + 1)
  )

  // Load events for current month (±1 day buffer for timezone)
  const loadEvents = useCallback(async () => {
    setLoading(true)
    const from = new Date(viewYear, viewMonth, 1).toISOString()
    const to   = new Date(viewYear, viewMonth + 1, 1).toISOString()

    const { data } = await supabase
      .from('posts')
      .select('id, title, title_mm, cover_url, event_start, event_end, event_location, type, status, author_id')
      .eq('type', 'event')
      .eq('status', 'published')
      .gte('event_start', from)
      .lt('event_start', to)
      .order('event_start')

    setEvents(data || [])
    setLoading(false)
  }, [viewYear, viewMonth])

  // Load upcoming events (next 10 from today)
  useEffect(() => {
    supabase
      .from('posts')
      .select('id, title, title_mm, cover_url, event_start, event_end, event_location, type, author_id')
      .eq('type', 'event')
      .eq('status', 'published')
      .gte('event_start', today.toISOString())
      .order('event_start')
      .limit(10)
      .then(({ data }) => setUpcoming(data || []))
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // Events that have a dot on a given day
  function eventsOnDay(date) {
    return events.filter(ev => ev.event_start && isSameDay(new Date(ev.event_start), date))
  }

  // Events for selected day
  const selectedEvents = selected ? eventsOnDay(selected) : []

  return (
    <div className="pb-8">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">
            {lang === 'mm' ? 'ဖြစ်ရပ် Calendar' : 'Event Calendar'}
          </h1>
          <p className="text-xs text-white/40 mt-0.5">
            {lang === 'mm' ? `${config.app_city || ''} ဖြစ်ရပ်များ` : 'Events'}
          </p>
        </div>
        {/* Create event — Admin / Moderator only */}
        {(isAdmin || isModerator) && (
          <button
            onClick={() => navigate('/events/create')}
            className="flex items-center gap-1.5 btn-primary text-xs px-3 py-2 flex-shrink-0"
          >
            <Plus size={14} /> Event ထည့်
          </button>
        )}
      </div>

      {/* ── Month grid ── */}
      <div className="mx-4 card-dark rounded-3xl overflow-hidden border border-white/6">
        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors"
          >
            <ChevronLeft size={16} className="text-white/60" />
          </button>
          <div className="text-center">
            <p className="font-display font-bold text-base text-white">
              {MONTHS[viewMonth]}
            </p>
            <p className="text-[10px] text-white/40 font-mono">{viewYear}</p>
          </div>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors"
          >
            <ChevronRight size={16} className="text-white/60" />
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 border-b border-white/6">
          {DAYS.map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-display font-bold text-white/30">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 p-2 gap-0.5">
          {gridCells.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} />
            const dots = eventsOnDay(date)
            const isToday = isSameDay(date, today)
            const isSelected = isSameDay(date, selected)
            const hasDots = dots.length > 0

            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelected(date)}
                className={`relative flex flex-col items-center justify-start py-1.5 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-brand-600/70 border border-brand-400/50'
                    : isToday
                    ? 'bg-gold-500/15 border border-gold-500/30'
                    : hasDots
                    ? 'hover:bg-white/6'
                    : 'hover:bg-white/4'
                }`}
              >
                <span className={`text-xs font-display font-semibold leading-none ${
                  isSelected ? 'text-white' : isToday ? 'text-gold-400' : hasDots ? 'text-white' : 'text-white/40'
                }`}>
                  {date.getDate()}
                </span>
                {/* Event dots */}
                {hasDots && (
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center max-w-[28px]">
                    {dots.slice(0, 3).map((_, di) => (
                      <div
                        key={di}
                        className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/70' : 'bg-brand-400'}`}
                      />
                    ))}
                    {dots.length > 3 && (
                      <div className="w-1 h-1 rounded-full bg-white/30" />
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="py-3 text-center text-xs text-white/30">
            {lang === 'mm' ? 'တင်နေသည်...' : 'Loading...'}
          </div>
        )}
      </div>

      {/* ── Selected day events ── */}
      <div className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-display font-bold text-sm text-white">
              {selected.toLocaleDateString(lang === 'mm' ? 'my-MM' : 'en-US', {
                weekday: 'long', month: 'long', day: 'numeric'
              })}
            </p>
            {selectedEvents.length === 0 && (
              <p className="text-xs text-white/30 mt-0.5 font-myanmar">
                {lang === 'mm' ? 'ဤရက်တွင် Event မရှိပါ' : 'No events on this day'}
              </p>
            )}
          </div>
          {isSameDay(selected, today) && (
            <span className="badge bg-green-500/20 text-green-400 border border-green-500/30 text-[9px]">Today</span>
          )}
        </div>

        <div className="space-y-2">
          {selectedEvents.map(ev => (
            <EventCard key={ev.id} event={ev} />
          ))}
        </div>
      </div>

      {/* ── Upcoming events ── */}
      {upcoming.length > 0 && (
        <div className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-display font-bold text-sm text-white">
                {lang === 'mm' ? 'လာမည့် ဖြစ်ရပ်များ' : 'Upcoming Events'}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">
                {lang === 'mm' ? 'နောက်ထပ် ဖြစ်ရပ်များ' : 'Next scheduled events'}
              </p>
            </div>
            <button
              onClick={() => navigate('/news?type=event')}
              className="text-xs text-brand-300 hover:text-brand-200 transition-colors font-semibold"
            >
              {lang === 'mm' ? 'အားလုံး →' : 'See all →'}
            </button>
          </div>
          <div className="space-y-2">
            {upcoming.slice(0, 5).map(ev => (
              <EventCard key={ev.id} event={ev} compact />
            ))}
          </div>
        </div>
      )}

      {/* Empty full month state */}
      {!loading && events.length === 0 && upcoming.length === 0 && (
        <div className="flex flex-col items-center py-14 text-center px-8">
          <span className="text-5xl mb-4">📅</span>
          <p className="font-display font-semibold text-white/50">
            {lang === 'mm' ? 'Event မရှိသေးပါ' : 'No events yet'}
          </p>
          <p className="text-xs text-white/30 mt-1 font-myanmar">
            {lang === 'mm' ? 'ဤလတွင် Event မရှိပါ' : 'No events scheduled for this month'}
          </p>
        </div>
      )}
    </div>
  )
}
