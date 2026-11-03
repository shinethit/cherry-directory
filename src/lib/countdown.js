/**
 * Event countdown — returns { label, cls, urgent }
 * Returns null for far-future or long-past events.
 * Day boundaries are Myanmar (Asia/Rangoon) wall dates, not the device's
 * local midnight — an event at 00:30 MMT is "today" even where the device
 * clock still shows yesterday evening.
 */
import { mmtDayNumber } from './myanmarDate'

export function getCountdown(iso, lang = 'mm') {
  if (!iso) return null
  const target = new Date(iso)
  if (isNaN(target.getTime())) return null

  const targetDay = mmtDayNumber(iso)
  const todayDay = mmtDayNumber(new Date())
  if (targetDay === null || todayDay === null) return null
  const days = targetDay - todayDay

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
    // Exact day count — rounding to whole weeks showed "7 ရက် ကျန်" for 10 days.
    return { label: lang === 'mm' ? days + ' ရက် ကျန်' : days + 'd left', cls: 'text-white/50', urgent: false }
  }
  return null
}
