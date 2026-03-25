import { useNavigate } from 'react-router-dom'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../hooks/useAppConfig'
import { useSEO } from '../hooks/useSEO'

const FEATURES = [
  {
    path: '/emergency',
    icon: '🆘',
    mm: 'အရေးပေါ် ဆက်သွယ်ရေး',
    en: 'Emergency Contacts',
    descMm: 'ဆေးရုံ • ရဲ • မီးသတ် • Ambulance — တစ်ချက်နှိပ်ပြီး ဖုန်းခေါ်',
    descEn: 'Hospital, Police, Fire, Ambulance — one-tap calling',
    color: 'from-red-600/25 to-red-700/10',
    border: 'border-red-500/30',
  },
  {
    path: '/prices',
    icon: '🛒',
    mm: 'ဈေးနှုန်းဘုတ်',
    en: 'Market Prices',
    descMm: 'ဆန်၊ ဆီ၊ ငါး၊ ဓာတ်ဆီ ဈေးနှုန်း Real-time',
    descEn: 'Rice, oil, fish, fuel prices — community reported',
    color: 'from-green-600/20 to-green-700/10',
    border: 'border-green-500/20',
  },
  {
    path: '/power',
    icon: '⚡',
    mm: 'လျှပ်စစ်အခြေအနေ',
    en: 'Power Status',
    descMm: 'ဓာတ်အားဖြတ်တောက်မှု ရပ်ကွက်အလိုက် ကြည့်ရန်',
    descEn: 'Power outage status by ward — live',
    color: 'from-amber-600/20 to-amber-700/10',
    border: 'border-amber-500/20',
  },
  {
    path: '/fuel',
    icon: '⛽',
    mm: 'ဓာတ်ဆီ/ဒီဇယ် ရမရ',
    en: 'Fuel Availability',
    descMm: 'Gas Station တွင် ဓာတ်ဆီ/ဒီဇယ် ရမရ Community Report',
    descEn: 'Gas station fuel availability — community report',
    color: 'from-orange-600/20 to-orange-700/10',
    border: 'border-orange-500/20',
  },
  {
    path: '/lost-found',
    icon: '🔍',
    mm: 'ပျောက်ဆုံးပစ္စည်း',
    en: 'Lost & Found',
    descMm: 'လူ၊ ကလေး၊ တိရိစ္ဆာန်၊ ပစ္စည်း ပျောက်ဆုံး/တွေ့ရှိ',
    descEn: 'Missing people, animals, and items',
    color: 'from-blue-600/20 to-blue-700/10',
    border: 'border-blue-500/20',
  },
  {
    path: '/jobs',
    icon: '💼',
    mm: 'အလုပ်ကြော်ငြာ',
    en: 'Job Board',
    descMm: 'အလုပ်ရှင် / အလုပ်ရှာ — နှစ်ဖက်စလုံးမှ တင်နိုင်',
    descEn: 'Employers & Job Seekers — post from both sides',
    color: 'from-purple-600/20 to-purple-700/10',
    border: 'border-purple-500/20',
  },
  {
    path: '/bus',
    icon: '🚌',
    mm: 'ကားထွက်ချိန်',
    en: 'Bus Schedule',
    descMm: 'ကား ထွက်ချိန် Community Report',
    descEn: 'Bus departure times — community reported',
    color: 'from-sky-600/20 to-sky-700/10',
    border: 'border-sky-500/20',
  },
  {
    path: '/health',
    icon: '🏥',
    mm: 'ကျန်းမာရေးဝန်ဆောင်မှု',
    en: 'Health Services',
    descMm: 'အခမဲ့ဆေးခန်း • သွေးလှူ • ဆေးထိုး schedule',
    descEn: 'Free clinics, blood drives, vaccination schedules',
    color: 'from-red-600/20 to-red-700/10',
    border: 'border-red-500/20',
  },
  {
    path: '/notices',
    icon: '📢',
    mm: 'ကြေညာချက်ဘုတ်',
    en: 'Notice Board',
    descMm: 'ရပ်ကွက်ကြေညာချက်၊ ဆေးထိုး schedule၊ အများပြည်သူ',
    descEn: 'Community notices, vaccination schedules',
    color: 'from-red-600/20 to-red-700/10',
    border: 'border-red-500/20',
  },
  {
    path: '/weather',
    icon: '🌧️',
    mm: 'မိုးလေဝသ/ရေကြီး သတိပေးချက်',
    en: 'Weather & Flood Alerts',
    descMm: 'မိုးလေဝသ / ရေကြီး သတိပေးချက်',
    descEn: 'Weather & flood warnings',
    color: 'from-cyan-600/20 to-cyan-700/10',
    border: 'border-cyan-500/20',
  },
  {
    path: '/donations',
    icon: '❤️',
    mm: 'လှူဒါန်းမှု',
    en: 'Donations',
    descMm: 'ကျောင်း၊ ဘုန်းကြီးကျောင်း၊ Community ငွေကြေးစုဆောင်းမှု',
    descEn: 'School, monastery, community fundraising',
    color: 'from-pink-600/20 to-pink-700/10',
    border: 'border-pink-500/20',
  },
  {
    path: '/tours',
    icon: '🏔️',
    mm: 'Tour Guide / Trekking',
    en: 'Tour Guide / Trekking',
    descMm: 'Trekking / Boat Trip Guide တွေ',
    descEn: 'Local trekking & boat tour guides',
    color: 'from-teal-600/20 to-teal-700/10',
    border: 'border-teal-500/20',
  },
  // NEW: Rental / Housing
  {
    path: '/rent',
    icon: '🏠',
    mm: 'အိမ်/အခန်း ငှားရမ်းခြင်း',
    en: 'Rentals',
    descMm: 'အိမ်ရှင် / အိမ်ငှား — ချိတ်ဆက်ရေး၊ Status ပြောင်းနိုင်',
    descEn: 'Connect landlords & tenants, status tracking',
    color: 'from-emerald-600/20 to-emerald-700/10',
    border: 'border-emerald-500/20',
  },
  // NEW: Tutoring
  {
    path: '/tutoring',
    icon: '📚',
    mm: 'ဆရာ/ကျောင်းသား ချိတ်ဆက်ရေး',
    en: 'Tutoring',
    descMm: 'ဆရာရှာ၊ ကျောင်းသားရှာ — ဘာသာရပ်၊ အတန်းအလိုက် Filter',
    descEn: 'Find tutors or students — filter by subject & grade',
    color: 'from-indigo-600/20 to-indigo-700/10',
    border: 'border-indigo-500/20',
  },
  // NEW: Local History & Knowledge
  {
    path: '/history',
    icon: '📜',
    mm: 'ဒေသဆိုင်ရာ သမိုင်းကြောင်းများ',
    en: 'Local History',
    descMm: 'တောင်ကြီး၊ ကလော၊ အင်းလေး စသည့် ဒေသဆိုင်ရာ သမိုင်း၊ ယဉ်ကျေးမှု၊ သိသင့်သိထိုက်ရာ',
    descEn: 'History, culture, and knowledge about our region',
    color: 'from-amber-600/20 to-amber-700/10',
    border: 'border-amber-500/20',
  },
]

export default function CommunityPage() {
  const navigate = useNavigate()
  const { lang } = useLang()
  const config = useAppConfig()
  useSEO({ title: lang === 'mm' ? 'Community' : 'Community' })

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3">
        <h1 className="font-display font-bold text-xl text-white">🏘️ {lang === 'mm' ? 'Community' : 'Community'}</h1>
        <p className="text-xs text-white/40 mt-0.5 font-myanmar">
          {lang === 'mm' ? `${config.app_city || 'မြို့'} Community Features` : `${config.app_city || ''} community tools`}
        </p>
      </div>

      <div className="px-4 space-y-2">
        {FEATURES.map(f => (
          <button
            key={f.path}
            onClick={() => navigate(f.path)}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r ${f.color} border ${f.border} hover:opacity-90 transition-opacity text-left`}
          >
            <span className="text-3xl flex-shrink-0">{f.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-sm text-white">{lang === 'mm' ? f.mm : f.en}</p>
              <p className="text-[10px] text-white/50 mt-0.5 font-myanmar">{lang === 'mm' ? f.descMm : f.descEn}</p>
            </div>
            <span className="text-white/20 flex-shrink-0">→</span>
          </button>
        ))}
      </div>
    </div>
  )
}
