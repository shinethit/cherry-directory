// Monthly vs total points (v9.17 Issue 3e): the monthly figure must come
// from the leaderboard_month view — the SAME Yangon-month definition the
// leaderboard uses. Never computed client-side from the ledger (that
// would be a second month definition).
// The view has one row per profile (LEFT JOIN), so a user with no
// activity this month still resolves with period_points 0.
// Returns the monthly number, or null when the query fails — callers
// show '—', never a wrong 0.
// v9.19: the query is wrapped in withTimeout(10 s) — while the old
// slow view was timing out server-side this call hung with it; a slow
// view now returns null (callers show '—') instead of hanging.
import { withTimeout } from './withTimeout'

export async function fetchMonthlyPoints(client, userId) {
  let res
  try {
    res = await withTimeout(
      Promise.resolve(client
        .from('leaderboard_month')
        .select('period_points')
        .eq('id', userId)
        .maybeSingle()),
      10000,
      'Monthly points'
    )
  } catch {
    return null
  }
  const { data, error } = res || {}
  if (error) return null
  return data?.period_points ?? 0
}
