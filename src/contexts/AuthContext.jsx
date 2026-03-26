import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (!error && data) {
        setProfile(data)
      }
    } catch (err) {
      console.warn('fetchProfile failed:', err)
    }
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    let isMounted = true
    let timeoutId = null

    const setLoadingFalse = () => {
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
          console.warn('[Auth] getSession error:', error)
          setLoadingFalse()
          return
        }
        
        if (session?.user) {
          setUser(session.user)
          // Fetch profile in background, don't wait for it to complete
          fetchProfile(session.user.id).finally(() => {
            // Profile fetched, no need to set loading again
          })
        }
        setLoadingFalse()
      } catch (err) {
        console.warn('[Auth] Initialization error:', err)
        setLoadingFalse()
      }
    }

    loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return
      
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id).catch(() => {})
      } else {
        setUser(null)
        setProfile(null)
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
      options: { data: { full_name: fullName } },
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
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Sign out error:', error)
    setUser(null)
    setProfile(null)
  }

  async function updateProfile(updates) {
    if (!user) throw new Error('Not logged in')
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
    if (error) throw error
    setProfile(prev => ({ ...prev, ...updates }))
    // background refresh
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfile(data) })
      .catch(() => {})
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  const isSuperAdmin = profile?.role === 'super_admin'
  const isAdmin = profile?.role === 'admin' || isSuperAdmin
  const isModerator = profile?.role === 'moderator' || isAdmin
  const isLoggedIn = !!user

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isSuperAdmin, 
      isAdmin, 
      isModerator, 
      isLoggedIn, 
      signUp, 
      signIn, 
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