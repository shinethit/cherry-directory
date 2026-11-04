import { createClient } from '@supabase/supabase-js'

const envUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// v9.9: on the deployed site, route Supabase traffic through the app's own
// origin (/api/supabase, Vercel rewrite) — some Myanmar ISPs block the
// Supabase host outright, and the app's own origin is reachable. Localhost
// dev keeps the direct URL. Never log the URL or the key.
const useProxy = typeof window !== 'undefined' && typeof window.location !== 'undefined' && window.location.hostname.endsWith('.vercel.app')
const supabaseUrl = useProxy ? window.location.origin + '/api/supabase' : envUrl

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
  },
  realtime: { params: { eventsPerSecond: 10 } },
})
