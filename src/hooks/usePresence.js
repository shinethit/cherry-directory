import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const PING_INTERVAL = 60_000   // 1 min
const ONLINE_THRESHOLD = 3 * 60_000  // 3 min = considered online

export function usePresence() {
  const { user } = useAuth()
  const sessionRef = useRef(null)
  const timerRef  = useRef(null)

  useEffect(() => {
    if (!user) return

    async function startSession() {
      try {
        const device = navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop'
        const { data } = await supabase
          .from('user_sessions')
          .insert({ user_id: user.id, device })
          .select()
          .single()
        sessionRef.current = data?.id

        await supabase
          .from('profiles')
          .update({ is_online: true, last_seen: new Date().toISOString() })
          .eq('id', user.id)
      } catch (err) {
        console.warn('Presence startSession failed:', err)
      }
    }

    async function ping() {
      if (!sessionRef.current) return
      try {
        const now = new Date().toISOString()
        await Promise.all([
          supabase.from('user_sessions').update({ last_ping: now }).eq('id', sessionRef.current),
          supabase.from('profiles').update({ last_seen: now, is_online: true }).eq('id', user.id),
        ])
      } catch (err) {
        console.warn('Presence ping failed:', err)
      }
    }

    async function endSession() {
      if (!sessionRef.current) return
      try {
        const now = new Date().toISOString()
        await Promise.all([
          supabase.from('user_sessions').update({ ended_at: now }).eq('id', sessionRef.current),
          supabase.from('profiles').update({ is_online: false, last_seen: now }).eq('id', user.id),
        ])
      } catch (err) {
        console.warn('Presence endSession failed:', err)
      }
    }

    startSession()
    timerRef.current = setInterval(() => ping().catch(console.warn), PING_INTERVAL)

    const handleUnload      = () => endSession()
    const handleVisibility  = () => {
      if (document.visibilityState === 'hidden') endSession()
      else ping()
    }

    window.addEventListener('beforeunload', handleUnload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(timerRef.current)
      endSession()
      window.removeEventListener('beforeunload', handleUnload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user])
}

export function timeAgo(iso, lang = 'mm') {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return lang === 'mm' ? 'ယခုလေး' : 'just now'
  if (mins < 60) return lang === 'mm' ? `${mins} မိနစ်က` : `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return lang === 'mm' ? `${hrs} နာရီက` : `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return lang === 'mm' ? `${days} ရက်က` : `${days}d ago`
  return new Date(iso).toLocaleDateString(lang === 'mm' ? 'my-MM' : 'en-US', { month: 'short', day: 'numeric' })
}

export function isOnline(lastSeen) {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD
}
