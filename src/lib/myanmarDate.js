// Shared Myanmar date helpers — v0.9.1.
// Rule: NEVER format dates with toLocaleDateString('my-MM', ...) — the 'my-MM'
// locale is missing on many phones and silently falls back to English.
// Use the hardcoded Myanmar month/weekday names below instead (same pattern as
// CalendarPage / BusinessHours). All stored datetimes are Myanmar wall time
// (ISO with +06:30 offset); never shift them through toISOString().

export const MY_MONTHS = [
  'ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်',
  'ဇူလိုင်', 'သြဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ',
]

export const MY_WEEKDAYS = [
  'တနင်္ဂနွေ', 'တနင်္လာ', 'အင်္ဂါ', 'ဗုဒ္ဓဟူး', 'ကြာသပတေး', 'သောကြာ', 'စနေ',
]

// Today's date in Myanmar (Asia/Rangoon), as 'YYYY-MM-DD'.
// Use this for day boundaries (consent gate, "New Today") — never the UTC date.
export function yangonToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Rangoon' }).format(new Date())
}

// Wall-clock parts of an ISO datetime, in Myanmar time.
// For values stored with +06:30 this is just the sliced string (no shift);
// for legacy UTC ('Z') values it converts via Intl in Asia/Rangoon.
export function mmtParts(iso) {
  if (!iso) return null
  const s = String(iso)
  if (/[+-]\d{2}:\d{2}$/.test(s)) {
    const [date, time] = s.split('T')
    const [y, m, d] = date.split('-').map(Number)
    const [hh, mm] = (time || '00:00').split(':').map(Number)
    const weekday = new Date(y, m - 1, d).getDay()
    return { y, m, d, hh, mm, weekday }
  }
  const dt = new Date(s)
  if (Number.isNaN(dt.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Rangoon',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(dt)
  const get = (t) => Number(parts.find((p) => p.type === t)?.value)
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const wd = parts.find((p) => p.type === 'weekday')?.value
  return { y: get('year'), m: get('month'), d: get('day'), hh: get('hour'), mm: get('minute'), weekday: weekdayNames.indexOf(wd) }
}

// "ဇန်နဝါရီ 5 ရက်" / with weekday: "အင်္ဂါ၊ ဇန်နဝါရီ 5 ရက်"
// withYear: "ဇန်နဝါရီ 5 ရက်၊ 2026"
export function formatMyanmarDate(iso, { weekday = false, year = false } = {}) {
  const p = mmtParts(iso)
  if (!p) return ''
  const core = `${MY_MONTHS[p.m - 1]} ${p.d} ရက်`
  const withWd = weekday ? `${MY_WEEKDAYS[p.weekday]}၊ ${core}` : core
  return year ? `${withWd}၊ ${p.y}` : withWd
}

// "ဇန်နဝါရီ 5 ရက်၊ ည 7:00" — 12-hour clock with မြန်မာ daypart.
export function formatMyanmarDateTime(iso, { weekday = false } = {}) {
  const p = mmtParts(iso)
  if (!p) return ''
  const hour12 = p.hh % 12 === 0 ? 12 : p.hh % 12
  const part = p.hh < 12 ? 'မနက်' : p.hh < 17 ? 'နေ့လယ်' : 'ည'
  const mm = String(p.mm).padStart(2, '0')
  return `${formatMyanmarDate(iso, { weekday })}၊ ${part} ${hour12}:${mm}`
}

// datetime-local value ("2026-11-05T19:00", a Myanmar wall time the user typed)
// → ISO string with the +06:30 offset. NEVER new Date(v).toISOString() — that
// shifts the wall time back to UTC (the 6.5h event drift bug).
export function localInputToMMT(value) {
  if (!value) return null
  return `${value}:00+06:30`.replace('T', 'T')
}

// Stored ISO datetime → datetime-local value ("YYYY-MM-DDTHH:mm") in Myanmar
// wall time, for prefilling a datetime-local input.
export function mmtInputFromStored(iso) {
  const p = mmtParts(iso)
  if (!p) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.hh)}:${pad(p.mm)}`
}

// Short relative time in Myanmar, e.g. "၅ မိနစ်က", "၂ နာရီက", "မနေ့က".
// Pass a Date/ISO; compares against now (device clock).
export function timeAgoMm(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  if (diff < 0) return 'ခုလေးတင်'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ခုလေးတင်'
  if (mins < 60) return `${mins} မိနစ်က`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} နာရီက`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ရက်က`
  return formatMyanmarDate(iso)
}
