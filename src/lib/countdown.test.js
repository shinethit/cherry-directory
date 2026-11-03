import { describe, it, expect } from 'vitest'
import { getCountdown } from './countdown'

// Build an ISO date N days from today at local midnight, so the
// day-difference math is exact regardless of the time of day.
function isoDaysFromNow(n) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n)
  return d.toISOString()
}

describe('getCountdown', () => {
  it('returns null for missing / invalid input', () => {
    expect(getCountdown(null)).toBeNull()
    expect(getCountdown(undefined)).toBeNull()
    expect(getCountdown('')).toBeNull()
    expect(getCountdown('not-a-date')).toBeNull()
  })

  it('today → ယနေ့ (urgent)', () => {
    const c = getCountdown(new Date().toISOString(), 'mm')
    expect(c).toEqual({ label: 'ယနေ့', cls: 'text-green-400', urgent: true })
  })

  it('tomorrow → မနက်ဖန် (urgent)', () => {
    const c = getCountdown(isoDaysFromNow(1), 'mm')
    expect(c).toEqual({ label: 'မနက်ဖန်', cls: 'text-amber-400', urgent: true })
  })

  it('2–6 days → exact day count, urgent only within 3 days', () => {
    expect(getCountdown(isoDaysFromNow(2), 'mm')).toEqual({ label: '2 ရက် ကျန်', cls: 'text-amber-400', urgent: true })
    expect(getCountdown(isoDaysFromNow(3), 'mm')).toEqual({ label: '3 ရက် ကျန်', cls: 'text-amber-400', urgent: true })
    expect(getCountdown(isoDaysFromNow(4), 'mm').urgent).toBe(false)
    expect(getCountdown(isoDaysFromNow(6), 'mm').label).toBe('6 ရက် ကျန်')
  })

  it('7–29 days → exact day count (rounding fix: 10 days is "10 ရက် ကျန်", not "7 ရက် ကျန်")', () => {
    expect(getCountdown(isoDaysFromNow(7), 'mm').label).toBe('7 ရက် ကျန်')
    expect(getCountdown(isoDaysFromNow(10), 'mm').label).toBe('10 ရက် ကျန်')
    expect(getCountdown(isoDaysFromNow(11), 'mm').label).toBe('11 ရက် ကျန်')
    expect(getCountdown(isoDaysFromNow(25), 'mm').label).toBe('25 ရက် ကျန်')
    expect(getCountdown(isoDaysFromNow(29), 'mm').label).toBe('29 ရက် ကျန်')
    expect(getCountdown(isoDaysFromNow(10), 'mm').urgent).toBe(false)
  })

  it('30+ days → null (far future)', () => {
    expect(getCountdown(isoDaysFromNow(30), 'mm')).toBeNull()
    expect(getCountdown(isoDaysFromNow(90), 'mm')).toBeNull()
  })

  it('past days → မနေ့က / N ရက်က, 7+ days ago → null', () => {
    expect(getCountdown(isoDaysFromNow(-1), 'mm').label).toBe('မနေ့က')
    expect(getCountdown(isoDaysFromNow(-3), 'mm').label).toBe('3 ရက်က')
    expect(getCountdown(isoDaysFromNow(-6), 'mm').label).toBe('6 ရက်က')
    expect(getCountdown(isoDaysFromNow(-7), 'mm')).toBeNull()
  })

  it('English labels', () => {
    expect(getCountdown(isoDaysFromNow(0), 'en').label).toBe('Today')
    expect(getCountdown(isoDaysFromNow(1), 'en').label).toBe('Tomorrow')
    expect(getCountdown(isoDaysFromNow(10), 'en').label).toBe('10d left')
    expect(getCountdown(isoDaysFromNow(-1), 'en').label).toBe('Yesterday')
  })

  it('day boundaries are Myanmar wall dates, not device-local midnight', () => {
    // "Today" in Myanmar (Asia/Rangoon), as a wall-clock date string.
    const todayMm = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Rangoon' }).format(new Date())
    const [y, m, d] = todayMm.split('-').map(Number)
    const mmDate = (dayOffset, time) => {
      const dt = new Date(Date.UTC(y, m - 1, d + dayOffset))
      const yy = dt.getUTCFullYear()
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(dt.getUTCDate()).padStart(2, '0')
      return `${yy}-${mm}-${dd}T${time}+06:30`
    }
    // 00:30 MMT today is still "today" even though it is yesterday
    // evening in UTC / device-local time.
    expect(getCountdown(mmDate(0, '00:30:00'), 'mm').label).toBe('ယနေ့')
    expect(getCountdown(mmDate(0, '23:30:00'), 'mm').label).toBe('ယနေ့')
    // 00:30 MMT tomorrow is "tomorrow", not "today".
    expect(getCountdown(mmDate(1, '00:30:00'), 'mm').label).toBe('မနက်ဖန်')
    // 23:30 MMT yesterday is "yesterday".
    expect(getCountdown(mmDate(-1, '23:30:00'), 'mm').label).toBe('မနေ့က')
  })
})
