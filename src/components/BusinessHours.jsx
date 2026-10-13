import { Clock } from 'lucide-react'

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const DAY_JS_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
const DAY_META = {
  mon: { mm: 'တနင်္လာ',   en: 'Mon' },
  tue: { mm: 'အင်္ဂါ',     en: 'Tue' },
  wed: { mm: 'ဗုဒ္ဓဟူး',  en: 'Wed' },
  thu: { mm: 'ကြာသပတေး', en: 'Thu' },
  fri: { mm: 'သောကြာ',    en: 'Fri' },
  sat: { mm: 'စနေ',        en: 'Sat' },
  sun: { mm: 'တနင်္ဂနွေ',  en: 'Sun' },
}

function parseMin(t) {
  if (!t || typeof t !== 'string') return null
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

export default function BusinessHours({ hours, lang = 'mm' }) {
  if (!hours || typeof hours !== 'object') return null

  const todayKey = Object.keys(DAY_JS_INDEX).find(
    k => DAY_JS_INDEX[k] === new Date().getDay()
  )
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const todayHours = hours[todayKey]
  let isOpen = false
  if (todayHours && todayHours.open && todayHours.close) {
    const o = parseMin(todayHours.open)
    const c = parseMin(todayHours.close)
    if (o != null && c != null) {
      if (c > o) isOpen = nowMin >= o && nowMin < c
      else isOpen = nowMin >= o || nowMin < c
    }
  }

  const hasAny = DAY_ORDER.some(d => hours[d] && hours[d].open && hours[d].close)
  if (!hasAny) return null

  return (
    <div className="card-dark p-4 rounded-2xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-brand-300" />
          <p className="text-xs text-white/40 font-display font-semibold uppercase tracking-wider">
            {lang === 'mm' ? 'ဖွင့်ချိန်' : 'Business Hours'}
          </p>
        </div>
        <span className={'flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ' + (
          isOpen
            ? 'bg-green-500/15 text-green-400 border-green-500/30'
            : 'bg-red-500/15 text-red-400 border-red-500/30'
        )}>
          <span className={'w-1.5 h-1.5 rounded-full ' + (isOpen ? 'bg-green-400 animate-pulse' : 'bg-red-400')} />
          {isOpen
            ? (lang === 'mm' ? 'ယခု ဖွင့်ထားသည်' : 'Open Now')
            : (lang === 'mm' ? 'ယခု ပိတ်ထားသည်' : 'Closed Now')}
        </span>
      </div>
      <div className="space-y-1">
        {DAY_ORDER.map(d => {
          const meta = DAY_META[d]
          const day = hours[d]
          const isToday = d === todayKey
          const closed = !day || !day.open || !day.close
          return (
            <div key={d} className={'flex justify-between items-center text-xs px-2 py-1.5 rounded-lg ' + (
              isToday ? 'bg-brand-600/20 text-brand-200 font-semibold' : 'text-white/60'
            )}>
              <span className="font-myanmar">{lang === 'mm' ? meta.mm : meta.en}</span>
              <span className="font-mono">
                {closed
                  ? (lang === 'mm' ? 'ပိတ်' : 'Closed')
                  : day.open + ' – ' + day.close}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BusinessHoursEditor({ value, onChange, lang = 'mm' }) {
  const hours = value || {}

  function toggleDay(dayId) {
    const cur = hours[dayId]
    if (cur && cur.open && cur.close) {
      const next = { ...hours }
      delete next[dayId]
      onChange(Object.keys(next).length ? next : null)
    } else {
      onChange({ ...hours, [dayId]: { open: '09:00', close: '17:00' } })
    }
  }

  function setTime(dayId, field, val) {
    const cur = hours[dayId] || { open: '09:00', close: '17:00' }
    onChange({ ...hours, [dayId]: { ...cur, [field]: val } })
  }

  function copyToAll() {
    const src = hours.mon
    if (!src) return
    const next = {}
    DAY_ORDER.forEach(d => { next[d] = { ...src } })
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {hours.mon && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={copyToAll}
            className="text-[10px] text-brand-300 hover:text-brand-200 font-myanmar"
          >
            {lang === 'mm' ? 'တနင်္လာကို ကျန်နေ့များသို့ ကူးမည်' : 'Copy Monday to all'}
          </button>
        </div>
      )}
      <div className="space-y-1.5">
        {DAY_ORDER.map(d => {
          const meta = DAY_META[d]
          const day = hours[d]
          const isOpen = day && day.open && day.close
          return (
            <div key={d} className="flex items-center gap-2">
              <span className={'w-20 text-xs flex-shrink-0 ' + (isOpen ? 'text-white/70' : 'text-white/30')}>
                {lang === 'mm' ? meta.mm : meta.en}
              </span>
              {isOpen ? (
                <>
                  <input
                    type="time"
                    value={day.open || '09:00'}
                    onChange={e => setTime(d, 'open', e.target.value)}
                    className="input-dark text-xs flex-1 min-w-0"
                  />
                  <span className="text-white/30 text-xs">–</span>
                  <input
                    type="time"
                    value={day.close || '17:00'}
                    onChange={e => setTime(d, 'close', e.target.value)}
                    className="input-dark text-xs flex-1 min-w-0"
                  />
                </>
              ) : (
                <span className="flex-1 text-xs text-white/30 italic font-myanmar px-2">
                  {lang === 'mm' ? 'ပိတ်ထားသည်' : 'Closed'}
                </span>
              )}
              <button
                type="button"
                onClick={() => toggleDay(d)}
                className={'text-[10px] px-2.5 py-1 rounded-lg transition-colors font-myanmar flex-shrink-0 ' + (
                  isOpen
                    ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                    : 'bg-green-500/15 text-green-400 hover:bg-green-500/25'
                )}
              >
                {isOpen
                  ? (lang === 'mm' ? 'ပိတ်' : 'Close')
                  : (lang === 'mm' ? 'ဖွင့်' : 'Open')}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
