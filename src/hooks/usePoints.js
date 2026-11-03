import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Point values
export const POINTS = {
  write_review:     5,
  submit_listing:   10,
  listing_approved: 20,
  rsvp_going:       2,
  chat_message:     1,
  claim_approved:   30,
}

export function usePoints() {
  const { user } = useAuth()

  // Returns true when the points were recorded, false when the user was
  // not logged in, the action is unknown, the daily cap was hit, or the
  // insert failed. Callers (e.g. Chat after a successful send) use the
  // return value to decide whether to show anything — award() itself never
  // toasts, so a points failure never blocks the action that earned it.
  const award = useCallback(async ({ action, refTable, refId, note }) => {
    if (!user) return false
    const pts = POINTS[action]
    if (!pts) return false

    // For chat: max 10 points/day to prevent spam
    if (action === 'chat_message') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count, error: countError } = await supabase
        .from('user_points')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('action', 'chat_message')
        .gte('created_at', today.toISOString())
      if (countError) {
        console.warn('Chat points cap check failed:', countError)
        return false
      }
      if ((count || 0) >= 10) return false  // cap reached
    }

    const { error } = await supabase.from('user_points').insert({
      user_id: user.id,
      action,
      points: pts,
      ref_table: refTable || null,
      ref_id: refId || null,
      note: note || null,
    })
    if (error) {
      console.warn('Award points failed:', error)
      return false
    }
    return true
  }, [user])

  const getMyPoints = useCallback(async () => {
    if (!user) return 0
    const { data } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', user.id)
      .single()
    return data?.points || 0
  }, [user])

  const getHistory = useCallback(async (limit = 20) => {
    if (!user) return []
    const { data } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)
    return data || []
  }, [user])

  return { award, getMyPoints, getHistory, POINTS }
}
