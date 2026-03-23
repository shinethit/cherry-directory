import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (!error && data) setProfile(data)
    } catch (err) {
      console.warn('fetchProfile failed:', err)
    }
    setLoading(false)
  }

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
    await supabase.auth.signOut()
  }

  async function updateProfile(updates) {
    if (!user) throw new Error('Not logged in')
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
    if (error) throw error
    // Optimistic update first, then re-fetch to get server-side computed fields (points, etc.)
    setProfile(prev => ({ ...prev, ...updates }))
    // Re-fetch in background to sync server state
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfile(data) })
      .catch(() => {})
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  const isSuperAdmin = profile?.role === 'super_admin'
  const isAdmin      = profile?.role === 'admin' || isSuperAdmin
  const isModerator  = profile?.role === 'moderator' || isAdmin
  const isLoggedIn   = !!user

  return (
    <AuthContext.Provider value={{ user, profile, loading, isSuperAdmin, isAdmin, isModerator, isLoggedIn, signUp, signIn, signOut, updateProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
