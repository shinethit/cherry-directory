import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { showError } from '../lib/toast'
import { safeGet, safeSet, safeRemove } from '../lib/safeStorage'

const AuthContext = createContext(null)

// Only these profile columns may ever be written from the client.
// role / points / totals are server-owned: even if a caller passes them,
// they are dropped here before the Supabase call (C-14 — a signed-in user
// must not be able to escalate their own role or forge points).
const SAFE_PROFILE_KEYS = ['full_name', 'nickname', 'bio', 'avatar_url']

// v9.18: the last good profile, cached so a failed fetch does not blank
// the app (role/name/admin gates keep working from cache). Staleness
// trade-off: a revoked role still shows until the next successful fetch —
// the server still enforces RLS on every data query, so this only
// affects what the UI renders, never what the server returns.
const PROFILE_CACHE_KEY = 'cherry-directory-profile'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // Profile loading is separate from auth loading: the session can be
  // known while the profile row is still in flight. Admin gates must wait
  // for profileLoading === false before judging role (H-3).
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const initialized = useRef(false)
  const profileInFlight = useRef(0)
  // v9.18: dedupes the double fetch at boot — loadSession() and the
  // onAuthStateChange INITIAL_SESSION event fired the same query twice,
  // so one stall produced two timeouts and two identical toasts.
  const pendingProfile = useRef(null) // { userId, promise } while in flight

  async function fetchProfileOnce(userId) {
    // v9.17 (Issue 2b): 10 s timeout — the profiles select used to hang
    // forever on a stalled connection, leaving profileLoading true and
    // the app stuck on Loading after switching back from another app.
    // On timeout/failure profileLoading still goes false (finally) so
    // the app proceeds and the existing retry UI handles the rest.
    const { data, error } = await withTimeout(supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single(), 10000, 'Profile')

    if (error) throw error
    if (!data) throw new Error('Profile row not found')
    return data
  }

  async function doFetchProfile(userId) {
    profileInFlight.current += 1
    setProfileLoading(true)
    setProfileError('')
    try {
      let data
      try {
        data = await fetchProfileOnce(userId)
      } catch (firstErr) {
        // v9.18: one quiet retry before ever telling the user — a
        // transient stall (slow proxy / mobile data) then self-heals
        // with no toast at all.
        data = await fetchProfileOnce(userId)
      }
      setProfile(data)
      setProfileError('')
      safeSet(PROFILE_CACHE_KEY, JSON.stringify(data))
      return true
    } catch (err) {
      // A missing/failed profile row is NOT silent: without it the user
      // loses role/points/name, and an admin can be permanently locked
      // out. Surface it so the UI can offer Retry (H-3 / I-M1) — unless
      // a cached profile exists, in which case restore it quietly and
      // let the next successful fetch refresh it.
      // S11 (v9.17): fixed Myanmar string — never toast raw DB English.
      let restored = false
      try {
        const raw = safeGet(PROFILE_CACHE_KEY)
        if (raw) {
          const cached = JSON.parse(raw)
          if (cached && cached.id === userId) { setProfile(cached); restored = true }
        }
      } catch { /* corrupt cache — fall through to the error path */ }
      if (!restored) {
        console.warn('fetchProfile failed:', err?.message || err)
        setProfileError('Profile ရယူမရပါ — ထပ်ကြိုးစားပါ')
        showError('Profile ရယူမရပါ — ထပ်ကြိုးစားပါ')
      }
      return false
    } finally {
      profileInFlight.current -= 1
      if (profileInFlight.current <= 0) {
        profileInFlight.current = 0
        setProfileLoading(false)
      }
    }
  }

  async function fetchProfile(userId) {
    // Dedupe: if the same user's fetch is already in flight, await that
    // one instead of firing a second identical query (and a second toast).
    if (pendingProfile.current && pendingProfile.current.userId === userId) {
      return pendingProfile.current.promise
    }
    const promise = doFetchProfile(userId)
    pendingProfile.current = { userId, promise }
    try {
      return await promise
    } finally {
      if (pendingProfile.current && pendingProfile.current.promise === promise) {
        pendingProfile.current = null
      }
    }
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    let isMounted = true
    let timeoutId = null

    const setLoadingFalse = () => {
      // Clear the safety-net timer on the success path too — otherwise
      // the "Loading timeout" warning fires even after a clean load (F-LOW-3).
      if (timeoutId) clearTimeout(timeoutId)
      if (isMounted) {
        setLoading(false)
      }
    }

    // Force loading false after 5 seconds as a safety net
    timeoutId = setTimeout(() => {
      console.warn('[Auth] Loading timeout – forcing loading false')
      setLoadingFalse()
    }, 5000)

    const loadSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.warn('[Auth] getSession error:', error?.message || error)
          setLoadingFalse()
          return
        }

        if (session?.user) {
          setUser(session.user)
          // Wait for the profile: admin gates judge role from it, so the
          // spinner must stay up until it resolves or fails (H-3).
          await fetchProfile(session.user.id)
        }
        setLoadingFalse()
      } catch (err) {
        console.warn('[Auth] Initialization error:', err?.message || err)
        setLoadingFalse()
      }
    }

    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return
      // v9.18: loadSession() above already fetched the profile for the
      // initial session — skip this event or the fetch runs twice.
      if (event === 'INITIAL_SESSION') return

      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setProfileError('')
        setProfileLoading(false)
      }
      setLoadingFalse()
    })

    return () => {
      isMounted = false
      if (timeoutId) clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  async function signUp({ email, password, fullName }) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/`,
      },
    })
    if (error) throw error
    return data
  }

  async function signInWithOAuth(provider) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) throw error
    return data
  }

  async function resetPasswordForEmail(email) {
    // M5 (v9.17): ?recovery=1 marks the reset link unambiguously —
    // ResetPasswordPage treats it as recovery on mount (the event
    // subscription stays as backup).
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password?recovery=1`,
    })
    if (error) throw error
    return data
  }

  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    // M6 (v9.17): return the error instead of swallowing it — the old
    // code cleared local state even when the server sign-out failed, so
    // the user looked signed out while the session was still alive.
    // Callers show the error and stay put on failure.
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out error:', error?.message || error)
      return { error }
    }
    setUser(null)
    setProfile(null)
    setProfileError('')
    setProfileLoading(false)
    safeRemove(PROFILE_CACHE_KEY)
    return { error: null }
  }

  async function updateProfile(updates) {
    if (!user) throw new Error('Not logged in')
    // Allowlist first: drop role/points/any other key a caller may have
    // passed, before the Supabase call (C-14).
    const safe = {}
    for (const key of SAFE_PROFILE_KEYS) {
      if (key in (updates || {})) safe[key] = updates[key]
    }
    if (Object.keys(safe).length === 0) {
      throw new Error('Nothing to update')
    }
    // .select().single() proves a row was actually updated: a 0-row
    // update (e.g. RLS / missing row) must throw, not report success
    // while optimistically showing the new values (F-MED-2).
    const { data, error } = await supabase
      .from('profiles')
      .update(safe)
      .eq('id', user.id)
      .select()
      .single()
    if (error) throw error
    if (!data) throw new Error('Profile update failed — no row updated')
    setProfile(data)
    safeSet(PROFILE_CACHE_KEY, JSON.stringify(data))
    return data
  }

  async function refreshProfile() {
    if (user) return fetchProfile(user.id)
    return false
  }

  const isSuperAdmin = profile?.role === 'super_admin'
  const isAdmin = profile?.role === 'admin' || isSuperAdmin
  const isModerator = profile?.role === 'moderator' || isAdmin
  const canManageDonations = isAdmin || (profile?.role === 'moderator' && profile?.can_manage_donations === true)
  const isLoggedIn = !!user

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      profileLoading,
      profileError,
      isSuperAdmin,
      isAdmin, 
      isModerator, 
      canManageDonations,
      isLoggedIn, 
      signUp, 
      signIn, 
      signInWithOAuth,
      resetPasswordForEmail,
      signOut, 
      updateProfile, 
      refreshProfile 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}