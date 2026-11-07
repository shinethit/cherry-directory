// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LeaderboardPage from './LeaderboardPage'

// v9.25 regen #2 (slow network): an error with a cached board keeps the
// podium + list with the small amber strip (never the full error card);
// the rank banner keeps the cached rank during a refetch (LB2's hide
// is superseded) with the stale pill under the H1; a missing rows
// array renders the empty state without throwing.

const { queryState, mockRefetchBoard, mockRefetchRank } = vi.hoisted(() => ({
  queryState: { leaderboard: {}, 'leaderboard-rank': {} },
  mockRefetchBoard: vi.fn(),
  mockRefetchRank: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts) => {
    const key = Array.isArray(opts.queryKey) ? opts.queryKey[0] : opts.queryKey
    const s = queryState[key] || {}
    return {
      data: s.data,
      isLoading: s.isLoading ?? false,
      isFetching: s.isFetching ?? false,
      isError: s.isError ?? false,
      error: s.error,
      refetch: key === 'leaderboard' ? (s.refetch || mockRefetchBoard) : (s.refetch || mockRefetchRank),
    }
  },
}))

vi.mock('../contexts/LangContext', () => ({ useLang: () => ({ lang: 'mm' }) }))
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, profile: { points: 120 }, loading: false, isAdmin: false, isModerator: false, isSuperAdmin: false }),
}))
vi.mock('../hooks/useSEO', () => ({ useSEO: () => {} }))
vi.mock('../hooks/usePresence', () => ({ isOnline: () => false, timeAgo: () => '2h ago' }))
vi.mock('../components/TierBadge', () => ({ default: () => null }))
vi.mock('../lib/tiers', () => ({
  getTierProgress: () => ({ next: null, pointsToNext: 0, percent: 100, current: { gradient: '' } }),
  POINT_ACTIONS: [{ icon: () => null, points: 10, mm: 'Review ရေးပါ', en: 'Write a review' }],
}))
vi.mock('../lib/myanmarDate', () => ({ mmtParts: () => ({ y: 2026, m: 11 }) }))
vi.mock('../lib/withTimeout', () => ({ withTimeout: (p) => p }))
vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({}) } }))

const USERS = [
  { id: 'u2', full_name: 'User Two', nickname: 'two', points: 100, total_reviews: 5, total_listings: 2, all_time_points: 300, last_seen: null, role: 'member', avatar_url: null },
  { id: 'u3', full_name: 'User Three', nickname: 'three', points: 80, total_reviews: 3, total_listings: 1, all_time_points: 200, last_seen: null, role: 'member', avatar_url: null },
  { id: 'u1', full_name: 'User One', nickname: 'one', points: 50, total_reviews: 2, total_listings: 1, all_time_points: 120, last_seen: null, role: 'member', avatar_url: null },
  { id: 'u4', full_name: 'User Four', nickname: null, points: 30, total_reviews: 1, total_listings: 0, all_time_points: 60, last_seen: null, role: 'member', avatar_url: null },
]

function setBoard(state) {
  queryState.leaderboard = { data: USERS, isLoading: false, isFetching: false, isError: false, refetch: mockRefetchBoard, ...state }
  queryState['leaderboard-rank'] = { data: null, isLoading: false, isFetching: false, isError: false, refetch: mockRefetchRank }
}

function renderBoard() {
  return render(
    <MemoryRouter initialEntries={['/leaderboard']}>
      <LeaderboardPage />
    </MemoryRouter>,
  )
}

afterEach(() => { cleanup() })

describe('LeaderboardPage 9.25 slow-network', () => {
  beforeEach(() => { mockRefetchBoard.mockClear(); mockRefetchRank.mockClear() })

  it('error with a cached board keeps the list + amber strip, no error card; strip retry refetches', async () => {
    setBoard({})
    const { rerender } = renderBoard()
    await waitFor(() => expect(screen.getByText('User Four')).toBeTruthy())

    setBoard({ data: USERS, isError: true, error: new Error('slow network') })
    rerender(
      <MemoryRouter initialEntries={['/leaderboard']}>
        <LeaderboardPage />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByText(/အဟောင်းပြထားသည်/)).toBeTruthy())
    expect(screen.getByText('User Four')).toBeTruthy()
    expect(screen.queryByText('Leaderboard ရယူမရပါ')).toBeNull()
    fireEvent.click(screen.getByText('ပြန်ကြိုးစားမည်'))
    expect(mockRefetchBoard).toHaveBeenCalled()
  })

  it('rank banner keeps the cached rank during a refetch, with the stale pill', async () => {
    setBoard({ isFetching: true })
    queryState['leaderboard-rank'] = { data: null, isLoading: false, isFetching: true, isError: false, refetch: mockRefetchRank }
    renderBoard()
    await waitFor(() => expect(screen.getByText('User Four')).toBeTruthy())
    // me (u1) is rank 3 in the cached board — the banner stays up.
    expect(screen.getByText('#3')).toBeTruthy()
    expect(screen.getByText(/အသစ်ရယူနေသည်/)).toBeTruthy()
  })

  it('missing rows array renders the empty state without throwing', async () => {
    setBoard({ data: undefined })
    renderBoard()
    await waitFor(() => expect(screen.getByText('Activity မရှိသေးပါ')).toBeTruthy())
    expect(screen.queryByText('Leaderboard ရယူမရပါ')).toBeNull()
  })
})

describe('Leaderboard rank query: resolve-with-error never shows a false #1 (v9.25 regen #5)', () => {
  // The rank queryFn is inline in the component and useQuery is mocked
  // in this file, so the throw guards are asserted on the source: every
  // count/mine fetch in the rank queryFn must throw on error, so the
  // query errors and the banner hides instead of rendering rank 1.
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'LeaderboardPage.jsx'), 'utf8')
  const rankFn = src.slice(src.indexOf("queryKey: ['leaderboard-rank'"))

  it('all-time count error throws', () => {
    expect(rankFn).toContain('const { count, error: rankErr }')
    expect(rankFn).toContain('if (rankErr) throw rankErr')
  })

  it('period mine + count errors throw', () => {
    expect(rankFn).toContain('const { data: mine, error: mineErr }')
    expect(rankFn).toContain('if (mineErr) throw mineErr')
  })
})
