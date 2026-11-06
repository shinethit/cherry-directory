import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Trophy, Star, Building2, Medal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { useSEO } from '../hooks/useSEO'
import { isOnline, timeAgo } from '../hooks/usePresence'
import TierBadge from '../components/TierBadge'
import { getTierProgress, POINT_ACTIONS } from '../lib/tiers'
import { mmtParts } from '../lib/myanmarDate'

// ── Constants ─────────────────────────────────────────────────

const TABS = [
  { id: 'points',   labelMm: 'အမှတ်',   labelEn: 'Points',   icon: Trophy },
  { id: 'reviews',  labelMm: 'Reviews',  labelEn: 'Reviews',  icon: Star },
  { id: 'listings', labelMm: 'လုပ်ငန်း',   labelEn: 'Listings', icon: Building2 },
]

const PERIODS = [
  { id: 'month',  labelMm: 'ဒီလ',    labelEn: 'Month',   view: 'leaderboard_month'  },
  { id: '6month', labelMm: '၆ လ',    labelEn: '6 Months', view: 'leaderboard_6month' },
  { id: 'year',   labelMm: 'ဒီနှစ်', labelEn: 'This Year', view: 'leaderboard_year'  },
  { id: 'all',    labelMm: 'အားလုံး',  labelEn: 'All Time', view: null                },
]

const RANK_GLOW = [
  'shadow-[0_0_20px_rgba(212,175,55,0.25)] border-gold-500/50',
  'border-white/20',
  'border-amber-700/35',
]

// ── Helpers ───────────────────────────────────────────────────

function periodLabel(id, lang) {
  // LB2 (v9.20): MMT parts — the device-local date was a day behind
  // Yangon after 17:30 UTC, so the "ဒီလ" label showed the wrong month.
  const now = mmtParts(new Date().toISOString()) || { y: new Date().getFullYear(), m: new Date().getMonth() + 1 }
  const mmMonths = ['ဇန်','ဖေ','မတ်','ဧပြီ','မေ','ဇွန်','ဇူ','သြ','စက်','အောက်','နို','ဒီ']
  const enMonths = ['January','February','March','April','May','June','July','August','September','October','November','December']
  if (id === 'month') {
    return lang === 'mm'
      ? `${mmMonths[now.m - 1]} ${now.y} — ဒီလ`
      : `${enMonths[now.m - 1]} ${now.y}`
  }
  if (id === '6month') return lang === 'mm' ? 'ခြောက်လအတွင်း' : 'Last 6 months'
  if (id === 'year')   return lang === 'mm' ? `${now.y} ခုနှစ်` : `Year ${now.y}`
  return lang === 'mm' ? 'အချိန်ကာလ အားလုံး' : 'All time'
}

function ptsUnit(tab, period, lang) {
  // Issue 3e (v9.17): never a bare ambiguous number — the 'all' value
  // IS the total, so label it as such.
  if (tab === 'points') {
    if (period === 'all') return lang === 'mm' ? 'စုစုပေါင်း မှတ်' : 'total pts'
    return lang === 'mm' ? 'မှတ်/ကာလ' : 'pts'
  }
  if (tab === 'reviews')  return lang === 'mm' ? 'review' : 'reviews'
  return lang === 'mm' ? 'လုပ်ငန်း' : 'listings'
}

// ── Online dot ───────────────────────────────────────────────
function OnlineDot({ lastSeen }) {
  if (!isOnline(lastSeen)) return null
  return <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[#0d0015]" />
}

// ── Podium ────────────────────────────────────────────────────
function Podium({ users, tab, lang, period }) {
  const navigate = useNavigate()
  // E5 (v9.5): render the podium with however many users exist (1–2
  // places) instead of blanking the whole page below 3 users.
  if (users.length === 0) return null

  const slots = [
    { u: users[1], rank: 2, h: 'h-16', size: 56, emoji: '🥈', textCol: 'text-white/70', border: 'border-white/20' },
    { u: users[0], rank: 1, h: 'h-24', size: 72, emoji: '🥇', textCol: 'text-gold-400',  border: 'border-gold-500/50', crown: true },
    { u: users[2], rank: 3, h: 'h-10', size: 52, emoji: '🥉', textCol: 'text-amber-500/70', border: 'border-amber-700/35' },
  ].filter(s => s.u)

  const val = u => tab === 'points' ? u.points : tab === 'reviews' ? u.total_reviews : u.total_listings

  return (
    <div className="px-4 mb-2">
      <div className="flex items-end justify-center gap-3 pt-4 pb-1">
        {slots.map(({ u, rank, h, size, emoji, textCol, border, crown }) => (
          <div key={rank} onClick={() => navigate(`/profile/${u.id}`)} className="flex flex-col items-center gap-1.5 cursor-pointer" tabIndex={0} role="button" onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/profile/${u.id}`) } }}>
            <div className="relative" style={{ width: size, height: size }}>
              {crown && <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-xl z-10">👑</div>}
              <div className={`w-full h-full rounded-2xl overflow-hidden border-2 ${border} bg-brand-800 flex items-center justify-center`}>
                {u.avatar_url
                  ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className={`font-bold text-white ${size > 60 ? 'text-xl' : 'text-base'}`}>{(u.nickname || u.full_name || '?')[0]}</span>
                }
              </div>
              <OnlineDot lastSeen={u.last_seen} />
            </div>
            <span className="text-xl">{emoji}</span>
            <p className={`text-[10px] font-display font-semibold text-center max-w-[64px] truncate ${textCol}`}>
              {u.nickname ? `@${u.nickname}` : u.full_name}
            </p>
            <TierBadge points={u.all_time_points ?? u.points ?? 0} size="xs" lang={lang} />
            {/* Issue 3e (v9.17): the podium number is the period figure —
                show the all-time total next to it (or label it total). */}
            {tab === 'points' && (
              <p className="text-[9px] text-white/40 text-center">
                {period === 'all'
                  ? (lang === 'mm' ? 'စုစုပေါင်း မှတ်' : 'total pts')
                  : (lang === 'mm' ? `စုစုပေါင်း: ${(u.all_time_points ?? 0).toLocaleString()} မှတ်` : `All time: ${(u.all_time_points ?? 0).toLocaleString()} pts`)}
              </p>
            )}
            <div className={`${h} w-20 rounded-t-xl flex items-center justify-center border ${border} ${rank === 1 ? 'bg-gradient-to-b from-gold-500/15 to-transparent' : 'bg-white/4'}`}>
              <p className={`font-display font-bold text-sm ${textCol}`}>{(val(u) || 0).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── User Row ──────────────────────────────────────────────────
function UserRow({ user, rank, tab, lang, period }) {
  const navigate = useNavigate()
  const val  = tab === 'points' ? user.points : tab === 'reviews' ? user.total_reviews : user.total_listings
  const unit = ptsUnit(tab, period, lang)

  return (
    <div
      onClick={() => navigate(`/profile/${user.id}`)}
      tabIndex={0}
      role="button"
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/profile/${user.id}`) } }}
      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer hover:border-white/15 ${
        rank <= 3 ? RANK_GLOW[rank - 1] : 'border-white/6 bg-white/3'
      }`}
    >
      {/* Rank */}
      {rank <= 3
        ? <span className="text-xl w-8 text-center flex-shrink-0">{'🥇🥈🥉'[rank - 1]}</span>
        : <span className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center font-display font-bold text-sm text-white/60 flex-shrink-0">{rank}</span>
      }

      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-brand-700 border border-brand-500/30 flex items-center justify-center overflow-hidden">
          {user.avatar_url
            ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            : <span className="font-bold text-white text-sm">{(user.nickname || user.full_name || '?')[0]}</span>
          }
        </div>
        <OnlineDot lastSeen={user.last_seen} />
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-display font-semibold text-sm text-white truncate">
            {user.nickname ? `@${user.nickname}` : user.full_name || 'User'}
          </p>
          {user.role !== 'member' && (
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${
              user.role === 'admin'
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                : 'bg-brand-600/20 text-brand-300 border-brand-400/20'
            }`}>{user.role}</span>
          )}
          {/* M1 (v9.17): tiers are LIFETIME — use all_time_points (the
              migration adds it to the period views; falls back to the
              period score until the migration runs). N2: showLabel. */}
          <TierBadge points={user.all_time_points ?? user.points ?? 0} size="xs" lang={lang} showLabel />
        </div>
        <p className="text-[10px] mt-0.5">
          {isOnline(user.last_seen)
            ? <span className="text-green-400">● Online</span>
            : <span className="text-white/60">{timeAgo(user.last_seen, lang)}</span>
          }
        </p>
      </div>

      {/* Score */}
      <div className="text-right flex-shrink-0">
        <p className={`font-display font-bold text-base ${rank === 1 ? 'text-gold-400' : rank <= 3 ? 'text-white/80' : 'text-white/55'}`}>
          {(val || 0).toLocaleString()}
        </p>
        <p className="text-[11px] text-white/50">{unit}</p>
        {/* Issue 3e (v9.17): the row number is the period figure — show
            the all-time total next to it, never one ambiguous number. */}
        {tab === 'points' && period !== 'all' && (
          <p className="text-[10px] text-white/40">{lang === 'mm' ? `စုစုပေါင်း: ${(user.all_time_points ?? 0).toLocaleString()} မှတ်` : `All time: ${(user.all_time_points ?? 0).toLocaleString()} pts`}</p>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function LeaderboardPage() {
  const navigate   = useNavigate()
  const { lang }   = useLang()
  const { user: me, profile } = useAuth()
  useSEO({ title: 'Top Contributors' })

  const [tab, setTab]     = useState('points')
  const [period, setPeriod] = useState('month')

  // Issue 4c (v9.17): useQuery — cached, so the board renders instantly
  // on revisit under VPN. v9.19: the board is deliberately NOT
  // prefetched — it is live data, fetched on demand here.
  const { data: users = [], isLoading: loading, isFetching: boardFetching, isError: loadFailed, error: loadErrObj, refetch: refetchBoard } = useQuery({
    queryKey: ['leaderboard', period, tab],
    queryFn: async () => {
      const periodCfg = PERIODS.find(p => p.id === period)
      const orderCol  = tab === 'points' ? 'period_points' : tab === 'reviews' ? 'period_reviews' : 'period_listings'

      let data
      if (period === 'all') {
        // All-time: use profiles table directly (has accumulated totals)
        const allOrderCol = tab === 'points' ? 'points' : tab === 'reviews' ? 'total_reviews' : 'total_listings'
        // 30 s timeout (was none): a hung query left the board on skeletons forever.
        const res = await withTimeout(supabase
          .from('profiles')
          .select('id, full_name, nickname, avatar_url, role, points, total_reviews, total_listings, last_seen, is_online')
          .gt(allOrderCol, 0)
          .order(allOrderCol, { ascending: false })
          .order('id', { ascending: true })
          .limit(100), 30000, 'Leaderboard')
        // F-MED-8: the query error used to be ignored entirely.
        if (res.error) throw res.error
        data = (res.data || []).map(u => ({
          ...u,
          // Alias for unified rendering
          period_points:   u.points,
          period_reviews:  u.total_reviews,
          period_listings: u.total_listings,
          all_time_points: u.points,
        }))
      } else {
        // Period view: aggregate from ledger
        const res = await withTimeout(supabase
          .from(periodCfg.view)
          .select('*')
          .gt(orderCol, 0)
          .order(orderCol, { ascending: false })
          // S4 (v9.17): deterministic tiebreak — equal scores used to
          // shuffle on every load.
          .order('id', { ascending: true })
          .limit(100), 30000, 'Leaderboard')
        // F-MED-8: same — a failed view query must surface, not render
        // an empty board as if nobody had any activity.
        if (res.error) throw res.error
        data = res.data || []
      }

      // Normalize for UserRow: always expose .points / .total_reviews / .total_listings
      return data.map(u => ({
        ...u,
        points:         u.period_points   ?? u.points         ?? 0,
        total_reviews:  u.period_reviews  ?? u.total_reviews  ?? 0,
        total_listings: u.period_listings ?? u.total_listings ?? 0,
      }))
    },
  })
  const loadError = loadFailed ? (loadErrObj?.message || 'Leaderboard ရယူမရပါ') : ''

  const myIdx = me ? users.findIndex(u => u.id === me.id) : -1
  const myRank = myIdx >= 0 ? myIdx + 1 : null
  const myRow = myIdx >= 0 ? users[myIdx] : null

  // S7 (v9.17): when the user is not in the top 100, count past their
  // own score and show the real rank instead of hiding the banner.
  // LB2 (v9.20): the banner hides while either query is refetching —
  // the cached rank from the previous period/tab used to show through.
  const { data: rankBeyond = null, isFetching: rankFetching } = useQuery({
    queryKey: ['leaderboard-rank', period, tab, me?.id],
    queryFn: async () => {
      const orderCol = tab === 'points' ? 'period_points' : tab === 'reviews' ? 'period_reviews' : 'period_listings'
      const allOrderCol = tab === 'points' ? 'points' : tab === 'reviews' ? 'total_reviews' : 'total_listings'
      let myScore = 0
      if (period === 'all') {
        myScore = tab === 'points' ? (profile?.points || 0) : tab === 'reviews' ? (profile?.total_reviews || 0) : (profile?.total_listings || 0)
        const { count } = await withTimeout(supabase.from('profiles').select('*', { count: 'exact', head: true }).gt(allOrderCol, myScore), 30000, 'Leaderboard rank')
        return { rank: (count || 0) + 1, score: myScore }
      }
      const periodCfg = PERIODS.find(p => p.id === period)
      const { data: mine } = await withTimeout(supabase.from(periodCfg.view).select(orderCol).eq('id', me.id).maybeSingle(), 30000, 'Leaderboard rank')
      myScore = mine?.[orderCol] || 0
      const { count } = await withTimeout(supabase.from(periodCfg.view).select('*', { count: 'exact', head: true }).gt(orderCol, myScore), 30000, 'Leaderboard rank')
      return { rank: (count || 0) + 1, score: myScore }
    },
    enabled: !!me && !loading && myRank === null,
  })

  const currentPeriod = PERIODS.find(p => p.id === period)

  return (
    <div className="pb-8">

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <Trophy size={22} className="text-gold-400 flex-shrink-0" />
          <h1 className="font-display font-bold text-xl text-white">Top Contributors</h1>
        </div>
        <p className="text-xs text-white/60 font-myanmar">{periodLabel(period, lang)}</p>
      </div>

      {/* ── Period dropdown ── */}
      <div className="px-4 mb-1">
        <div className="relative">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="select-dark font-display font-bold">
            {PERIODS.map(p => (
              <option key={p.id} value={p.id} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                {lang === 'mm' ? p.labelMm : p.labelEn}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      {/* ── My rank banner (if logged in and ranked) ── */}
      {(myRank || rankBeyond) && !loading && !boardFetching && !rankFetching && profile && (
        <div className="mx-4 mb-3 px-3 py-2.5 rounded-2xl bg-brand-600/15 border border-brand-400/25">
          <div className="flex items-center gap-2.5 mb-2">
            <Trophy size={14} className="text-brand-300 flex-shrink-0" />
            <p className="text-xs text-white/70 flex-1 font-myanmar">
              {lang === 'mm' ? 'သင်၏ rank' : 'Your rank'}:
              <span className="font-display font-bold text-brand-300 ml-1">#{myRank || rankBeyond?.rank}</span>
            </p>
            <TierBadge points={profile.points || 0} size="xs" lang={lang} />
          </div>
          {/* Issue 3d (v9.17): period points next to ALL-TIME points, so
              the profile (all-time) and the board (period) agree in one view. */}
          <p className="text-[10px] text-white/60 font-myanmar mb-2">
            {lang === 'mm'
              ? `ဒီကာလ: ${(myRow?.points ?? rankBeyond?.score ?? 0).toLocaleString()} မှတ် • စုစုပေါင်း: ${(profile.points || 0).toLocaleString()} မှတ်`
              : `This period: ${(myRow?.points ?? rankBeyond?.score ?? 0).toLocaleString()} pts • All time: ${(profile.points || 0).toLocaleString()} pts`}
          </p>
          {rankBeyond && !myRank && rankBeyond.rank > 100 && (
            <p className="text-[10px] text-white/60 font-myanmar mb-2">Top 100 ထဲ မပါသေးပါ</p>
          )}
          {(() => {
            const prog = getTierProgress(profile.points || 0)
            if (!prog.next) {
              return (
                <p className="text-[9px] text-purple-300 text-center font-myanmar">
                  👑 {lang === 'mm' ? 'အမြင့်ဆုံး Tier ရောက်ပြီ' : 'Top tier reached'}
                </p>
              )
            }
            return (
              <>
                <div className="flex items-center justify-between text-[9px] text-white/60 mb-1 font-myanmar">
                  <span>{lang === 'mm' ? `${prog.pointsToNext} မှတ် ကျန် → ${prog.next.mm}` : `${prog.pointsToNext} pts → ${prog.next.en}`}</span>
                  <span>{prog.percent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-black/30 overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${prog.current.gradient} transition-all`} style={{ width: `${prog.percent}%` }} />
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* ── Podium (top 3) ── */}
      {!loading && <Podium users={users} tab={tab} lang={lang} period={period} />}

      {/* ── Category tabs dropdown ── */}
      <div className="px-4 mb-4">
        <div className="relative">
          <select value={tab} onChange={e => setTab(e.target.value)}
            className="select-dark font-semibold">
            {TABS.map(({ id, labelMm, labelEn }) => (
              <option key={id} value={id} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                {lang === 'mm' ? labelMm : labelEn}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      {/* ── List ── */}
      <div className="px-4 space-y-2">
        {loading
          ? [1,2,3,4,5,6].map(n => <div key={n} className="h-16 rounded-2xl shimmer" />)
          : loadError
          ? (
            <div className="flex flex-col items-center py-14 text-center px-6">
              <Medal size={44} className="text-white/15 mb-3" />
              <p className="font-display font-semibold text-white/60">
                {lang === 'mm' ? 'Leaderboard ရယူမရပါ' : 'Could not load leaderboard'}
              </p>
              <p className="text-xs text-white/60 mt-1 font-myanmar">{loadError}</p>
              <button
                onClick={() => refetchBoard()}
                className="mt-4 px-4 py-2 rounded-xl bg-brand-600/30 border border-brand-400/40 text-brand-200 text-xs font-bold hover:bg-brand-600/40 transition-colors"
              >
                {lang === 'mm' ? 'ထပ်ကြိုးစားမည်' : 'Retry'}
              </button>
            </div>
          )
          : users.length === 0
          ? (
            <div className="flex flex-col items-center py-14 text-center px-6">
              <Medal size={44} className="text-white/15 mb-3" />
              <p className="font-display font-semibold text-white/60">
                {lang === 'mm' ? 'Activity မရှိသေးပါ' : 'No activity yet'}
              </p>
              <p className="text-xs text-white/60 mt-1 font-myanmar">
                {lang === 'mm'
                  ? 'Review ရေး၊ လုပ်ငန်း တင်ပြ၊ Chat လုပ်ပြီး အမှတ် ရယူပါ'
                  : 'Write reviews, submit listings, or chat to earn points'}
              </p>
              <button
                onClick={() => navigate('/points')}
                className="mt-4 px-4 py-2 rounded-xl bg-brand-600/30 border border-brand-400/40 text-brand-200 text-xs font-bold hover:bg-brand-600/40 transition-colors"
              >
                ✨ {lang === 'mm' ? 'အမှတ် လမ်းညွှန် ကြည့်မည်' : 'View Points Guide'}
              </button>
            </div>
          )
          : (
            <>
              {/* E15 (v9.5): the podium holds ranks 1–3, so this list
                  starts at rank 4 — labelled, never silently dropped. */}
              {users.length > 3 && (
                <p className="text-[11px] text-white/60 font-myanmar px-1">{lang === 'mm' ? 'အဆင့် ၄ မှ စ၍' : 'From rank 4'}</p>
              )}
              {users.slice(3).map((u, i) => (
                <UserRow key={u.id} user={u} rank={i + 4} tab={tab} lang={lang} period={period} />
              ))}
            </>
          )
        }
      </div>

      {/* ── Points guide ── */}
      <div className="mx-4 mt-6 card-dark rounded-2xl p-4">
        <p className="text-xs font-display font-bold text-white/50 uppercase tracking-wider mb-3">
          {lang === 'mm' ? 'အမှတ် ဘယ်လိုရမလဲ' : 'How to earn points'}
        </p>
        <div className="space-y-2.5">
          {/* Shared with PointsGuidePage — same POINT_ACTIONS constant,
              so Claim +30 can never be omitted here again (F-MED-7). */}
          {POINT_ACTIONS.map(({ icon: Icon, points, mm, en }) => (
            <div key={points + mm} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-brand-700/40 flex items-center justify-center flex-shrink-0">
                <Icon size={13} className="text-brand-300" />
              </div>
              <p className="text-xs text-white/60 flex-1 font-myanmar">{lang === 'mm' ? mm : en}</p>
              <span className="text-xs font-bold text-green-400 font-mono">+{points}</span>
            </div>
          ))}
        </div>

        {/* Period reset note */}
        <div className="mt-3 pt-3 border-t border-white/8 space-y-1">
          {[
            { id: 'month',  mm: '"ဒီလ" ranking — လတိုင်း ၁ ရက်နေ့ reset',          en: 'Monthly — resets on the 1st each month' },
            { id: '6month', mm: '"နောက်ဆုံး ၆ လ" ranking — နောက်ဆုံး ၁၈၀ ရက်',               en: '6 Months — rolling last 180 days' },
            { id: 'year',   mm: '"ဒီနှစ်" ranking — ဇန်နဝါရီ ၁ ရက်မှ reset',      en: 'Year — resets on January 1st' },
          ].map(p => (
            <p key={p.id} className="text-[9px] text-white/60 font-myanmar">
              💡 {lang === 'mm' ? p.mm : p.en}
            </p>
          ))}
        </div>

        {/* Full Guide link */}
        <button
          onClick={() => navigate('/points')}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gold-500/15 border border-gold-500/30 text-gold-400 text-xs font-bold hover:bg-gold-500/25 transition-colors"
        >
          ✨ {lang === 'mm' ? 'အမှတ် လမ်းညွှန် အပြည့်အစုံ' : 'Full Points Guide'}
        </button>
      </div>

    </div>
  )
}
