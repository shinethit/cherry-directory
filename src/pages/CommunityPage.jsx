import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../contexts/AppConfigContext'
import { useSEO } from '../hooks/useSEO'

// ── 5 Groups ──────────────────────────────────────────────
const GROUPS = [
  {
    id: 'emergency',
    icon: '🚨',
    mm: 'အရေးပေါ်',
    en: 'Emergency',
    descMm: 'အရေးပေါ် ဆက်သွယ်ရေးနှင့် သတိပေးချက်များ',
    descEn: 'Emergency contacts & alerts',
    color: 'from-red-600/20 to-red-700/5',
    border: 'border-red-500/30',
    defaultOpen: true,
    features: [
      { path: '/emergency', icon: '🆘', mm: 'အရေးပေါ် ဆက်သွယ်ရေး', en: 'Emergency', descMm: 'ဆေးရုံ • ရဲ • မီးသတ်', descEn: 'Hospital, Police, Fire' },
      { path: '/weather',   icon: '🌧️', mm: 'မိုးလေဝသ/ရေကြီး',      en: 'Weather Alerts', descMm: 'မိုးလေဝသ သတိပေးချက်', descEn: 'Weather warnings' },
      { path: '/power',     icon: '⚡', mm: 'လျှပ်စစ်အခြေအနေ',       en: 'Power Status', descMm: 'မီးပျက်/မီးလာ', descEn: 'Power cut status' },
    ],
  },
  {
    id: 'daily',
    icon: '📅',
    mm: 'နေ့စဉ်သုံး',
    en: 'Daily Use',
    descMm: 'နေ့စဉ် ဘဝအတွက် လိုအပ်တာများ',
    descEn: 'Everyday essentials',
    color: 'from-amber-600/20 to-amber-700/5',
    border: 'border-amber-500/30',
    defaultOpen: true,
    features: [
      { path: '/prices',  icon: '🛒', mm: 'ဈေးနှုန်းဘုတ်',    en: 'Market Prices',  descMm: 'ဆန်၊ ဆီ၊ ငါး ဈေးနှုန်း', descEn: 'Rice, oil, fish prices' },
      { path: '/fuel',    icon: '⛽', mm: 'ဓာတ်ဆီအခြေအနေ',   en: 'Fuel Status',    descMm: 'ဆီရ/မရ အခြေအနေ', descEn: 'Fuel availability' },
      { path: '/bus',     icon: '🚌', mm: 'ကားထွက်ချိန်',      en: 'Bus Schedule',   descMm: 'ကား ထွက်ချိန် Report', descEn: 'Bus departure times' },
      { path: '/notices', icon: '📢', mm: 'ကြေညာချက်များ',   en: 'Announcements',   descMm: 'ရပ်ကွက် ကြေညာချက်', descEn: 'Community notices' },
    ],
  },
  {
    id: 'community',
    icon: '🏘️',
    mm: 'Community',
    en: 'Community',
    descMm: 'ရပ်ရွာ ချိတ်ဆက်ရေးနှင့် ကူညီရေး',
    descEn: 'Connect & help community',
    color: 'from-violet-600/20 to-violet-700/5',
    border: 'border-violet-500/30',
    defaultOpen: false,
    features: [
      { path: '/chat',       icon: '💬', mm: 'Public Chat',      en: 'Public Chat',    descMm: 'အများပြည်သူ ဆွေးနွေးခန်း', descEn: 'Public chat room' },
      { path: '/lost-found', icon: '🔍', mm: 'ပျောက်ဆုံးပစ္စည်း', en: 'Lost & Found',  descMm: 'ပျောက်ဆုံး/တွေ့ရှိ', descEn: 'Lost & found items' },
      { path: '/donations',  icon: '❤️', mm: 'လှူဒါန်းမှု',       en: 'Donations',      descMm: 'ငွေကြေးစုဆောင်းမှု', descEn: 'Fundraising' },
      { path: '/history',    icon: '📜', mm: 'ဒေသသမိုင်း',        en: 'Local History',  descMm: 'ဒေသ သမိုင်းကြောင်း', descEn: 'Regional history' },
    ],
  },
  {
    id: 'services',
    icon: '💼',
    mm: 'ဝန်ဆောင်မှု',
    en: 'Services',
    descMm: 'အလုပ်၊ အိမ်၊ ပညာ၊ ကျန်းမာရေး',
    descEn: 'Jobs, housing, education, health',
    color: 'from-emerald-600/20 to-emerald-700/5',
    border: 'border-emerald-500/30',
    defaultOpen: false,
    features: [
      { path: '/jobs',     icon: '💼', mm: 'အလုပ်ကြော်ငြာ',          en: 'Job Board',      descMm: 'အလုပ်ရှင်/အလုပ်ရှာ', descEn: 'Jobs & seekers' },
      { path: '/rent',     icon: '🏠', mm: 'အိမ်/အခန်း ငှားရမ်း',   en: 'Rentals',        descMm: 'အိမ်ရှင်/အိမ်ငှား', descEn: 'Rentals & seekers' },
      { path: '/tutoring', icon: '📚', mm: 'ဆရာ/ကျောင်းသား',        en: 'Tutoring',       descMm: 'ဆရာရှာ၊ ကျောင်းသားရှာ', descEn: 'Find tutors & students' },
      { path: '/health',   icon: '🏥', mm: 'ကျန်းမာရေးဝန်ဆောင်မှု',  en: 'Health Services', descMm: 'သွေးလှူ၊ အခမဲ့ဆေးခန်း', descEn: 'Blood drives, clinics' },
    ],
  },
  {
    id: 'fun',
    icon: '🎯',
    mm: 'ဖျော်ဖြေရေး',
    en: 'Leisure',
    descMm: 'Tour နှင့် အနားယူရေး',
    descEn: 'Tours & leisure',
    color: 'from-teal-600/20 to-teal-700/5',
    border: 'border-teal-500/30',
    defaultOpen: false,
    features: [
      { path: '/tours', icon: '🏔️', mm: 'Tour Guide / Trekking', en: 'Tour Guides', descMm: 'Trekking / Boat Trip Guide', descEn: 'Local tour guides' },
    ],
  },
]

export default function CommunityPage() {
  const navigate = useNavigate()
  const { lang } = useLang()
  const config = useAppConfig()
  useSEO({ title: 'Community' })

  // Track open/close state per group
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {}
    GROUPS.forEach(g => { initial[g.id] = g.defaultOpen })
    return initial
  })

  function toggleGroup(id) {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="font-display font-bold text-xl text-white">
          🏘️ {lang === 'mm' ? 'Community' : 'Community'}
        </h1>
        <p className="text-xs text-white/40 mt-0.5 font-myanmar">
          {lang === 'mm' ? `${config.app_city || 'မြို့'} Community Features` : `${config.app_city || ''} community tools`}
        </p>
      </div>

      {/* Groups */}
      <div className="px-4 space-y-3">
        {GROUPS.map(group => {
          const isOpen = openGroups[group.id]
          return (
            <div key={group.id} className={`rounded-2xl bg-gradient-to-br ${group.color} border ${group.border} overflow-hidden`}>
              {/* Group header (clickable) */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
              >
                <span className="text-3xl flex-shrink-0">{group.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-base text-white">
                    {lang === 'mm' ? group.mm : group.en}
                  </p>
                  <p className="text-[10px] text-white/50 mt-0.5 font-myanmar">
                    {lang === 'mm' ? group.descMm : group.descEn}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-white/40 bg-white/8 px-2 py-0.5 rounded-full">
                    {group.features.length}
                  </span>
                  {isOpen
                    ? <ChevronUp size={18} className="text-white/50" />
                    : <ChevronDown size={18} className="text-white/50" />
                  }
                </div>
              </button>

              {/* Group features (collapsible) */}
              {isOpen && (
                <div className="border-t border-white/8 px-2 py-2 space-y-1 bg-black/10">
                  {group.features.map(f => (
                    <button
                      key={f.path}
                      onClick={() => navigate(f.path)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/8 transition-colors text-left"
                    >
                      <span className="text-2xl flex-shrink-0">{f.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold text-sm text-white">
                          {lang === 'mm' ? f.mm : f.en}
                        </p>
                        <p className="text-[10px] text-white/50 mt-0.5 font-myanmar">
                          {lang === 'mm' ? f.descMm : f.descEn}
                        </p>
                      </div>
                      <span className="text-white/20 flex-shrink-0">→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      <div className="px-4 mt-6">
        <p className="text-[10px] text-white/25 text-center font-myanmar">
          💡 {lang === 'mm' ? 'Group ကို နှိပ်ပြီး Feature များ ကြည့်နိုင်သည်' : 'Tap a group to view features'}
        </p>
      </div>
    </div>
  )
}
