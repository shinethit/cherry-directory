import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchMonthlyPoints } from './pointsDisplay.js'

// Monthly vs total points (v9.17 Issue 3e): every points display must
// show BOTH figures as two clearly labelled numbers — never a single
// ambiguous number. The monthly figure comes from the
// leaderboard_month view (same Yangon-month definition as the board).
// pointsDisplay.js imports only withTimeout (which itself imports
// nothing), so the runtime tests below need no mocks — a fake client
// is passed in directly.

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = p => readFileSync(join(srcDir, p), 'utf8')

function fakeClient(result) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve(result) }),
      }),
    }),
  }
}

describe('fetchMonthlyPoints (leaderboard_month view)', () => {
  it('returns period_points for the user', async () => {
    await expect(
      fetchMonthlyPoints(fakeClient({ data: { period_points: 50 }, error: null }), 'u1')
    ).resolves.toBe(50)
  })

  it('returns 0 when the view has no row for the user', async () => {
    await expect(
      fetchMonthlyPoints(fakeClient({ data: null, error: null }), 'u1')
    ).resolves.toBe(0)
  })

  it('returns null on error — callers show —, never a wrong 0', async () => {
    await expect(
      fetchMonthlyPoints(fakeClient({ data: null, error: new Error('no view') }), 'u1')
    ).resolves.toBeNull()
  })

  it('queries leaderboard_month, not a client-side month computation', () => {
    expect(readFileSync(join(srcDir, 'lib', 'pointsDisplay.js'), 'utf8'))
      .toContain("from('leaderboard_month')")
  })

  it('wraps the query in a 10 s timeout (v9.19) — a slow view returns null, never hangs', () => {
    const s = readFileSync(join(srcDir, 'lib', 'pointsDisplay.js'), 'utf8')
    expect(s).toContain('withTimeout')
    expect(s).toContain('10000')
    expect(s).toContain("'Monthly points'")
  })
})

describe('usePoints exposes getMonthlyPoints', () => {
  it('wraps fetchMonthlyPoints for the logged-in user', () => {
    const hook = src('hooks/usePoints.js')
    expect(hook).toContain('getMonthlyPoints')
    expect(hook).toContain('fetchMonthlyPoints')
  })
})

describe('every points display shows monthly AND total, labelled', () => {
  it('ProfilePage: total badge + this-month badge as two figures', () => {
    const s = src('pages/ProfilePage.jsx')
    expect(s).toContain('စုစုပေါင်း:')
    expect(s).toContain('ဒီလ:')
    expect(s).toContain('leaderboard_month')
  })

  it('PointsGuidePage: total + this-month in the tier card', () => {
    const s = src('pages/PointsGuidePage.jsx')
    expect(s).toContain('စုစုပေါင်း မှတ်')
    expect(s).toContain('ဒီလ:')
    expect(s).toContain('getMonthlyPoints')
  })

  it('Leaderboard rows + podium: all-time next to the period figure', () => {
    const s = src('pages/LeaderboardPage.jsx')
    expect(s).toContain('စုစုပေါင်း:')
    expect(s).toContain('စုစုပေါင်း မှတ်')
    expect(s).toContain('all_time_points')
  })
})

describe('usePoints resolve-with-error (v9.25 regen #5)', () => {
  // The hook needs AuthContext + a live supabase mock to render, so the
  // error paths are asserted on the source. getHistory's caller
  // (PointsGuidePage) already renders an error + retry on a throw.
  const s = src('hooks/usePoints.js')

  it('getHistory throws on error instead of returning a silent []', () => {
    expect(s).toContain('const { data, error } = await supabase')
    expect(s).toContain('if (error) throw error')
  })

  it('getMyPoints returns null (unknown) on error, never a wrong 0', () => {
    expect(s).toContain("if (error) { console.warn('getMyPoints failed:', error); return null }")
  })
})
