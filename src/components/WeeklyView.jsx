import { mmtParts, MY_MONTHS, MY_WEEKDAYS } from '../lib/myanmarDate'

// Hardcoded English names — the grid is built from local Dates, and
// toLocaleDateString('en-US') is dropped for consistency with the
// Myanmar branch (same pattern as CalendarPage).
const EN_WEEKDAYS_S = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EN_MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatTime(iso, lang) {
  const p = mmtParts(iso)
  if (!p) return ''
  const h12 = p.hh % 12 === 0 ? 12 : p.hh % 12
  const mm = String(p.mm).padStart(2, '0')
  if (lang === 'mm') {
    const part = p.hh < 12 ? 'မနက်' : p.hh < 17 ? 'နေ့လယ်' : 'ည'
    return `${part} ${h12}:${mm}`
  }
  return `${h12}:${mm} ${p.hh < 12 ? 'AM' : 'PM'}`
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function WeeklyView({ events = [], selected, setSelected, lang = 'mm' }) {
  const weekStart = new Date(selected)
  weekStart.setDate(selected.getDate() - selected.getDay())

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  // Multi-day events appear on every day in [event_start, event_end].
  function eventsOnDay(date) {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    return events.filter(ev => {
      if (!ev.event_start) return false
      const start = new Date(ev.event_start)
      const end = ev.event_end ? new Date(ev.event_end) : start
      return start < dayEnd && end >= dayStart
    })
  }

  const today = new Date()

  return (
    <div className="px-4 space-y-2 mb-4">
      {days.map(day => {
        const dayEvents = eventsOnDay(day)
        const isToday = isSameDay(day, today)
        const isSel = isSameDay(day, selected)
        return (
          <div
            key={day.toISOString()}
            onClick={() => setSelected(day)}
            className={'cursor-pointer rounded-2xl p-3 border transition-colors ' + (
              isSel
                ? 'bg-brand-600/15 border-brand-400/40'
                : isToday
                ? 'bg-gold-500/8 border-gold-500/25'
                : 'bg-white/4 border-white/8 hover:bg-white/6'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={'text-sm font-display font-bold ' + (
                  isSel ? 'text-white' : isToday ? 'text-gold-400' : 'text-white/70'
                )}>
                  {lang === 'mm' ? MY_WEEKDAYS[day.getDay()] : EN_WEEKDAYS_S[day.getDay()]}
                </span>
                <span className="text-xs text-white/50">
                  {day.getDate()} {lang === 'mm' ? MY_MONTHS[day.getMonth()] : EN_MONTHS_S[day.getMonth()]}
                </span>
                {isToday && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">Today</span>
                )}
              </div>
              {dayEvents.length > 0 && (
                <span className="text-[10px] bg-brand-600/30 text-brand-300 px-2 py-0.5 rounded-full font-bold">
                  {dayEvents.length}
                </span>
              )}
            </div>
            {dayEvents.length === 0 ? (
              <p className="text-[10px] text-white/25 font-myanmar">
                {lang === 'mm' ? 'Event မရှိ' : 'No events'}
              </p>
            ) : (
              <div className="space-y-1">
                {dayEvents.map(ev => (
                  <div key={ev.id} className="flex items-start gap-2 py-0.5">
                    <span className="w-1 h-1 rounded-full bg-brand-400 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/80 truncate font-myanmar">
                        {lang === 'mm' ? (ev.title_mm || ev.title) : ev.title}
                      </p>
                      {ev.event_start && (
                        <p className="text-[9px] text-white/40 font-mono truncate">
                          {formatTime(ev.event_start, lang)}
                          {ev.event_location && ' · ' + ev.event_location}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
