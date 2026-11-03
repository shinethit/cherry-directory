import { describe, it, expect } from 'vitest'
import {
  MY_MONTHS,
  MY_WEEKDAYS,
  toMyanmarDigits,
  yangonToday,
  mmtParts,
  mmtDayNumber,
  formatMyanmarDate,
  formatMyanmarDateTime,
  formatMMTTime,
  timeAgoMm,
} from './myanmarDate'

describe('toMyanmarDigits', () => {
  it('converts every Latin digit', () => {
    expect(toMyanmarDigits('0123456789')).toBe('၀၁၂၃၄၅၆၇၈၉')
    expect(toMyanmarDigits(2026)).toBe('၂၀၂၆')
    expect(toMyanmarDigits('no digits')).toBe('no digits')
  })
})

describe('mmtParts', () => {
  it('returns null for missing / invalid input', () => {
    expect(mmtParts(null)).toBeNull()
    expect(mmtParts('')).toBeNull()
    expect(mmtParts('not-a-date')).toBeNull()
  })

  it('slices +06:30 wall times without shifting', () => {
    // 2026-11-03 is a Tuesday.
    const p = mmtParts('2026-11-03T19:05:00+06:30')
    expect(p).toEqual({ y: 2026, m: 11, d: 3, hh: 19, mm: 5, weekday: 2 })
  })

  it('converts legacy UTC values into Myanmar wall time', () => {
    // 12:35 UTC = 19:05 MMT on the same date.
    const p = mmtParts('2026-11-03T12:35:00Z')
    expect(p).toEqual({ y: 2026, m: 11, d: 3, hh: 19, mm: 5, weekday: 2 })
    // 18:00 UTC = 00:30 MMT the NEXT day.
    const q = mmtParts('2026-11-03T18:00:00Z')
    expect(q).toEqual({ y: 2026, m: 11, d: 4, hh: 0, mm: 30, weekday: 3 })
  })
})

describe('yangonToday', () => {
  it('returns a YYYY-MM-DD string for the Myanmar date', () => {
    const today = yangonToday()
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // It must agree with the MMT day number of "now".
    expect(mmtDayNumber(new Date())).toBe(mmtDayNumber(`${today}T12:00:00+06:30`))
  })
})

describe('mmtDayNumber', () => {
  it('agrees for the same MMT wall date across representations', () => {
    const a = mmtDayNumber('2026-11-03T00:30:00+06:30')
    const b = mmtDayNumber('2026-11-02T18:00:00Z') // same instant
    const c = mmtDayNumber('2026-11-03T23:59:00+06:30')
    expect(a).toBe(b)
    expect(a).toBe(c)
    expect(mmtDayNumber('2026-11-04T00:30:00+06:30')).toBe(a + 1)
  })

  it('returns null for invalid input', () => {
    expect(mmtDayNumber(null)).toBeNull()
    expect(mmtDayNumber('garbage')).toBeNull()
  })
})

describe('formatMyanmarDate', () => {
  it('uses hardcoded Myanmar month names and Myanmar digits', () => {
    expect(formatMyanmarDate('2026-01-05T10:00:00+06:30')).toBe('ဇန်နဝါရီ ၅ ရက်')
    expect(formatMyanmarDate('2026-11-03T10:00:00+06:30', { weekday: true })).toBe('အင်္ဂါ၊ နိုဝင်ဘာ ၃ ရက်')
    expect(formatMyanmarDate('2026-11-03T10:00:00+06:30', { year: true })).toBe('နိုဝင်ဘာ ၃ ရက်၊ ၂၀၂၆')
  })

  it('covers all 12 months and 7 weekdays', () => {
    expect(MY_MONTHS).toHaveLength(12)
    expect(MY_WEEKDAYS).toHaveLength(7)
    for (let m = 1; m <= 12; m++) {
      const s = formatMyanmarDate(`2026-${String(m).padStart(2, '0')}-15T10:00:00+06:30`)
      expect(s).toContain(MY_MONTHS[m - 1])
      expect(s).not.toMatch(/[0-9]/)
    }
  })

  it('returns empty string for invalid input', () => {
    expect(formatMyanmarDate(null)).toBe('')
    expect(formatMyanmarDate('garbage')).toBe('')
  })
})

describe('formatMyanmarDateTime', () => {
  it('uses Myanmar digits and the daypart', () => {
    expect(formatMyanmarDateTime('2026-11-03T07:05:00+06:30')).toBe('နိုဝင်ဘာ ၃ ရက်၊ မနက် ၇:၀၅')
    expect(formatMyanmarDateTime('2026-11-03T13:30:00+06:30')).toBe('နိုဝင်ဘာ ၃ ရက်၊ နေ့လယ် ၁:၃၀')
    expect(formatMyanmarDateTime('2026-11-03T19:00:00+06:30')).toBe('နိုဝင်ဘာ ၃ ရက်၊ ည ၇:၀၀')
    expect(formatMyanmarDateTime('2026-11-03T00:15:00+06:30')).toBe('နိုဝင်ဘာ ၃ ရက်၊ မနက် ၁၂:၁၅')
  })
})

describe('formatMMTTime', () => {
  it('formats time-only in Myanmar time with Myanmar digits', () => {
    expect(formatMMTTime('2026-11-03T19:05:00+06:30')).toBe('ည ၇:၀၅')
    expect(formatMMTTime('2026-11-03T09:30:00+06:30')).toBe('မနက် ၉:၃၀')
    // A UTC instant just after midnight device-local is still the same MMT evening.
    expect(formatMMTTime('2026-11-03T12:35:00Z')).toBe('ည ၇:၀၅')
  })

  it('formats English 12-hour time', () => {
    expect(formatMMTTime('2026-11-03T19:05:00+06:30', 'en')).toBe('7:05 PM')
    expect(formatMMTTime('2026-11-03T09:30:00+06:30', 'en')).toBe('9:30 AM')
    expect(formatMMTTime('2026-11-03T00:15:00+06:30', 'en')).toBe('12:15 AM')
  })

  it('returns empty string for invalid input', () => {
    expect(formatMMTTime(null)).toBe('')
    expect(formatMMTTime('garbage')).toBe('')
  })
})

describe('timeAgoMm', () => {
  it('uses Myanmar digits for minutes / hours / days', () => {
    const now = Date.now()
    expect(timeAgoMm(new Date(now - 5 * 60000).toISOString())).toBe('၅ မိနစ်က')
    expect(timeAgoMm(new Date(now - 2 * 3600000).toISOString())).toBe('၂ နာရီက')
    expect(timeAgoMm(new Date(now - 3 * 86400000).toISOString())).toBe('၃ ရက်က')
    expect(timeAgoMm(new Date(now - 10000).toISOString())).toBe('ခုလေးတင်')
    // Future timestamps also read as "just now".
    expect(timeAgoMm(new Date(now + 60000).toISOString())).toBe('ခုလေးတင်')
  })

  it('falls back to the full Myanmar date after a week', () => {
    const d = new Date(Date.now() - 10 * 86400000)
    const expected = formatMyanmarDate(d.toISOString())
    expect(timeAgoMm(d.toISOString())).toBe(expected)
    expect(timeAgoMm(d.toISOString())).not.toMatch(/[0-9]/)
  })

  it('returns empty string for missing / invalid input', () => {
    expect(timeAgoMm(null)).toBe('')
    expect(timeAgoMm('garbage')).toBe('')
  })
})
