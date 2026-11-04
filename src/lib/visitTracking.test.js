import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getDeviceType, formatPeakHour, peakHour, devicePercentages } from './visitTracking'

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

describe('getDeviceType', () => {
  it('iPhone UA is phone', () => {
    expect(getDeviceType(IPHONE_UA)).toBe('phone')
  })

  it('Android mobile UA is phone', () => {
    expect(getDeviceType(ANDROID_UA)).toBe('phone')
  })

  it('iPad UA is tablet', () => {
    expect(getDeviceType(IPAD_UA)).toBe('tablet')
  })

  it('Windows desktop UA is desktop', () => {
    expect(getDeviceType(DESKTOP_UA)).toBe('desktop')
  })

  it('empty / missing UA is desktop (never throws)', () => {
    expect(getDeviceType('')).toBe('desktop')
    expect(getDeviceType()).toBe('desktop')
  })
})

describe('peakHour / formatPeakHour', () => {
  it('finds the busiest hour from an RPC-style hour->count map', () => {
    expect(peakHour({ 9: 12, 19: 50, 20: 31 })).toBe(19)
    expect(formatPeakHour({ 9: 12, 19: 50, 20: 31 })).toBe('ည ၇ နာရီ')
  })

  it('accepts a 24-length array too', () => {
    const arr = new Array(24).fill(0)
    arr[8] = 5
    expect(formatPeakHour(arr)).toBe('မနက် ၈ နာရီ')
  })

  it('midnight is မနက် ၁၂ နာရီ, noon is နေ့လယ် ၁၂ နာရီ, 23 is ည ၁၁ နာရီ', () => {
    expect(formatPeakHour({ 0: 3 })).toBe('မနက် ၁၂ နာရီ')
    expect(formatPeakHour({ 12: 3 })).toBe('နေ့လယ် ၁၂ နာရီ')
    expect(formatPeakHour({ 23: 3 })).toBe('ည ၁၁ နာရီ')
  })

  it('returns null when there is no data at all', () => {
    expect(peakHour({})).toBe(null)
    expect(formatPeakHour({})).toBe(null)
    expect(formatPeakHour(new Array(24).fill(0))).toBe(null)
    expect(formatPeakHour(null)).toBe(null)
  })

  it('first max wins on ties', () => {
    expect(peakHour({ 10: 7, 18: 7 })).toBe(10)
  })
})

describe('devicePercentages', () => {
  it('splits counts into rounded percentages', () => {
    expect(devicePercentages({ phone: 75, tablet: 5, desktop: 20 }, 100)).toEqual({
      phone: 75,
      tablet: 5,
      desktop: 20,
    })
  })

  it('is all zeros when total is 0 (never NaN)', () => {
    expect(devicePercentages({}, 0)).toEqual({ phone: 0, tablet: 0, desktop: 0 })
    expect(devicePercentages({ phone: 5 }, 0)).toEqual({ phone: 0, tablet: 0, desktop: 0 })
  })

  it('tolerates missing keys', () => {
    expect(devicePercentages({ phone: 1 }, 4)).toEqual({ phone: 25, tablet: 0, desktop: 0 })
  })
})

describe('visit tracking wiring (v9.12)', () => {
  // No jsdom / testing-library in this repo (vitest runs in node env), so
  // the components themselves cannot be mounted here. These assertions pin
  // the wiring in the page source instead of pretending a component test ran.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const appSrc = readFileSync(join(root, 'App.jsx'), 'utf8')
  const homeSrc = readFileSync(join(root, 'pages', 'HomePage.jsx'), 'utf8')
  const libSrc = readFileSync(join(root, 'lib', 'visitTracking.js'), 'utf8')

  it('App logs one visit on mount (once per session, never throws)', () => {
    expect(appSrc).toContain("from './lib/visitTracking'")
    expect(appSrc).toMatch(/useEffect\(\(\) => \{\s*try \{ logVisit\(\) \} catch/)
  })

  it('logVisit guards on sessionStorage before any async work', () => {
    expect(libSrc).toContain("sessionStorage.getItem(VISIT_FLAG)")
    expect(libSrc).toContain("sessionStorage.setItem(VISIT_FLAG, '1')")
  })

  it('geo lookup goes direct to ipwho.is (never through the proxy) with a 3 s timeout', () => {
    expect(libSrc).toContain("fetch('https://ipwho.is/'")
    expect(libSrc).not.toMatch(/fetch\('\/api\/supabase/)
    expect(libSrc).toContain('3000')
  })

  it('stores no IP, user-agent string, identifier or name', () => {
    // navigator.userAgent is READ only to derive the device type — the
    // stored row holds device_type / country / page and nothing else.
    expect(libSrc).toContain('device_type: device')
    expect(libSrc).toContain('country_code: countryCode')
    expect(libSrc).toContain('country_name: countryName')
    expect(libSrc).not.toContain('user_agent')
    expect(libSrc).not.toMatch(/\.ip\b/i)
  })

  it('Home reads aggregates through the RPC (never a raw table select)', () => {
    expect(homeSrc).toContain("rpc('get_visit_stats')")
    expect(homeSrc).not.toContain("from('site_visits')")
  })
})
