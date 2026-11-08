import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// v9.21 fixes: Home dead with red banner + auth lock (Bug D, two tabs),
// Featured "အားလုံး" shows 0 (Bug B), /prices FAB overlap (Bug C),
// Change Log Admin rule + version bump. Static source assertions in the
// wording.test.js / layout.test.js pattern.
// NOTE (v9.22): the Bug D mechanism changed — the v9.21 lockAcquireTimeout
// never took effect (supabase-js drops it; grep -c on its dist is 0), so
// the assertions below now pin the v9.22 design: a custom `lock` wrapper
// (120 s), the backoff reload guard, and the isLockError detector in
// lib/supabase.js. The functional isLockError / backoff / lock-wrapper
// tests live in fixes922.test.js. Bug A (second search returns 0) is NOT
// covered here either: it did not reproduce in a mocked jsdom run of the
// real SearchPage (sequential searches and an overlapping slow-first-search
// variant both passed), so SearchPage.jsx was left untouched in 9.21 —
// the 9.22 live capture pinned it instead (see fixes922.test.js).

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(srcDir, rel), 'utf8')

// Slice the changelog entry for version v out of Header.jsx source.
function changelogEntry(header, v, nextV) {
  const start = header.indexOf(`{ v: '${v}'`)
  expect(start).toBeGreaterThan(-1)
  const end = nextV ? header.indexOf(`{ v: '${nextV}'`, start) : header.length
  return header.slice(start, end === -1 ? header.length : end)
}

describe('Bug D: auth lock (two tabs) — supabase client', () => {
  it('the dead v9.21 lockAcquireTimeout is gone; the custom lock wrapper passes 120 s (auth-js default is 5 s)', () => {
    const lib = read('lib/supabase.js')
    // supabase-js 2.100.1 drops lockAcquireTimeout (0 occurrences in
    // its dist) — it must not be there as an option pretending to work
    // (the explanatory comment may still name it).
    expect(lib).not.toMatch(/^\s*lockAcquireTimeout:/m)
    expect(lib).toContain("storageKey: 'cherry-directory-auth'")
    expect(lib).toContain('lock: authLock')
    expect(lib).toContain('navigatorLock(name, 120000, fn)')
    expect(lib).toContain("import { navigatorLock } from '@supabase/auth-js'")
  })

  it('the unhandledrejection handler is registered before createClient', () => {
    const lib = read('lib/supabase.js')
    expect(lib.indexOf("window.addEventListener('unhandledrejection'")).toBeGreaterThan(-1)
    expect(lib.indexOf("window.addEventListener('unhandledrejection'")).toBeLessThan(lib.indexOf('createClient(supabaseUrl'))
    expect(lib).toContain('supabase.auth.stopAutoRefresh()')
    expect(lib).toContain('handleLockPoison()')
  })
})

describe('Bug D: HomePage auto-retry on FAST core failure', () => {
  // v9.25 regen #2: the main load is useQuery now — a fast core failure
  // retries per-section via react-query (client default retry: 1,
  // retryDelay: 2000 on every home query), not via a whole-page guard
  // gated on timedOut. There is no timedOut state or guard any more.
  it('the auto-retry is no longer gated on timedOut — a fast core failure retries too', () => {
    const home = read('pages/HomePage.jsx')
    // The old `if (timedOut) { ... }` wrapper around the retry is gone.
    expect(home).not.toContain('if (timedOut)')
    // No whole-page retry guard or timeout state remains.
    expect(home).not.toContain('autoRetryGuardRef')
    expect(home).not.toContain('setLoadTimedOut')
    // Each home section retries once after a 2 s delay.
    expect(home).toContain('retryDelay: 2000')
  })

  it('manual Retry still resets the guard and re-runs the load', () => {
    const home = read('pages/HomePage.jsx')
    expect(home).toContain("invalidateQueries({ queryKey: ['home'] })")
    expect(home).toContain('loadCommunityStats()')
    expect(home).toContain('loadFavorites()')
  })
})

describe('Bug D: AuthContext lock-error recovery', () => {
  it('a lock error is detected by the stolen-lock message (auth-js wording)', () => {
    // The detector lives in lib/supabase.js now (single copy, shared
    // with the unhandledrejection handler); AuthContext re-exports it.
    const lib = read('lib/supabase.js')
    expect(lib).toContain('was released because another request stole it')
    expect(lib).toContain('Lock broken by another request')
    expect(lib).toContain('LockAcquireTimeoutError')
  })

  it('loadSession recovers with the backoff-guarded reload — never a getSession retry on the same client', () => {
    const auth = read('contexts/AuthContext.jsx')
    // Exactly ONE real getSession call (the initial load); the catch
    // must not call it again — the cached initializePromise rejection
    // would just rethrow.
    const calls = auth.match(/supabase\.auth\.getSession\(\)/g) || []
    expect(calls.length).toBe(1)
    // Recovery: shared backoff reload, not the v9.21 once-per-session guard.
    // (The reload itself lives in lib/supabase.js's handleLockPoison —
    // AuthContext only calls it.)
    expect(auth).not.toContain('window.location.reload()')
    expect(auth).not.toContain('lockReloadAlreadyDone()')
    expect(auth).not.toContain('markLockReloaded()')
    expect(auth).toContain('handleLockPoison()')
    expect(auth).toContain("import { supabase, isLockError, handleLockPoison } from '../lib/supabase'")
    // The guard itself: 3 reloads max, ≥10 s apart, jittered delay.
    const lib = read('lib/supabase.js')
    expect(lib).toContain('window.location.reload()')
    expect(lib).toContain("sessionStorage.getItem(AUTH_LOCK_RELOAD_KEY)")
    expect(lib).toContain('cherry-auth-lock-reloaded')
    expect(lib).toContain('LOCK_RELOAD_MAX = 3')
    expect(lib).toContain('LOCK_RELOAD_MIN_GAP_MS = 10000')
    expect(lib).toContain('500 + Math.random() * 1000')
  })

  it('the existing safety net, INITIAL_SESSION skip and profile dedupe are intact', () => {
    const auth = read('contexts/AuthContext.jsx')
    expect(auth).toContain('armSafetyNet')
    expect(auth).toContain("if (event === 'INITIAL_SESSION') return")
    expect(auth).toContain('pendingProfile.current')
  })
})

// (v9.22: the functional isLockError tests moved to fixes922.test.js —
// the detector now lives in lib/supabase.js, imported there with stubbed
// env vars; this file's vi.mock('./supabase') would shadow the real one.)

describe('Bug D hardening: AppConfig fetchConfig', () => {
  it('has a timeout and one retry (was: no timeout at all)', () => {
    const cfg = read('contexts/AppConfigContext.jsx')
    expect(cfg).toContain("withTimeout(")
    expect(cfg).toContain("'AppConfig'")
    expect(cfg).toContain('10000')
    expect(cfg).toContain('for (let attempt = 0; attempt < 2; attempt++)')
  })

  it('still falls back to DEFAULTS on failure (config alone can never blank Home)', () => {
    const cfg = read('contexts/AppConfigContext.jsx')
    expect(cfg).toContain('return DEFAULTS')
  })
})

describe('Bug B: Featured pseudo-subcategory sticks', () => {
  it('the selectedCategory effect does not wipe the pseudo in the featured view', () => {
    const dir = read('pages/DirectoryPage.jsx')
    expect(dir).toContain('else if (!featuredOnly) {')
    expect(dir).toContain('}, [selectedCategory, featuredOnly])')
  })

  it('the H1 effect still sets the pseudo, and goBack still clears it on param removal', () => {
    const dir = read('pages/DirectoryPage.jsx')
    expect(dir).toContain("id: FEATURED_PSEUDO_ID")
    expect(dir).toContain('is_featured_view: true')
    expect(dir).toContain("next.delete('featured')")
    // The listings query stays gated on the subcategory being set.
    expect(dir).toContain('enabled: !!selectedSubcategory')
  })
})

describe('Bug C: /prices last content clears the Submit FAB', () => {
  it('page root bottom padding is >= 140 px (FAB band starts 140 px above the viewport bottom)', () => {
    const prices = read('pages/MarketPricePage.jsx')
    expect(prices).toContain('<div className="pb-40">')
    expect(prices).not.toContain('<div className="pb-8">')
    // pb-40 = 160 px: 140 px FAB band + breathing room / safe-area.
    const m = prices.match(/<div className="pb-(\d+)">/)
    expect(m).not.toBeNull()
    expect(Number(m[1]) * 4).toBeGreaterThanOrEqual(140)
  })
})

describe('v9.21: version + Change Log Admin rule', () => {
  it('package.json is 9.25 (work copy bumped; the 9.21 entry below is still the 9.21 record)', () => {
    const pkg = JSON.parse(readFileSync(join(srcDir, '..', 'package.json'), 'utf8'))
    expect(pkg.version).toBe('9.32')
  })

  it('the 9.21 entry is new, on top, dated 2026-11-06, with zero Admin mentions', () => {
    const header = read('components/Header.jsx')
    expect(header).toContain("{ v: '9.21', date: '2026-11-06'")
    // Exactly one 9.21 entry, and it sits before the 9.20 entry.
    expect(header.match(/v: '9\.21'/g).length).toBe(1)
    expect(header.indexOf("v: '9.21'")).toBeLessThan(header.indexOf("v: '9.20'"))
    const entry = changelogEntry(header, '9.21', '9.20')
    expect(entry).not.toContain('Admin')
    expect(entry).toContain('သူ့အလိုလို ပြန်ကြိုးစားမည်')
  })

  it('the 9.20 entry (exactly one) has no Admin mentions any more', () => {
    const header = read('components/Header.jsx')
    expect(header.match(/v: '9\.20'/g).length).toBe(1)
    const entry = changelogEntry(header, '9.20', '9.19')
    expect(entry).not.toContain('Admin')
    expect(entry).toContain('မရှိတော့တဲ့ ဆိုင်တွေ ဖျက်လို့ရပြီ')
    expect(entry).toContain('floating ခလုတ်များ (+ တင်မည်)')
  })

  it('older entries are untouched (9.17 and earlier still mention Admin — out of scope)', () => {
    const header = read('components/Header.jsx')
    const entry917 = changelogEntry(header, '9.17', '9.16')
    expect(entry917).toContain('Admin')
  })
})
