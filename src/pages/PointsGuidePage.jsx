import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, Sparkles, Target, History } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { usePoints } from '../hooks/usePoints'
import { formatMyanmarDate } from '../lib/myanmarDate'
import { TIERS, getTier, getNextTier, getTierProgress, POINT_ACTIONS } from '../lib/tiers'

// Ledger action → human label (same values as POINT_ACTIONS). Reversal
// rows share the action with negative points — the sign comes from the
// row itself, so a -5 Review row reads as a removed review.
const HISTORY_LABELS = {
  write_review:     { mm: 'Review',   en: 'Review' },
  submit_listing:   { mm: 'တင်ပြခြင်း', en: 'Submit' },
  listing_approved: { mm: 'Approved', en: 'Approved' },
  rsvp_going:       { mm: 'RSVP',     en: 'RSVP' },
  chat_message:     { mm: 'Chat',     en: 'Chat' },
  claim_approved:   { mm: 'Claim',    en: 'Claim' },
}

// E10 (v9.5): where each "how to earn" action is done. Order mirrors
// POINT_ACTIONS in src/lib/tiers.js (not owned by this track, so the
// destination lives here by index): Review → directory, Submit → /submit,
// Approved/Claim → my submissions, RSVP → calendar, Chat → /chat.
const ACTION_LINKS = [
  { to: '/directory',      mm: 'Review ရေးရန် →',          en: 'Write a review →' },
  { to: '/submit',         mm: 'လုပ်ငန်း တင်ရန် →',         en: 'Submit a listing →' },
  { to: '/my-submissions', mm: 'တင်ပြမှုများ ကြည့်ရန် →',    en: 'View my submissions →' },
  { to: '/calendar',       mm: 'Event ကြည့်ရန် →',         en: 'View events →' },
  { to: '/chat',           mm: 'Chat သွားရန် →',            en: 'Go to chat →' },
  { to: '/my-submissions', mm: 'ပိုင်ဆိုင်ကြောင်း အခြေအနေ ကြည့်ရန် →',  en: 'View claim status →' },
]

export default function PointsGuidePage() {
  const navigate = useNavigate()
  const { profile, isLoggedIn } = useAuth()
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'အမှတ် လမ်းညွှန်' : 'Points Guide' })

  const myPoints = profile?.points || 0
  const currentTier = getTier(myPoints)
  const nextTier = getNextTier(myPoints)
  const progress = getTierProgress(myPoints)

  // Issue 3c (v9.17): the ledger breakdown — the user-visible proof of
  // where points came from. getHistory had ZERO callers before this.
  const { getHistory, getMonthlyPoints } = usePoints()
  const [history, setHistory] = useState(null)
  const [historyError, setHistoryError] = useState(false)
  // Issue 3e (v9.17): this-month points next to the all-time total —
  // one bare number was ambiguous. Monthly comes from the
  // leaderboard_month view (same Yangon-month definition as the board).
  const [monthPoints, setMonthPoints] = useState(null)
  useEffect(() => {
    if (!isLoggedIn) return
    let cancelled = false
    getHistory(20).then(rows => { if (!cancelled) setHistory(rows || []) }).catch(() => { if (!cancelled) setHistoryError(true) })
    getMonthlyPoints().then(v => { if (!cancelled) setMonthPoints(v) }).catch(() => { if (!cancelled) setMonthPoints(null) })
    return () => { cancelled = true }
  }, [isLoggedIn])

  return (
    <div className="pb-10">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div>
          <h1 className="font-display font-bold text-lg text-white flex items-center gap-2">
            <Sparkles size={18} className="text-gold-400" />
            {lang === 'mm' ? 'အမှတ် လမ်းညွှန်' : 'Points Guide'}
          </h1>
        </div>
      </div>

      {isLoggedIn && (
        <div className="px-4 mb-5">
          <div className={`rounded-2xl p-4 border ${currentTier.border} bg-gradient-to-br ${currentTier.bg} to-transparent`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{currentTier.emoji}</span>
                <div>
                  <p className={`font-display font-bold text-base ${currentTier.color}`}>
                    {lang === 'mm' ? currentTier.mm : currentTier.en}
                  </p>
                  <p className="text-[10px] text-white/50 font-myanmar">{lang === 'mm' ? 'လက်ရှိ Tier' : 'Current tier'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-xl text-white">{myPoints.toLocaleString()}</p>
                <p className="text-[10px] text-white/50">{lang === 'mm' ? 'စုစုပေါင်း မှတ်' : 'total pts'}</p>
                <p className="text-[11px] text-gold-400 mt-1 font-myanmar">{lang === 'mm' ? `ဒီလ: ${monthPoints === null ? '—' : monthPoints.toLocaleString()} မှတ်` : `This month: ${monthPoints === null ? '—' : monthPoints.toLocaleString()} pts`}</p>
              </div>
            </div>
            {nextTier ? (
              <>
                <div className="flex items-center justify-between text-[10px] text-white/50 mb-1.5 font-myanmar">
                  <span>{lang === 'mm' ? `နောက်: ${nextTier.mm}` : `Next: ${nextTier.en}`}</span>
                  <span>{lang === 'mm' ? `${progress.pointsToNext} မှတ်` : `${progress.pointsToNext} pts`}</span>
                </div>
                <div className="h-2 rounded-full bg-black/30 overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${currentTier.gradient} transition-all`} style={{ width: `${progress.percent}%` }} />
                </div>
              </>
            ) : (
              <p className="text-[10px] text-purple-300 text-center font-myanmar">👑 {lang === 'mm' ? 'အမြင့်ဆုံး Tier' : 'Top tier'}</p>
            )}
          </div>
        </div>
      )}

      <div className="px-4 mb-5">
        <h2 className="text-xs font-display font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Target size={14} className="text-brand-300" />
          {lang === 'mm' ? 'အမှတ် ရယူနည်း' : 'How to Earn'}
        </h2>
        <div className="space-y-2">
          {POINT_ACTIONS.map(({ icon: Icon, points, mm, en }, i) => (
            <button key={i} onClick={() => navigate(ACTION_LINKS[i]?.to || '/leaderboard')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8 hover:border-brand-400/40 hover:bg-white/6 transition-colors text-left">
              <div className="w-9 h-9 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-brand-300" />
              </div>
              <p className="flex-1 min-w-0 text-xs text-white/70 font-myanmar">{lang === 'mm' ? mm : en}</p>
              <span className="font-mono font-bold text-sm text-green-400">+{points}</span>
              <span className="text-[11px] font-bold text-brand-300">{lang === 'mm' ? ACTION_LINKS[i]?.mm : ACTION_LINKS[i]?.en}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/60 font-myanmar mt-2">
          {lang === 'mm'
            ? 'Approved / ပိုင်ဆိုင်ကြောင်း အမှတ်များသည် Admin အတည်ပြုပြီးမှ ရရှိပါသည်။ Chat အမှတ်သည် တစ်နေ့ အများဆုံး ၁၀ အမှတ် သာ ရသည်။'
            : 'Approved / Claim points are awarded only after Admin approval. Chat points are capped at 10 per day.'}
        </p>
      </div>

      <div className="px-4">
        <h2 className="text-xs font-display font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Trophy size={14} className="text-gold-400" />
          {lang === 'mm' ? 'Tier အဆင့်များ' : 'Tier Levels'}
        </h2>
        <div className="space-y-2">
          {TIERS.map(tier => {
            const isCurrent = isLoggedIn && currentTier.id === tier.id
            return (
              <div key={tier.id} className={`flex items-center gap-3 p-3 rounded-xl border ${tier.bg} ${tier.border} ${isCurrent ? 'ring-2 ring-white/20' : ''}`}>
                <span className="text-2xl flex-shrink-0">{tier.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-display font-bold text-sm ${tier.color}`}>{lang === 'mm' ? tier.mm : tier.en}</p>
                    {isCurrent && <span className="text-[8px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-bold">{lang === 'mm' ? 'သင်ရှိသည်' : 'You'}</span>}
                  </div>
                  <p className="text-[10px] text-white/60 font-mono mt-0.5">
                    {tier.max === Infinity
                      ? (lang === 'mm' ? `${tier.min}+ မှတ်` : `${tier.min}+ pts`)
                      : (lang === 'mm' ? `${tier.min} – ${tier.max} မှတ်` : `${tier.min} – ${tier.max} pts`)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Issue 3c (v9.17): points history from the ledger. */}
      {isLoggedIn && (
      <div className="px-4 mt-6">
        <h2 className="text-xs font-display font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
          <History size={14} className="text-gold-400" />
          {lang === 'mm' ? 'အမှတ်မှတ်တမ်း' : 'Points History'}
        </h2>
        {history === null && !historyError ? (
          <div className="space-y-2">
            {[1, 2, 3].map(n => <div key={n} className="h-11 rounded-xl shimmer" />)}
          </div>
        ) : historyError ? (
          <p className="text-xs text-white/60 font-myanmar p-3 card-dark rounded-xl">မှတ်တမ်း ရယူမရပါ — ထပ်ကြိုးစားပါ</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-white/60 font-myanmar p-3 card-dark rounded-xl">
            {lang === 'mm' ? 'အမှတ် မှတ်တမ်း မရှိသေးပါ — Review ရေး၊ လုပ်ငန်း တင်ပြီး အမှတ် ရယူပါ' : 'No points yet — write a review or submit a listing to earn points'}
          </p>
        ) : (
          <div className="space-y-2">
            {history.map(row => {
              const label = HISTORY_LABELS[row.action] || { mm: row.action, en: row.action }
              const pts = Number(row.points) || 0
              return (
                <div key={row.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/80 font-myanmar">{lang === 'mm' ? label.mm : label.en}</p>
                    <p className="text-[10px] text-white/50 mt-0.5">{formatMyanmarDate(row.created_at, { year: true })}</p>
                  </div>
                  <span className={`font-mono font-bold text-sm ${pts >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pts >= 0 ? `+${pts}` : pts}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
      )}

      <div className="px-4 mt-6">
        <button
          onClick={() => navigate('/leaderboard')}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600/30 border border-brand-400/40 text-brand-200 text-xs font-bold hover:bg-brand-600/40 transition-colors"
        >
          <Trophy size={14} />
          {lang === 'mm' ? 'Leaderboard ကြည့်မည်' : 'View Leaderboard'}
        </button>
      </div>
    </div>
  )
}
