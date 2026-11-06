import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// v9.21 fixes: Home dead with red banner + auth lock (Bug D, two tabs),
// Featured "အားလုံး" shows 0 (Bug B), /prices FAB overlap (Bug C),
// Change Log Admin rule + version bump. Static source assertions in the
// wording.test.js / layout.test.js pattern, plus one functional test of
// the lock-error detector (pure function — no render needed).
// Bug A (second search returns 0) is NOT covered here: it did not
// reproduce in a mocked jsdom run of the real SearchPage (sequential
// searches and an overlapping slow-first-search variant both passed),
// so SearchPage.jsx was left untouched — see the 9.21 report.

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
  it('lockAcquireTimeout is 30 s in the createClient auth options (auth-js default is 5 s)', () => {
    const lib = read('lib/supabase.js')
    expect(lib).toContain('lockAcquireTimeout: 30000')
    expect(lib).toContain("storageKey: 'cherry-directory-auth'")
  })
})

describe('Bug D: HomePage auto-retry on FAST core failure', () => {
  it('the auto-retry is no longer gated on timedOut — a fast core failure retries too', () => {
    const home = read('pages/HomePage.jsx')
    // The old `if (timedOut) { ... }` wrapper around the retry is gone.
    expect(home).not.toContain('if (timedOut)')
    // The retry condition covers rejected core sections and error values.
    expect(home).toContain("const coreMissing = [0, 1, 2].some(i => results[i].status !== 'fulfilled' || results[i].value?.error)")
    expect(home).toContain('autoRetryGuardRef.current.shouldRetry()')
    // Timeout state is still tracked (banner + slow-load copy use it).
    expect(home).toContain('setLoadTimedOut(timedOut)')
  })

  it('manual Retry still resets the guard and re-runs the load', () => {
    const home = read('pages/HomePage.jsx')
    expect(home).toContain('autoRetryGuardRef.current.reset()')
    expect(home).toContain('loadData()')
  })
})

describe('Bug D: AuthContext lock-error recovery', () => {
  it('a lock error is detected by the stolen-lock message (auth-js wording)', () => {
    const auth = read('contexts/AuthContext.jsx')
    expect(auth).toContain('was released because another request stole it')
    expect(auth).toContain('LockAcquireTimeoutError')
  })

  it('loadSession recovers with a guarded reload — never a getSession retry on the same client', () => {
    const auth = read('contexts/AuthContext.jsx')
    // Exactly ONE real getSession call (the initial load); the catch
    // must not call it again — the cached initializePromise rejection
    // would just rethrow.
    const calls = auth.match(/supabase\.auth\.getSession\(\)/g) || []
    expect(calls.length).toBe(1)
    // Recovery: reload, guarded to once per browser session.
    expect(auth).toContain('window.location.reload()')
    expect(auth).toContain('lockReloadAlreadyDone()')
    expect(auth).toContain('markLockReloaded()')
    expect(auth).toContain("sessionStorage.getItem(AUTH_LOCK_RELOAD_KEY)")
    expect(auth).toContain('cherry-auth-lock-reloaded')
  })

  it('the existing safety net, INITIAL_SESSION skip and profile dedupe are intact', () => {
    const auth = read('contexts/AuthContext.jsx')
    expect(auth).toContain('armSafetyNet')
    expect(auth).toContain("if (event === 'INITIAL_SESSION') return")
    expect(auth).toContain('pendingProfile.current')
  })
})

// Functional: the lock-error detector itself (pure — no component
// render, so it runs under the default node test env). The supabase
// module throws without env vars, so it is mocked; toast is mocked to
// keep react-toastify out of node. vi.mock hoists above the import, so
// the real AuthContext module loads against the mocks. The file's JSX
// never executes at import time.
vi.mock('./supabase', () => ({ supabase: { auth: {}, from: () => ({}) } }))
vi.mock('./toast', () => ({ showError: () => {} }))

import { isLockError } from '../contexts/AuthContext'

describe('Bug D: isLockError (functional)', () => {
  it('recognises the stolen-lock error', () => {
    expect(isLockError(new Error('Lock "cherry-directory-auth" was released because another request stole it'))).toBe(true)
  })

  it('recognises the acquire-timeout error shape', () => {
    expect(isLockError({ name: 'LockAcquireTimeoutError', message: 'timed out' })).toBe(true)
    expect(isLockError({ isAcquireTimeout: true, message: 'timed out' })).toBe(true)
  })

  it('does not treat ordinary failures as lock errors', () => {
    expect(isLockError(new Error('Failed to fetch'))).toBe(false)
    expect(isLockError(new Error('NetworkError when attempting to fetch resource.'))).toBe(false)
    expect(isLockError(null)).toBe(false)
    expect(isLockError(undefined)).toBe(false)
  })
})

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
  it('package.json is 9.21', () => {
    const pkg = JSON.parse(readFileSync(join(srcDir, '..', 'package.json'), 'utf8'))
    expect(pkg.version).toBe('9.21')
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
