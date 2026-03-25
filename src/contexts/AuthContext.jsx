import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    console.log('🔵 fetchProfile called for userId:', userId)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) {
        console.error('🔴 Profile fetch error:', error)
        setLoading(false)
        return
      }
      
      console.log('🟢 Profile fetched successfully:', data)
      setProfile(data)
    } catch (err) {
      console.error('🔴 Profile fetch exception:', err)
    } finally {
      console.log('🟡 Setting loading to false from fetchProfile')
      setLoading(false)
    }
  }

  useEffect(() => {
    console.log('🚀 AuthProvider mounted, initializing...')
    
    let isMounted = true

    const initialize = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('🔴 getSession error:', error)
          if (isMounted) setLoading(false)
          return
        }
        
        console.log('🟢 Session:', session?.user?.email || 'No session')
        
        if (isMounted) {
          setUser(session?.user ?? null)
          if (session?.user) {
            await fetchProfile(session.user.id)
          } else {
            console.log('🟡 No session, setting loading false')
            setLoading(false)
          }
        }
      } catch (err) {
        console.error('🔴 initialize error:', err)
        if (isMounted) setLoading(false)
      }
    }

    initialize()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('🔄 Auth state changed:', _event, session?.user?.email || 'No user')
      
      if (isMounted) {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    })

    return () => {
      console.log('🔚 AuthProvider unmounting')
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signUp({ email, password, fullName }) {
    console.log('📝 Signing up:', email)
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    })
    if (error) {
      console.error('🔴 Sign up error:', error)
      throw error
    }
    console.log('🟢 Sign up success:', data)
    return data
  }

  async function signIn({ email, password }) {
    console.log('🔑 Signing in:', email)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('🔴 Sign in error:', error)
      throw error
    }
    console.log('🟢 Sign in success:', data.user?.email)
    return data
  }

  async function signOut() {
    console.log('🚪 Signing out')
    await supabase.auth.signOut()
  }

  async function updateProfile(updates) {
    if (!user) throw new Error('Not logged in')
    console.log('✏️ Updating profile:', updates)
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
    if (error) {
      console.error('🔴 Update profile error:', error)
      throw error
    }
    setProfile(prev => ({ ...prev, ...updates }))
    // Re-fetch in background to sync server state
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfile(data) })
      .catch(() => {})
  }

  async function refreshProfile() {
    if (user) {
      console.log('🔄 Refreshing profile')
      await fetchProfile(user.id)
    }
  }

  const isSuperAdmin = profile?.role === 'super_admin'
  const isAdmin = profile?.role === 'admin' || isSuperAdmin
  const isModerator = profile?.role === 'moderator' || isAdmin
  const isLoggedIn = !!user

  console.log('📊 Auth state - loading:', loading, 'user:', user?.email || 'none', 'profile:', profile?.full_name || 'none')

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
  if (!ctx) {
    console.error('🔴 useAuth called outside of AuthProvider')
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
