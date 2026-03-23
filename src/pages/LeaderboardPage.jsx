import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Star, Building2, MessageCircle, CalendarCheck, Medal, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { useSEO } from '../hooks/useSEO'
import { isOnline, timeAgo } from '../hooks/usePresence'

// ── Constants ─────────────────────────────────────────────────

const TABS = [
  { id: 'points',   labelMm: 'Points',   labelEn: 'Points',   icon: Trophy },
  { id: 'reviews',  labelMm: 'Reviews',  labelEn: 'Reviews',  icon: Star },
  { id: 'listings', labelMm: 'လုပ်ငန်း',   labelEn: 'Listings', icon: Building2 },
]

const PERIODS = [
  { id: 'month',  labelMm: 'ဒီလ',    labelEn: 'Month',   view: 'leaderboard_month'  },
  { id: '6month', labelMm: '၆ လ',    labelEn: '6 Months', view: 'leaderboard_6month' },
  { id: 'year',   labelMm: 'ဒီနှစ်', labelEn: 'This Year', view: 'leaderboard_year'  },
  { id: 'all',    labelMm: 'အကုန်',  labelEn: 'All Time', view: null                },
]

const RANK_GLOW = [
  'shadow-[0_0_20px_rgba(212,175,55,0.25)] border-gold-500/50',
  'border-white/20',
  'border-amber-700/35',
]

// ── Helpers ───────────────────────────────────────────────────

function periodLabel(id, lang) {
  const now = new Date()
  const mmMonths = ['ဇန်','ဖေ','မတ်','ဧပြီ','မေ','ဇွန်','ဇူ','သြ','စက်','အောက်','နို','ဒီ']
  if (id === 'month') {
    return lang === 'mm'
      ? `${mmMonths[now.getMonth()]} ${now.getFullYear()} — ဒီလ`
      : now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  if (id === '6month') return lang === 'mm' ? 'ခြောက်လအတွင်း' : 'Last 6 months'
  if (id === 'year')   return lang === 'mm' ? `${now.getFullYear()} ခုနှစ်` : `Year ${now.getFullYear()}`
  return lang === 'mm' ? 'အချိန်ကာလ အကုန်' : 'All time'
}

function ptsUnit(tab, period, lang) {
  const suffix = period !== 'all' ? (lang === 'mm' ? '/ကာလ' : '') : ''
  if (tab === 'points')   return `pts${suffix}`
  if (tab === 'reviews')  return lang === 'mm' ? 'review' : 'reviews'
  return lang === 'mm' ? 'လုပ်ငန်း' : 'listings'
}

// ── Online dot ───────────────────────────────────────────────
function OnlineDot({ lastSeen }) {
  if (!isOnline(lastSeen)) return null
  return <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[#0d0015]" />
}

// ── Podium ────────────────────────────────────────────────────
function Podium({ users, tab, lang }) {
  const navigate = useNavigate()
  if (users.length < 3) return null

  const slots = [
    { u: users[1], rank: 2, h: 'h-16', size: 56, emoji: '🥈', textCol: 'text-white/70', border: 'border-white/20' },
    { u: users[0], rank: 1, h: 'h-24', size: 72, emoji: '🥇', textCol: 'text-gold-400',  border: 'border-gold-500/50', crown: true },
    { u: users[2], rank: 3, h: 'h-10', size: 52, emoji: '🥉', textCol: 'text-amber-500/70', border: 'border-amber-700/35' },
  ]

  const val = u => tab === 'points' ? u.points : tab === 'reviews' ? u.total_reviews : u.total_listings

  return (
    <div className="px-4 mb-2">
      <div className="flex items-end justify-center gap-3 pt-4 pb-1">
        {slots.map(({ u, rank, h, size, emoji, textCol, border, crown }) => (
          <div key={rank} onClick={() => navigate(`/profile/${u.id}`)} className="flex flex-col items-center gap-1.5 cursor-pointer">
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
      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer hover:border-white/15 ${
        rank <= 3 ? RANK_GLOW[rank - 1] : 'border-white/6 bg-white/3'
      }`}
    >
      {/* Rank */}
      {rank <= 3
        ? <span className="text-xl w-8 text-center flex-shrink-0">{'🥇🥈🥉'[rank - 1]}</span>
        : <span className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center font-display font-bold text-sm text-white/40 flex-shrink-0">{rank}</span>
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
        </div>
        <p className="text-[10px] mt-0.5">
          {isOnline(user.last_seen)
            ? <span className="text-green-400">● Online</span>
            : <span className="text-white/25">{timeAgo(user.last_seen, lang)}</span>
          }
        </p>
      </div>

      {/* Score */}
      <div className="text-right flex-shrink-0">
        <p className={`font-display font-bold text-base ${rank === 1 ? 'text-gold-400' : rank <= 3 ? 'text-white/80' : 'text-white/55'}`}>
          {(val || 0).toLocaleString()}
        </p>
        <p className="text-[9px] text-white/30">{unit}</p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function LeaderboardPage() {
  const navigate   = useNavigate()
  const { lang }   = useLang()
  const { user: me } = useAuth()
  useSEO({ title: 'Top Contributors' })

  const [tab, setTab]     = useState('points')
  const [period, setPeriod] = useState('month')
  const [users, setUsers]   = useState([])
  const [myRank, setMyRank] = useState(null)
  const [loading, setLoading] = useState(true)
  const pillRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const periodCfg = PERIODS.find(p => p.id === period)
      const orderCol  = tab === 'points' ? 'period_points' : tab === 'reviews' ? 'period_reviews' : 'period_listings'

      let data
      if (period === 'all') {
        // All-time: use profiles table directly (has accumulated totals)
        const allOrderCol = tab === 'points' ? 'points' : tab === 'reviews' ? 'total_reviews' : 'total_listings'
        const res = await supabase
          .from('profiles')
          .select('id, full_name, nickname, avatar_url, role, points, total_reviews, total_listings, last_seen, is_online')
          .gt(allOrderCol, 0)
          .order(allOrderCol, { ascending: false })
          .limit(100)
        data = (res.data || []).map(u => ({
          ...u,
          // Alias for unified rendering
          period_points:   u.points,
          period_reviews:  u.total_reviews,
          period_listings: u.total_listings,
        }))
      } else {
        // Period view: aggregate from ledger
        const res = await supabase
          .from(periodCfg.view)
          .select('*')
          .gt(orderCol, 0)
          .order(orderCol, { ascending: false })
          .limit(100)
        data = res.data || []
      }

      // Normalize for UserRow: always expose .points / .total_reviews / .total_listings
      const normalized = data.map(u => ({
        ...u,
        points:         u.period_points   ?? u.points         ?? 0,
        total_reviews:  u.period_reviews  ?? u.total_reviews  ?? 0,
        total_listings: u.period_listings ?? u.total_listings ?? 0,
      }))

      if (!cancelled) {
        setUsers(normalized)
        if (me) {
          const idx = normalized.findIndex(u => u.id === me.id)
          setMyRank(idx >= 0 ? idx + 1 : null)
        }
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tab, period, me])

  const currentPeriod = PERIODS.find(p => p.id === period)

  return (
    <div className="pb-8">

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <Trophy size={22} className="text-gold-400 flex-shrink-0" />
          <h1 className="font-display font-bold text-xl text-white">Top Contributors</h1>
        </div>
        <p className="text-xs text-white/40 font-myanmar">{periodLabel(period, lang)}</p>
      </div>

      {/* ── Period dropdown ── */}
      <div className="px-4 mb-1">
        <div className="relative">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="w-full appearance-none border border-white/12 text-white text-sm font-display font-bold rounded-xl px-4 py-2.5 pr-10 outline-none"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
            {PERIODS.map(p => (
              <option key={p.id} value={p.id} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                {lang === 'mm' ? p.labelMm : p.labelEn}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      {/* ── My rank banner (if logged in and ranked) ── */}
      {myRank && !loading && (
        <div className="mx-4 mb-3 flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-brand-600/15 border border-brand-400/25">
          <Trophy size={14} className="text-brand-300 flex-shrink-0" />
          <p className="text-xs text-white/70 flex-1 font-myanmar">
            {lang === 'mm' ? 'သင်၏ rank' : 'Your rank'}:
            <span className="font-display font-bold text-brand-300 ml-1">#{myRank}</span>
          </p>
          <span className="text-[10px] text-white/30">{currentPeriod?.[lang === 'mm' ? 'labelMm' : 'labelEn']}</span>
        </div>
      )}

      {/* ── Podium (top 3) ── */}
      {!loading && <Podium users={users} tab={tab} lang={lang} />}

      {/* ── Category tabs dropdown ── */}
      <div className="px-4 mb-4">
        <div className="relative">
          <select value={tab} onChange={e => setTab(e.target.value)}
            className="w-full appearance-none border border-white/12 text-white text-sm font-semibold rounded-xl px-4 py-2.5 pr-10 outline-none"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
            {TABS.map(({ id, labelMm, labelEn }) => (
              <option key={id} value={id} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                {lang === 'mm' ? labelMm : labelEn}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      {/* ── List ── */}
      <div className="px-4 space-y-2">
        {loading
          ? [1,2,3,4,5,6].map(n => <div key={n} className="h-16 rounded-2xl shimmer" />)
          : users.length === 0
          ? (
            <div className="flex flex-col items-center py-14 text-center px-6">
              <Medal size={44} className="text-white/15 mb-3" />
              <p className="font-display font-semibold text-white/40">
                {lang === 'mm' ? 'Activity မရှိသေးပါ' : 'No activity yet'}
              </p>
              <p className="text-xs text-white/25 mt-1 font-myanmar">
                {lang === 'mm'
                  ? 'Review ရေး၊ လုပ်ငန်း တင်ပြ၊ Chat လုပ်ပြီး Points ရယူပါ'
                  : 'Write reviews, submit listings, or chat to earn points'}
              </p>
            </div>
          )
          : users.slice(3).map((u, i) => (
            <UserRow key={u.id} user={u} rank={i + 4} tab={tab} lang={lang} period={period} />
          ))
        }
      </div>

      {/* ── Points guide ── */}
      <div className="mx-4 mt-6 card-dark rounded-2xl p-4">
        <p className="text-xs font-display font-bold text-white/50 uppercase tracking-wider mb-3">
          {lang === 'mm' ? 'Points ဘယ်လိုရမလဲ' : 'How to earn points'}
        </p>
        <div className="space-y-2.5">
          {[
            { icon: Star,          pts: '+5',  mm: 'Review ရေးသည်',    en: 'Write a review'     },
            { icon: Building2,     pts: '+10', mm: "လုပ်ငန်း Submit",      en: 'Submit a listing'   },
            { icon: Trophy,        pts: '+20', mm: "လုပ်ငန်း Approved",    en: 'Listing approved'   },
            { icon: CalendarCheck, pts: '+2',  mm: 'Event RSVP',        en: 'RSVP to event'      },
            { icon: MessageCircle, pts: '+1',  mm: 'Chat message',      en: 'Chat (max 10/day)'  },
          ].map(({ icon: Icon, pts, mm, en }) => (
            <div key={pts + mm} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-brand-700/40 flex items-center justify-center flex-shrink-0">
                <Icon size={13} className="text-brand-300" />
              </div>
              <p className="text-xs text-white/60 flex-1 font-myanmar">{lang === 'mm' ? mm : en}</p>
              <span className="text-xs font-bold text-green-400 font-mono">{pts}</span>
            </div>
          ))}
        </div>

        {/* Period reset note */}
        <div className="mt-3 pt-3 border-t border-white/8 space-y-1">
          {[
            { id: 'month',  mm: '"ဒီလ" ranking — လတိုင်း ၁ ရက်နေ့ reset',          en: 'Monthly — resets on the 1st each month' },
            { id: '6month', mm: '"၆ လ" ranking — နောက်ဆုံး ၁၈၀ ရက်',               en: '6 Months — rolling last 180 days' },
            { id: 'year',   mm: '"ဒီနှစ်" ranking — ဇန်နဝါရီ ၁ ရက်မှ reset',      en: 'Year — resets on January 1st' },
          ].map(p => (
            <p key={p.id} className="text-[9px] text-white/25 font-myanmar">
              💡 {lang === 'mm' ? p.mm : p.en}
            </p>
          ))}
        </div>
      </div>

    </div>
  )
}
