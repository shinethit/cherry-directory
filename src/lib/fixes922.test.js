import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// v9.22 fixes:
//  FIX 1 (Bug D, real root cause): the v9.21 lockAcquireTimeout never took
//    effect — supabase-js 2.100.1 drops it (0 occurrences in its dist) —
//    so a slow proxy refresh still got stolen by a second tab. Now a
//    custom `lock` wrapper passes 120 s to auth-js's navigatorLock, the
//    once-per-session reload guard is a backoff guard (3×, ≥10 s apart,
//    jittered), and a global unhandledrejection handler swallows lock
//    rejections, stops auto-refresh, and recovers.
//  FIX 2 (Account loading): the onAuthStateChange handler awaited
//    fetchProfile, deadlocking boot against getSession's initializePromise
//    (~42 s); getSession had no timeout; gotrue's refresh fetch had no
//    timeout; the auth ErrorScreen fired at 8 s; LoginPage sign-in spun
//    forever on a hung initializePromise.
//  FIX 3 (Bug A, pinned by live capture): the search spinner cleared on
//    the FIRST source to resolve (usually []), so the status line showed
//    "0 ရလဒ် တွေ့သည်" with the old URL while 8 sources were still in
//    flight. loading now stays true until every source settles.
// Functional tests import the REAL lib/supabase.js (vi.stubEnv feeds
// import.meta.env — verified by scratch test) with a stubbed window for
// the sessionStorage-backed guard. The @supabase/auth-js package entry
// is mocked only to observe what the lock wrapper passes to
// navigatorLock; GoTrueClient's internal lock import is relative
// (./lib/locks) so the client itself is unaffected.

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(srcDir, rel), 'utf8')

// Slice the changelog entry for version v out of Header.jsx source.
function changelogEntry(header, v, nextV) {
  const start = header.indexOf(`{ v: '${v}'`)
  expect(start).toBeGreaterThan(-1)
  const end = nextV ? header.indexOf(`{ v: '${nextV}'`, start) : header.length
  return header.slice(start, end === -1 ? header.length : end)
}

const { mockNavigatorLock } = vi.hoisted(() => ({
  mockNavigatorLock: vi.fn(async (_name, _timeout, fn) => await fn()),
}))
vi.mock('@supabase/auth-js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, navigatorLock: mockNavigatorLock }
})

// Fake browser window for the backoff guard: sessionStorage + location.
function stubWindow() {
  const store = new Map()
  const listeners = {}
  const sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
    clear: () => { store.clear() },
  }
  const localStorage = {
    getItem: (k) => (store.has('ls:' + k) ? store.get('ls:' + k) : null),
    setItem: (k, v) => { store.set('ls:' + k, String(v)) },
    removeItem: (k) => { store.delete('ls:' + k) },
    clear: () => { store.clear() },
  }
  const location = { hostname: 'localhost', reload: vi.fn() }
  const windowStub = {
    location,
    sessionStorage,
    localStorage,
    addEventListener: vi.fn((type, fn) => { listeners[type] = fn }),
    removeEventListener: vi.fn((type, fn) => { if (listeners[type] === fn) delete listeners[type] }),
  }
  vi.stubGlobal('window', windowStub)
  return { store, listeners, sessionStorage, location, windowStub }
}

// v9.22 FIX 6 (iOS guard): authLock now returns fn() directly when
// navigator.locks is missing (iOS <15.4) instead of calling
// navigatorLock. The functional lock tests therefore stub a present
// navigator.locks first; the missing-API case is tested separately.
function stubNavigatorLocks() {
  vi.stubGlobal('navigator', { locks: { request: vi.fn(async (_n, _o, fn) => await fn()) } })
}

let supa
beforeAll(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://fake.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-anon-key')
  supa = await import('./supabase')
})

afterAll(() => {
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  mockNavigatorLock.mockClear()
})

describe('FIX 1: custom auth lock passes 120 s (functional)', () => {
  it('authLock ignores the caller timeout and passes 120000 to navigatorLock', async () => {
    stubNavigatorLocks()
    // Clear import-time lock calls (GoTrueClient's _initialize acquires
    // the custom lock while the module loads) so only this call counts.
    mockNavigatorLock.mockClear()
    const fn = vi.fn(async () => 'done')
    const result = await supa.authLock('lock:cherry-directory-auth', 5000, fn)
    expect(result).toBe('done')
    expect(mockNavigatorLock).toHaveBeenCalledTimes(1)
    expect(mockNavigatorLock).toHaveBeenCalledWith('lock:cherry-directory-auth', 120000, fn)
  })

  it('authLock also overrides a large caller timeout (never -1, never 5000)', async () => {
    stubNavigatorLocks()
    mockNavigatorLock.mockClear()
    await supa.authLock('lock:x', -1, async () => {})
    expect(mockNavigatorLock).toHaveBeenCalledWith('lock:x', 120000, expect.any(Function))
  })
})

describe('FIX 1: isLockError (functional)', () => {
  it('recognises all three observed lock strings', () => {
    expect(supa.isLockError(new Error('Lock "lock:cherry-directory-auth" was released because another request stole it'))).toBe(true)
    expect(supa.isLockError(new Error("Lock broken by another request with the 'steal' option."))).toBe(true)
    expect(supa.isLockError({ name: 'LockAcquireTimeoutError', message: 'timed out' })).toBe(true)
    expect(supa.isLockError({ isAcquireTimeout: true, message: 'timed out' })).toBe(true)
    // The AbortError shape seen in the repro log carries the steal message.
    const abortErr = new Error("Lock broken by another request with the 'steal' option.")
    abortErr.name = 'AbortError'
    expect(supa.isLockError(abortErr)).toBe(true)
  })

  it('does not treat ordinary failures as lock errors', () => {
    expect(supa.isLockError(new Error('Failed to fetch'))).toBe(false)
    expect(supa.isLockError(new Error('NetworkError when attempting to fetch resource.'))).toBe(false)
    expect(supa.isLockError(null)).toBe(false)
    expect(supa.isLockError(undefined)).toBe(false)
  })
})

describe('FIX 1: backoff reload guard (functional)', () => {
  it('allows the 1st/2nd/3rd reload spaced ≥10 s, blocks a 4th and a reload <10 s after the last', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-06T10:00:00Z'))
    const { location, store } = stubWindow()

    // 1st reload allowed; the jittered timer fires it.
    expect(supa.lockReloadAllowed()).toBe(true)
    expect(supa.handleLockPoison()).toBe(true)
    expect(JSON.parse(store.get('cherry-auth-lock-reloaded')).count).toBe(1)
    vi.advanceTimersByTime(2000)
    expect(location.reload).toHaveBeenCalledTimes(1)

    // <10 s after the last one: blocked.
    expect(supa.handleLockPoison()).toBe(false)
    expect(location.reload).toHaveBeenCalledTimes(1)

    // ≥10 s later: 2nd allowed.
    vi.advanceTimersByTime(10000)
    expect(supa.lockReloadAllowed()).toBe(true)
    expect(supa.handleLockPoison()).toBe(true)
    vi.advanceTimersByTime(2000)
    expect(location.reload).toHaveBeenCalledTimes(2)

    // 3rd allowed after another 10 s.
    vi.advanceTimersByTime(10000)
    expect(supa.handleLockPoison()).toBe(true)
    vi.advanceTimersByTime(2000)
    expect(location.reload).toHaveBeenCalledTimes(3)
    expect(JSON.parse(store.get('cherry-auth-lock-reloaded')).count).toBe(3)

    // 4th blocked even after a long time — the session budget is spent.
    vi.advanceTimersByTime(60000)
    expect(supa.lockReloadAllowed()).toBe(false)
    expect(supa.handleLockPoison()).toBe(false)
    expect(location.reload).toHaveBeenCalledTimes(3)
  })

  it('treats the v9.21 bare "1" value as one reload already used', () => {
    const { store } = stubWindow()
    store.set('cherry-auth-lock-reloaded', '1')
    // Gap check passes (at = 0), count = 1 < 3 → one more reload allowed.
    expect(supa.lockReloadAllowed()).toBe(true)
    expect(supa.handleLockPoison()).toBe(true)
    expect(JSON.parse(store.get('cherry-auth-lock-reloaded')).count).toBe(2)
  })
})

describe('FIX 1: unhandledrejection handler (functional, fresh module)', () => {
  it('swallows lock rejections (preventDefault + backoff reload) and ignores other rejections', async () => {
    vi.resetModules()
    const { listeners, location } = stubWindow()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://fake.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-anon-key')
    const fresh = await import('./supabase')
    const handler = listeners['unhandledrejection']
    expect(typeof handler).toBe('function')

    // Non-lock rejection: untouched.
    const preventDefault = vi.fn()
    handler({ reason: new Error('Failed to fetch'), preventDefault })
    expect(preventDefault).not.toHaveBeenCalled()
    expect(location.reload).not.toHaveBeenCalled()

    // Lock rejection (steal shape): swallowed + backoff reload scheduled.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-06T10:00:00Z'))
    handler({ reason: new Error('Lock "lock:cherry-directory-auth" was released because another request stole it'), preventDefault })
    expect(preventDefault).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2000)
    expect(location.reload).toHaveBeenCalledTimes(1)
    // The guard recorded the reload, so an immediate second event is blocked.
    expect(fresh.lockReloadAllowed()).toBe(false)
  })
})

describe('FIX 1: supabase client shape (source)', () => {
  it('createClient has the custom lock + a 20 s bounded global fetch via the iOS-guarded helper, no dead lockAcquireTimeout', () => {
    const lib = read('lib/supabase.js')
    // As an option (the explanatory comment may still name it).
    expect(lib).not.toMatch(/^\s*lockAcquireTimeout:/m)
    expect(lib).toContain('lock: authLock')
    expect(lib).toContain('createTimeoutSignal(20000)')
    expect(lib).toContain("typeof globalThis.navigator?.locks?.request !== 'function'")
    expect(lib).toContain("typeof AbortSignal.timeout === 'function'")
    // The caller's own abort signal survives (SearchPage per-keystroke abort).
    expect(lib).toContain('AbortSignal.any')
  })
})

describe('FIX 2: Account loading — no await in the auth-state handler (source)', () => {
  it('onAuthStateChange never awaits fetchProfile; the boot gate exists', () => {
    const auth = read('contexts/AuthContext.jsx')
    // Scope the no-await check to the onAuthStateChange callback body
    // (loadSession below it still has its own awaited fetch — the
    // single boot fetch — so a file-wide check would be wrong).
    const handlerStart = auth.indexOf('onAuthStateChange(')
    const handlerEnd = auth.indexOf('return () => {', handlerStart)
    expect(handlerStart).toBeGreaterThan(-1)
    expect(handlerEnd).toBeGreaterThan(handlerStart)
    const handlerBody = auth.slice(handlerStart, handlerEnd)
    expect(handlerBody).not.toContain('await fetchProfile')
    expect(handlerBody).toContain('fetchProfile(session.user.id)')
    expect(handlerBody).toContain('if (booted.current) setLoadingFalse()')
    expect(auth).toContain('const booted = useRef(false)')
    expect(auth).toContain('booted.current = true')
    // loadSession keeps its own awaited fetch as the single boot fetch.
    expect(auth).toContain('await fetchProfile(session.user.id)')
  })

  it('getSession is bounded at 15 s', () => {
    const auth = read('contexts/AuthContext.jsx')
    expect(auth).toContain("withTimeout(supabase.auth.getSession(), 15000, 'Auth session')")
  })

  it('the auth ErrorScreen only fires at 30 s (after the ~25 s safety-net bound)', () => {
    const app = read('App.jsx')
    expect(app).toContain('}, 30000)')
    expect(app).not.toContain('}, 8000)')
  })

  it('LoginPage sign-in / sign-up / Google are bounded at 20 s, loading clears in finally, timeout surfaces the Burmese message + backoff reload on sign-in', () => {
    const login = read('pages/LoginPage.jsx')
    expect(login).toContain("withTimeout(signIn({ email: cleanEmail, password }), 20000, 'Sign in')")
    expect(login).toContain("withTimeout(signUp({ email: cleanEmail, password, fullName: cleanName }), 20000, 'Sign up')")
    expect(login).toContain("withTimeout(signInWithOAuth('google'), 20000, 'Google sign-in')")
    expect(login).toContain('finally {')
    expect(login).toContain('setLoading(false)')
    expect(login).toContain("setError('ချိတ်ဆက်၍ မရပါ — ထပ်ကြိုးစားပါ')")
    expect(login).toContain('handleLockPoison()')
    // No bare (unbounded) auth awaits remain.
    expect(login).not.toMatch(/await signIn\(/)
    expect(login).not.toMatch(/await signUp\(/)
    expect(login).not.toMatch(/await signInWithOAuth\(/)
  })

  it('AppConfig logs the error message, not the opaque "Object"', () => {
    const cfg = read('contexts/AppConfigContext.jsx')
    expect(cfg).toContain("console.warn('Failed to load app config:', err?.message || err)")
  })
})

describe('FIX 3: Bug A — search spinner stays until all sources settle (source)', () => {
  it('streamResult never clears loading; only the final block does', () => {
    const search = read('pages/SearchPage.jsx')
    // The streamResult body sets results only — no setLoading(false).
    const start = search.indexOf('const streamResult')
    const end = search.indexOf('}', search.indexOf('setResults(prev', start))
    const body = search.slice(start, end)
    expect(body).not.toContain('setLoading(false)')
    expect(body).toContain('setResults(prev')
    // The final block still clears loading + marks all sources done.
    expect(search).toContain('setLoading(false)\n    setAllSourcesDone(true)')
    // No firstDone flag remains.
    expect(search).not.toContain('firstDone')
  })
})

describe('v9.22: version + Change Log Admin rule', () => {
  it('package.json is 9.28', () => {
    const pkg = JSON.parse(readFileSync(join(srcDir, '..', 'package.json'), 'utf8'))
    expect(pkg.version).toBe('9.30')
  })

  it('the 9.22 entry is new, on top, dated 2026-11-06, with zero Admin mentions', () => {
    const header = read('components/Header.jsx')
    expect(header).toContain("{ v: '9.22', date: '2026-11-06'")
    expect(header.match(/v: '9\.22'/g).length).toBe(1)
    expect(header.indexOf("v: '9.22'")).toBeLessThan(header.indexOf("v: '9.21'"))
    const entry = changelogEntry(header, '9.22', '9.21')
    expect(entry).not.toContain('Admin')
    expect(entry).not.toContain('အကုန်')
    expect(entry).toContain('Tab နှစ်ခု')
    expect(entry).toContain('"၀ ရလဒ်"')
  })

  it('the 9.21 entry is untouched (still one, still before 9.20, still no Admin)', () => {
    const header = read('components/Header.jsx')
    expect(header.match(/v: '9\.21'/g).length).toBe(1)
    expect(header.indexOf("v: '9.21'")).toBeLessThan(header.indexOf("v: '9.20'"))
    const entry = changelogEntry(header, '9.21', '9.20')
    expect(entry).not.toContain('Admin')
    expect(entry).toContain('သူ့အလိုလို ပြန်ကြိုးစားမည်')
  })
})

describe('FIX 6: iOS guards — missing navigator.locks / AbortSignal.timeout (functional)', () => {
  it('no navigator.locks → authLock runs fn() directly, never calls navigatorLock, no throw', async () => {
    vi.stubGlobal('navigator', {})
    mockNavigatorLock.mockClear()
    const fn = vi.fn(async () => 'direct')
    const result = await supa.authLock('lock:x', 5000, fn)
    expect(result).toBe('direct')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(mockNavigatorLock).not.toHaveBeenCalled()
  })

  it('no navigator at all → authLock still runs fn() directly, no throw', async () => {
    vi.stubGlobal('navigator', undefined)
    mockNavigatorLock.mockClear()
    const fn = vi.fn(async () => 'direct')
    expect(await supa.authLock('lock:x', 5000, fn)).toBe('direct')
    expect(mockNavigatorLock).not.toHaveBeenCalled()
  })

  it('no AbortSignal.timeout → createTimeoutSignal uses the AbortController shim and aborts after the delay', () => {
    const orig = AbortSignal.timeout
    AbortSignal.timeout = undefined
    try {
      vi.useFakeTimers()
      const signal = supa.createTimeoutSignal(50)
      expect(signal).toBeInstanceOf(AbortSignal)
      expect(signal.aborted).toBe(false)
      vi.advanceTimersByTime(49)
      expect(signal.aborted).toBe(false)
      vi.advanceTimersByTime(1)
      expect(signal.aborted).toBe(true)
    } finally {
      AbortSignal.timeout = orig
    }
  })

  it('AbortSignal.timeout present → createTimeoutSignal uses it and still aborts', () => {
    expect(typeof AbortSignal.timeout).toBe('function')
    const signal = supa.createTimeoutSignal(50)
    expect(signal).toBeInstanceOf(AbortSignal)
    // The native timeout fires on real timers; just assert the signal
    // is the timed one (not an already-aborted plain signal).
    expect(signal.aborted).toBe(false)
  })
})
