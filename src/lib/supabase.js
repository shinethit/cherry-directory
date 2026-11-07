import { createClient } from '@supabase/supabase-js'
import { navigatorLock } from '@supabase/auth-js'

const envUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// v9.9: on the deployed site, route Supabase traffic through the app's own
// origin (/api/supabase, Vercel rewrite) — some Myanmar ISPs block the
// Supabase host outright, and the app's own origin is reachable. Localhost
// dev keeps the direct URL. Never log the URL or the key.
const useProxy = typeof window !== 'undefined' && typeof window.location !== 'undefined' && window.location.hostname.endsWith('.vercel.app')
const supabaseUrl = useProxy ? window.location.origin + '/api/supabase' : envUrl

// v9.18: realtime can NOT work through the Vercel rewrite — Vercel does
// not forward WebSocket upgrades (HTTP 101) to an external destination,
// so the client dials wss://<app>/api/supabase/realtime/v1/websocket and
// reconnects forever, spamming the console on every signed-in page.
// On the proxied origin realtime is therefore OFF (localhost dev keeps
// it — direct URL, real WebSocket). Every .channel() call site checks this
// flag and degrades to load-once (chat polls instead, the unread badge
// refetches on a timer). Do NOT "fix" it by pointing realtime direct at
// supabase.co — that is exactly the host the v9.9 proxy was built to avoid
// (ISP-blocked for the affected users).
export const realtimeEnabled = !useProxy

console.log('Supabase URL:', supabaseUrl ? '✅ Set' : '❌ MISSING')
console.log('Supabase mode:', useProxy ? 'proxy (/api/supabase)' : 'direct')
console.log('Supabase Key:', supabaseAnonKey ? '✅ Set' : '❌ MISSING')

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// v9.22 (Bug D) — the custom auth lock. auth-js calls this as
// lock(name, acquireTimeout, fn); the caller's timeout is ignored and
// 120 s is always passed to navigatorLock (see the createClient comment
// above for why 120 s). Exported so tests can assert the timeout.
export function authLock(name, _acquireTimeout, fn) {
  // v9.22 (iOS guard): auth-js's own lock falls back to a no-op when
  // navigator.locks is missing (iOS <15.4) — calling navigatorLock
  // unguarded throws TypeError on every _acquireLock there. Match it.
  if (typeof globalThis.navigator?.locks?.request !== 'function') return fn()
  return navigatorLock(name, 120000, fn)
}

// v9.22 (iOS guard): AbortSignal.timeout needs iOS 16+. Where it is
// missing, an AbortController + setTimeout shim aborts after the same
// delay instead of throwing on every Supabase fetch.
export function createTimeoutSignal(ms = 20000) {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms)
  const controller = new AbortController()
  setTimeout(() => { try { controller.abort() } catch { /* ignore */ } }, ms)
  return controller.signal
}

// v9.22 (Bug D): a stolen navigator lock poisons this client's
// initializePromise permanently — GoTrueClient awaits that same promise
// in getSession/signIn/refresh and every later call rethrows the cached
// rejection, so retrying on this client can never work. Recovery is a
// fresh page (fresh client, fresh initializePromise), guarded by a
// backoff so a continuous two-tab race can never reload-loop: at most
// 3 reloads per browser session, ≥10 s apart, with a 500–1500 ms
// jitter so two racing tabs don't reload in lockstep.
// sessionStorage (not localStorage): a new session gets a fresh chance.
// All helpers never throw.
const AUTH_LOCK_RELOAD_KEY = 'cherry-auth-lock-reloaded'
const LOCK_RELOAD_MAX = 3
const LOCK_RELOAD_MIN_GAP_MS = 10000

export function isLockError(err) {
  const msg = err?.message || String(err || '')
  // v9.25: narrowed to the two lock-STEAL shapes only. The old
  // msg.includes('Lock') matched ANY message containing 'Lock' — e.g. the
  // 'was not released within 5000ms' warning text from a two-tab
  // slow-refresh race — and the unhandledrejection handler below then
  // fired a page reload for a non-poison error. The name / isAcquireTimeout
  // checks stay: they identify the LockAcquireTimeoutError class itself
  // (the class that throws the steal message), not a substring.
  return msg.includes('was released because another request stole it')
    || msg.includes("Lock broken by another request with the 'steal' option")
    || err?.name === 'LockAcquireTimeoutError'
    || err?.isAcquireTimeout === true
}

function readLockReloadState() {
  try {
    const raw = window.sessionStorage.getItem(AUTH_LOCK_RELOAD_KEY)
    if (!raw) return { count: 0, at: 0 }
    // Back-compat: v9.21 stored the bare string '1'.
    if (raw === '1') return { count: 1, at: 0 }
    const parsed = JSON.parse(raw)
    return { count: Number(parsed?.count) || 0, at: Number(parsed?.at) || 0 }
  } catch { return { count: 0, at: 0 } }
}

// True when a lock-poison reload is allowed right now; false once the
// backoff budget is spent (3 reloads, or <10 s since the last one).
export function lockReloadAllowed() {
  const { count, at } = readLockReloadState()
  if (count >= LOCK_RELOAD_MAX) return false
  if (Date.now() - at < LOCK_RELOAD_MIN_GAP_MS) return false
  return true
}

// Single shared lock-poison recovery: backoff-guarded reload. Returns
// true when a reload was scheduled, false when the guard blocked it
// (the caller then proceeds as guest instead of looping).
export function handleLockPoison() {
  if (!lockReloadAllowed()) return false
  try {
    const { count } = readLockReloadState()
    window.sessionStorage.setItem(AUTH_LOCK_RELOAD_KEY, JSON.stringify({ count: count + 1, at: Date.now() }))
  } catch { /* ignore */ }
  // Jittered 500–1500 ms so two racing tabs don't reload in lockstep.
  const delay = 500 + Math.random() * 1000
  setTimeout(() => { try { window.location.reload() } catch { /* ignore */ } }, delay)
  return true
}

// v9.22 (Bug D): GoTrueClient's auto-refresh tick and its
// constructor-time _startAutoRefresh timeout rethrow lock errors with no
// try/catch, so a stolen lock surfaces as an uncaught (in promise)
// rejection. Swallow exactly those (both steal shapes), silence the
// ticking source, and run the shared backoff recovery. Registered here —
// before createClient — so the constructor-time timeout is covered
// (module evaluation is synchronous; the timeout can only fire after).
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('unhandledrejection', (event) => {
    if (!isLockError(event?.reason)) return
    try { event.preventDefault() } catch { /* ignore */ }
    try { supabase.auth.stopAutoRefresh() } catch { /* ignore */ }
    handleLockPoison()
  })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'cherry-directory-auth',
    // v9.22 (Bug D): the v9.21 `lockAcquireTimeout: 30000` NEVER took
    // effect — supabase-js 2.100.1 drops it: its _initSupabaseAuthClient
    // (dist/index.cjs:526) destructures only { autoRefreshToken,
    // persistSession, detectSessionInUrl, storage, userStorage,
    // storageKey, flowType, lock, debug, throwOnError } — grep -c
    // lockAcquireTimeout on its dist is 0 — so GoTrueClient kept its
    // 5 s default and a slow proxy refresh still got stolen by a
    // second tab (live repro: "was not released within 5000ms" dozens
    // of times). The supported seam is the `lock` option (it IS
    // forwarded, index.cjs:526 + index.d.mts:149): wrap auth-js's own
    // navigatorLock with a 120 s acquire timeout. 120 s, not -1: a
    // refresh attempt is bounded by auth-js's retryable window
    // (~30 s), so 120 s covers any legitimate slow-proxy refresh with
    // margin while keeping steal as last-resort recovery; -1 would
    // starve other tabs if a holder ever hung.
    lock: authLock,
  },
  // v9.22 (Account loading): gotrue's token-refresh fetch has NO timeout
  // anywhere in auth-js — a stalled proxy leaves initializePromise
  // pending forever and the session never recovers. Bound every
  // Supabase fetch at 20 s (rest calls already have shorter call-site
  // withTimeouts, so this is a backstop only). The caller's own abort
  // signal is preserved via AbortSignal.any — overriding it would break
  // SearchPage's per-keystroke abort. Realtime is unaffected
  // (WebSocket, not fetch).
  global: {
    fetch: (url, options = {}) => {
      const timeoutSignal = createTimeoutSignal(20000)
      const signal = options.signal
        ? (typeof AbortSignal.any === 'function'
          ? AbortSignal.any([options.signal, timeoutSignal])
          : options.signal)
        : timeoutSignal
      return fetch(url, { ...options, signal })
    },
  },
  realtime: { params: { eventsPerSecond: 10 } },
  // v9.18: these params only take effect where realtime is on
  // (localhost dev) — on the proxied origin realtimeEnabled is false
  // and the neuter below prevents any socket from opening.
})

// v9.18 belt-and-braces: never let the realtime client open a socket on
// the proxied origin — every channel.subscribe() funnels through
// RealtimeClient.connect(), so neutering it kills the reconnect storm
// even for a call site that forgot the realtimeEnabled guard above.
if (useProxy) {
  try { supabase.realtime.connect = () => {} } catch { /* ignore */ }
}
