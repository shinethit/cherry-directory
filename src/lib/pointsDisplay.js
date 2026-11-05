// Monthly vs total points (v9.17 Issue 3e): the monthly figure must come
// from the leaderboard_month view — the SAME Yangon-month definition the
// leaderboard uses. Never computed client-side from the ledger (that
// would be a second month definition).
// The view has one row per profile (LEFT JOIN), so a user with no
// activity this month still resolves with period_points 0.
// Returns the monthly number, or null when the query fails — callers
// show '—', never a wrong 0.
export async function fetchMonthlyPoints(client, userId) {
  const { data, error } = await client
    .from('leaderboard_month')
    .select('period_points')
    .eq('id', userId)
    .maybeSingle()
  if (error) return null
  return data?.period_points ?? 0
}
