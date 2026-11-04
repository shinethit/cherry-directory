// Visitor tracking — v9.12. Privacy-first: NO IP, NO user-agent string,
// NO identifiers, NO names are ever stored. Each visit row holds only
// timestamp, device type, country code/name, and entry page. The public
// Hero/Dashboard show ONLY aggregates via the get_visit_stats RPC —
// raw visit rows are never exposed to the client.
// NOTE: the supabase client is imported lazily inside logVisit so this
// module stays importable in vitest (node env has no VITE_ env vars and
// src/lib/supabase.js throws without them).
import { toMyanmarDigits } from './myanmarDate'

const VISIT_FLAG = 'cherry-visit-logged'

export function getDeviceType(ua) {
  const s = typeof ua === 'string'
    ? ua
    : (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  // iPad on newer Safari reports a desktop UA, so some tablets read as
  // 'desktop' — acceptable for an aggregate split.
  if (/iPad|Tablet/i.test(s)) return 'tablet'
  if (/Mobi|Android|iPhone|iPod/i.test(s)) return 'phone'
  return 'desktop'
}

// Peak hour (0-23) from an hour->count map (the RPC returns by_hour as
// {"0": n, ..., "23": n}) or a 24-length array. Returns null when there
// is no data at all. First max wins on ties.
export function peakHour(hourCounts) {
  const counts = new Array(24).fill(0)
  if (Array.isArray(hourCounts)) {
    for (let h = 0; h < 24; h++) counts[h] = Number(hourCounts[h]) || 0
  } else if (hourCounts && typeof hourCounts === 'object') {
    for (let h = 0; h < 24; h++) counts[h] = Number(hourCounts[String(h)]) || 0
  }
  const total = counts.reduce((a, b) => a + b, 0)
  if (total === 0) return null
  let best = 0
  for (let h = 1; h < 24; h++) {
    if (counts[h] > counts[best]) best = h
  }
  return best
}

// Peak hour as a short Burmese label, e.g. 19 -> 'ည ၇ နာရီ'.
// Dayparts follow src/lib/myanmarDate.js: မနက် <12, နေ့လယ် <17, ည after.
export function formatPeakHour(hourCounts) {
  const h = peakHour(hourCounts)
  if (h === null) return null
  const part = h < 12 ? 'မနက်' : h < 17 ? 'နေ့လယ်' : 'ည'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${part} ${toMyanmarDigits(hour12)} နာရီ`
}

// Device counts -> percentages (rounded). All 0 when total is 0.
export function devicePercentages(byDevice, total) {
  const t = Number(total) || 0
  const get = (k) => {
    const c = Number(byDevice?.[k]) || 0
    return t === 0 ? 0 : Math.round((c / t) * 100)
  }
  return { phone: get('phone'), tablet: get('tablet'), desktop: get('desktop') }
}

// Log one visit per browser session. Fire-and-forget: the caller never
// awaits this, and it NEVER throws — a missing table (migration not run
// yet), a blocked network, or a failed geo lookup all fail silently.
export async function logVisit() {
  try {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return
    // Set the flag BEFORE any async work so a double mount (e.g. React
    // StrictMode in dev) can never log twice in one session.
    if (sessionStorage.getItem(VISIT_FLAG)) return
    sessionStorage.setItem(VISIT_FLAG, '1')
    const device = getDeviceType()
    const page = window.location.pathname || '/'
    // Country via a free geo-IP lookup, best effort. IMPORTANT: call
    // ipwho.is DIRECTLY — a proxied lookup (through /api/supabase or any
    // server) would geo-locate that server, not the visitor. On ANY
    // failure the visit still counts, just without a country.
    let countryCode = null
    let countryName = null
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 3000)
      const res = await fetch('https://ipwho.is/', { signal: ctrl.signal })
      clearTimeout(timer)
      if (res.ok) {
        const j = await res.json()
        if (j && j.success) {
          countryCode = j.country_code || null
          countryName = j.country || null
        }
      }
    } catch {
      // Geo lookup failed — visit still counts without a country.
    }
    try {
      const { supabase } = await import('./supabase')
      await supabase.from('site_visits').insert({
        device_type: device,
        country_code: countryCode,
        country_name: countryName,
        page,
      })
    } catch {
      // Table missing (migration not run yet) or network blocked — silent.
    }
  } catch {
    // Never throw: visit logging must never break the page.
  }
}
