import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Point values (reference — the server is the source of truth for what an
// action is worth; the client never chooses a point value anymore).
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

  // Awards +1 for a chat message via the server-side award_chat_point()
  // RPC, which enforces the 10/day cap and the point value. The client
  // NEVER inserts into user_points directly anymore (C-3): the old code
  // inserted { user_id, action, points } from the browser, so any
  // signed-in user could forge unlimited points from the console.
  //
  // Returns true when the point was recorded, false when the user was not
  // logged in, the action is unknown, the daily cap was hit, the RPC is
  // missing (migration not applied yet), or the call failed. Callers (e.g.
  // Chat after a successful send) use the return value to decide whether
  // to show anything — award() itself never toasts, so a points failure
  // never blocks the action that earned it.
  //
  // Award-path inventory (verified 2026-11-03 — the ONLY client caller of
  // award() is ChatPage, with action 'chat_message'):
  //   - chat_message  → this RPC (server-side cap + value)
  //   - write_review  → SECURITY DEFINER trigger handle_review_created()
  //                      in supabase-schema-final.sql (server-side)
  //   - submit_listing / listing_approved → SECURITY DEFINER trigger
  //                      handle_listing_submitted() in final.sql
  //   - rsvp_going    → SECURITY DEFINER trigger handle_rsvp_created()
  //                      in supabase-migration-v0.9.1.sql (server-side,
  //                      live only if that migration was applied — C-14)
  //   - claim_approved → SECURITY DEFINER trigger handle_claim_points()
  //                      in the v0.9.1 migration (same caveat)
  // Any other action passed here returns false — there is no client
  // insert fallback.
  const award = useCallback(async ({ action, refTable, refId, note } = {}) => {
    if (!user) return false
    if (action !== 'chat_message') return false

    const { error } = await supabase.rpc('award_chat_point')
    if (error) {
      // Missing RPC (migration not applied yet), cap hit, or any other
      // failure: warn and report false — never crash the chat send.
      console.warn('Award chat point failed:', error)
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
