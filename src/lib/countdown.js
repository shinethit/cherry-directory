/**
 * Event countdown — returns { label, cls, urgent }
 * Returns null for far-future or long-past events.
 */
export function getCountdown(iso, lang = 'mm') {
  if (!iso) return null
  const now = new Date()
  const target = new Date(iso)
  if (isNaN(target.getTime())) return null

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round((startOfDay(target) - startOfDay(now)) / 86400000)

  if (days < 0) {
    const abs = Math.abs(days)
    if (abs === 1) return { label: lang === 'mm' ? 'မနေ့က' : 'Yesterday', cls: 'text-white/30', urgent: false }
    if (abs < 7)   return { label: lang === 'mm' ? abs + ' ရက်က' : abs + 'd ago', cls: 'text-white/30', urgent: false }
    return null
  }
  if (days === 0) return { label: lang === 'mm' ? 'ယနေ့' : 'Today',       cls: 'text-green-400', urgent: true }
  if (days === 1) return { label: lang === 'mm' ? 'မနက်ဖန်' : 'Tomorrow',  cls: 'text-amber-400', urgent: true }
  if (days < 7)   return { label: lang === 'mm' ? days + ' ရက် ကျန်' : days + 'd left', cls: 'text-amber-400', urgent: days <= 3 }
  if (days < 30) {
    const w = Math.round(days / 7)
    return { label: lang === 'mm' ? (w * 7) + ' ရက် ကျန်' : w + 'w left', cls: 'text-white/50', urgent: false }
  }
  return null
}
