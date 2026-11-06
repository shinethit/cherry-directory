import { createClient } from '@supabase/supabase-js'

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'cherry-directory-auth',
    // v9.21 (Bug D): auth-js waits only 5 s (its default) for the
    // "cherry-directory-auth" navigator lock during session refresh —
    // a slow /api/supabase proxy lets a second tab (or tab + installed
    // PWA, same origin, shared navigator.locks) steal it, and the
    // stolen lock poisons that tab's auth until reload. 30 s gives a
    // slow refresh room to finish instead of being stolen mid-flight.
    lockAcquireTimeout: 30000,
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
