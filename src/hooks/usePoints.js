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

  async function award({ action, refTable, refId, note }) {
    if (!user) return
    const pts = POINTS[action]
    if (!pts) return

    // For chat: max 10 points/day to prevent spam
    if (action === 'chat_message') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from('user_points')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('action', 'chat_message')
        .gte('created_at', today.toISOString())
      if ((count || 0) >= 10) return  // cap reached
    }

    await supabase.from('user_points').insert({
      user_id: user.id,
      action,
      points: pts,
      ref_table: refTable || null,
      ref_id: refId || null,
      note: note || null,
    })
  }

  async function getMyPoints() {
    if (!user) return 0
    const { data } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', user.id)
      .single()
    return data?.points || 0
  }

  async function getHistory(limit = 20) {
    if (!user) return []
    const { data } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)
    return data || []
  }

  return { award, getMyPoints, getHistory, POINTS }
}
