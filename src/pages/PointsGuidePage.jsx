import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Star, Building2, Trophy, CalendarCheck, MessageCircle, ShieldCheck, Sparkles, Target } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { TIERS, getTier, getNextTier, getTierProgress } from '../lib/tiers'

const ACTIONS = [
  { icon: Star,          points: 5,  mm: 'Review ရေးသည်',       en: 'Write a review' },
  { icon: Building2,     points: 10, mm: 'လုပ်ငန်း Submit',       en: 'Submit a listing' },
  { icon: Trophy,        points: 20, mm: 'လုပ်ငန်း Approved',     en: 'Listing approved' },
  { icon: CalendarCheck, points: 2,  mm: 'Event RSVP',           en: 'RSVP to event' },
  { icon: MessageCircle, points: 1,  mm: 'Chat မက်ဆေ့ (max 10/day)', en: 'Chat message (max 10/day)' },
  { icon: ShieldCheck,   points: 30, mm: 'Claim Approved',       en: 'Claim approved' },
]

export default function PointsGuidePage() {
  const navigate = useNavigate()
  const { profile, isLoggedIn } = useAuth()
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'Points လမ်းညွှန်' : 'Points Guide' })

  const myPoints = profile?.points || 0
  const currentTier = getTier(myPoints)
  const nextTier = getNextTier(myPoints)
  const progress = getTierProgress(myPoints)

  return (
    <div className="pb-10">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div>
          <h1 className="font-display font-bold text-lg text-white flex items-center gap-2">
            <Sparkles size={18} className="text-gold-400" />
            {lang === 'mm' ? 'Points လမ်းညွှန်' : 'Points Guide'}
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
                <p className="text-[10px] text-white/50">pts</p>
              </div>
            </div>
            {nextTier ? (
              <>
                <div className="flex items-center justify-between text-[10px] text-white/50 mb-1.5 font-myanmar">
                  <span>{lang === 'mm' ? `နောက်: ${nextTier.mm}` : `Next: ${nextTier.en}`}</span>
                  <span>{progress.pointsToNext} pts</span>
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
          {lang === 'mm' ? 'Points ရယူနည်း' : 'How to Earn'}
        </h2>
        <div className="space-y-2">
          {ACTIONS.map(({ icon: Icon, points, mm, en }, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8">
              <div className="w-9 h-9 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-brand-300" />
              </div>
              <p className="flex-1 text-xs text-white/70 font-myanmar">{lang === 'mm' ? mm : en}</p>
              <span className="font-mono font-bold text-sm text-green-400">+{points}</span>
            </div>
          ))}
        </div>
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
                  <p className="text-[10px] text-white/40 font-mono mt-0.5">
                    {tier.max === Infinity ? `${tier.min}+ pts` : `${tier.min} – ${tier.max} pts`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

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
