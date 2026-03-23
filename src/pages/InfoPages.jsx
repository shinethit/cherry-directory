import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'

// ── Shared layout ─────────────────────────────────────────────
function InfoLayout({ title, titleMm, children }) {
  const navigate = useNavigate()
  return (
    <div className="pb-12">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display font-bold text-lg text-white">{titleMm || title}</h1>
      </div>
      <div className="px-4 space-y-6 text-sm text-white/70 leading-relaxed font-myanmar">
        {children}
      </div>
    </div>
  )
}

function Section({ title, titleMm, children }) {
  return (
    <div className="space-y-2">
      <h2 className="font-display font-bold text-base text-white">{titleMm || title}</h2>
      <div className="text-white/60 space-y-2 leading-relaxed">{children}</div>
    </div>
  )
}

// ── About Us ─────────────────────────────────────────────────
export function AboutPage() {
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'ကျွန်ုပ်တို့အကြောင်း' : 'About Us' })
  return (
    <InfoLayout title="About Us" titleMm="ကျွန်ုပ်တို့အကြောင်း">
      <div className="card-dark rounded-3xl p-6 text-center space-y-3">
        <div className="w-40 h-40 rounded-3xl overflow-hidden border-2 border-gold-500/40 shadow-2xl shadow-brand-900/60 mx-auto bg-[#2a0050]">
          <img src="/logo.png" alt="Cherry Directory" className="w-full h-full object-contain" />
        </div>
        <h2 className="font-display font-bold text-xl text-white">Cherry Directory</h2>
        <p className="text-sm text-brand-300">တောင်ကြီးမြို့ • Taunggyi</p>
        <p className="text-white/50 text-xs">Version 2.0 • Since 2026</p>
        <p className="text-white/30 text-xs italic">by Shine Thit</p>
      </div>

      <Section titleMm="Cherry Directory ဆိုသည်မှာ">
        <p>Cherry Directory သည် တောင်ကြီးမြို့နှင့် ပတ်ဝန်းကျင် ဒေသတွင် နေထိုင်သော ပြည်သူများ၏ နေ့စဉ်ဘဝ လိုအပ်ချက်များကို ဖြည့်ဆည်းရန် ဖန်တီးထားသော Community Platform တစ်ခုဖြစ်ပါသည်။</p>
        <p>လုပ်ငန်းရှာဖွေခြင်း၊ သတင်းများ ကြည့်ရှုခြင်း၊ ဖြစ်ရပ်များ ပါဝင်ဆင်နှဲခြင်းမှ စတင်ပြီး ဒေသတွင်း ဈေးနှုန်းများ၊ လျှပ်စစ်အခြေအနေ၊ ဓာတ်ဆီရရှိနိုင်မှု ကဲ့သို့သော Community-sourced Data တွေကိုပါ Real-time တွင် ကြည့်ရှုနိုင်ပါသည်။</p>
      </Section>

      <Section titleMm="ကျွန်ုပ်တို့၏ ရည်မှန်းချက်">
        <p>တောင်ကြီးမြို့သူ မြို့သားများ တစ်ဦးနှင့်တစ်ဦး ချိတ်ဆက်ပြီး ဒေသတွင်း သတင်းအချက်အလက်များကို မျှဝေနိုင်ရေး၊ ဒေသ စီးပွားရေး ဖွံ့ဖြိုးတိုးတက်ရေး၊ Community Spirit ကို ပိုမိုခိုင်မာအောင် ဆောင်ရွက်ပေးနိုင်ရန် ဖြစ်ပါသည်။</p>
      </Section>

      <Section titleMm="ဆိုင်ပိုင်ရှင်များအတွက်">
        <p>သင်၏ လုပ်ငန်းကို Cherry Directory ထဲ ထည့်သွင်းပြီး ပိုမိုသော ဖောက်သည်များကို ဆွဲဆောင်နိုင်ပါသည်။ Business Claim feature ကိုသုံး၍ သင်၏ လုပ်ငန်းကို Verify လုပ်နိုင်ပြီး Verified Badge ရရှိနိုင်ပါသည်။</p>
      </Section>

      <Section titleMm="Community Contributors">
        <p>ဈေးနှုန်းများ တင်ပြခြင်း၊ လျှပ်စစ်အခြေအနေ Report လုပ်ခြင်း၊ ဓာတ်ဆီ ရမရ အသိပေးခြင်း၊ Review ရေးသားခြင်းစသည်ဖြင့် Community ကို ပါဝင်ကူညီသော User တိုင်းကို Points နှင့် Top Contributor Badge ဖြင့် ချီးမြှင့်ပါသည်။</p>
      </Section>

      <div className="card-dark rounded-2xl p-4 text-center space-y-2">
        <p className="text-xs text-white/40">Built with ❤️ for Taunggyi</p>
        <p className="text-xs text-white/30">© {new Date().getFullYear()} Cherry Directory. All rights reserved.</p>
      </div>
    </InfoLayout>
  )
}

// ── Privacy Policy ─────────────────────────────────────────────
export function PrivacyPage() {
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'ကိုယ်ရေးလုံခြုံမှုမူဝါဒ' : 'Privacy Policy' })
  const updated = 'March 2025'
  return (
    <InfoLayout title="Privacy Policy" titleMm="ကိုယ်ရေးလုံခြုံမှုမူဝါဒ">
      <p className="text-xs text-white/30">Last updated: {updated}</p>

      <Section titleMm="ကောက်ယူသောသတင်းအချက်အလက်">
        <p>Cherry Directory သည် အောက်ပါ သတင်းအချက်အလက်များကို ကောက်ယူပါသည်:</p>
        <ul className="space-y-1.5 ml-2">
          {[
            'Account ဖွင့်သောအခါ Email နှင့် နာမည်',
            'Profile ထဲ ကိုယ်တိုင် ထည့်သွင်းသော Avatar၊ Bio',
            'လုပ်ငန်း Submit သောအခါ လုပ်ငန်းနှင့် ဆက်သွယ်ရေး အချက်အလက်',
            'App သုံးစွဲချိန် Last seen timestamp (Online status)',
            'Community Reports: ဈေးနှုန်း၊ လျှပ်စစ်၊ ဓာတ်ဆီ Report data',
            'Chat messages (Public chat room)',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-white/55">
              <span className="text-brand-400 flex-shrink-0 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section titleMm="မကောက်ယူသောသတင်းအချက်အလက်">
        <p className="text-white/60">Cherry Directory သည် အောက်ပါတို့ကို <span className="text-green-400 font-semibold">လုံးဝ မကောက်ယူပါ</span>:</p>
        <ul className="space-y-1.5 ml-2">
          {[
            'ငွေပေးချေမှု သို့မဟုတ် ဘဏ်အကောင့် အချက်အလက်',
            'ID Card / Passport မိတ္တူ',
            'တည်နေရာ (Location) — GPS ကို လုပ်ငန်း Submit မှသာ Optional',
            'Device Contact List',
            'Private Messages (Public Chat သာ ရှိ)',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-white/55">
              <span className="text-red-400 flex-shrink-0 mt-0.5">✗</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section titleMm="သတင်းအချက်အလက် သုံးစွဲပုံ">
        <p>ကောက်ယူသော Data များကို အောက်ပါ ရည်ရွယ်ချက်များဖြင့်သာ သုံးစွဲပါသည်:</p>
        <ul className="space-y-1.5 ml-2">
          {[
            'Account စစ်မှန်ကြောင်း အတည်ပြုရန်',
            'App Features (Bookmark, Review, RSVP) လုပ်ဆောင်ရန်',
            'Community Leaderboard ဖော်ပြရန် (Points calculation)',
            'Admin မှ Content Moderation ဆောင်ရွက်ရန်',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-white/55">
              <span className="text-brand-400 flex-shrink-0 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section titleMm="Data သိမ်းဆည်းခြင်း">
        <p>Data များကို <span className="text-white font-semibold">Supabase</span> (PostgreSQL) တွင် သိမ်းဆည်းပြီး ပုံများကို <span className="text-white font-semibold">Cloudinary CDN</span> တွင် သိမ်းဆည်းပါသည်။ Chat History ၆ လကျော်ပါက auto-delete ဖြစ်ပါသည်။</p>
      </Section>

      <Section titleMm="Third-party Data မမျှဝေ">
        <p>Cherry Directory သည် သင်၏ Personal Data ကို ကြော်ငြာရှင် သို့မဟုတ် တတိယပါတီ ကုမ္ပဏီများသို့ <span className="text-green-400 font-semibold">လုံးဝ မမျှဝေပါ</span>။</p>
      </Section>

      <Section titleMm="သင်၏ အခွင့်အရေး">
        <p>သင်သည် မိမိ Profile ကို ကိုယ်တိုင် Edit သို့မဟုတ် Delete လုပ်နိုင်ပါသည်။ Account ဖျက်ချင်ပါက Admin ကို ဆက်သွယ်နိုင်ပါသည်။</p>
      </Section>
    </InfoLayout>
  )
}

// ── Terms of Service ─────────────────────────────────────────
export function TermsPage() {
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'ဝန်ဆောင်မှုစည်းမျဉ်း' : 'Terms of Service' })
  return (
    <InfoLayout title="Terms of Service" titleMm="ဝန်ဆောင်မှုစည်းမျဉ်း">
      <p className="text-xs text-white/30">Last updated: March 2025</p>

      <Section titleMm="သဘောတူညီချက်">
        <p>Cherry Directory ကို သုံးစွဲသောအခါ ဤ Terms of Service ကို သဘောတူကြောင်း မှတ်ယူပါသည်။</p>
      </Section>

      <Section titleMm="ခွင့်ပြုသောသုံးစွဲမှု">
        <ul className="space-y-1.5 ml-2">
          {[
            'ဒေသတွင်း လုပ်ငန်းများ ရှာဖွေကြည့်ရှုခြင်း',
            'မှန်ကန်သော လုပ်ငန်း Submit နှင့် Review ရေးခြင်း',
            'Community ကို အကျိုးဖြစ်ထွန်းစေသော Chat မျှဝေခြင်း',
            'မှန်ကန်သော ဈေးနှုန်း၊ လျှပ်စစ်၊ ဓာတ်ဆီ Report တင်ပြခြင်း',
          ].map((item, i) => <li key={i} className="flex items-start gap-2 text-white/55"><span className="text-green-400 flex-shrink-0 mt-0.5">✓</span><span>{item}</span></li>)}
        </ul>
      </Section>

      <Section titleMm="တားမြစ်သောသုံးစွဲမှု">
        <ul className="space-y-1.5 ml-2">
          {[
            'မမှန်ကန်သော အချက်အလက်များ တင်ပြခြင်း',
            'တစ်ပါးသူ လုပ်ငန်းကို ခွင့်မပြုဘဲ Claim လုပ်ခြင်း',
            'Spam, Fake reviews ရေးသားခြင်း',
            'အခြားသုံးစွဲသူများကို နှောင့်ယှက်ခြင်း၊ စော်ကားခြင်း',
            'Copyright ချိုးဖောက်သော ပစ္စည်းများ တင်ခြင်း',
            'App ၏ Security ကို ဖောက်ထွင်းကြိုးစားခြင်း',
          ].map((item, i) => <li key={i} className="flex items-start gap-2 text-white/55"><span className="text-red-400 flex-shrink-0 mt-0.5">✗</span><span>{item}</span></li>)}
        </ul>
      </Section>

      <Section titleMm="Content Ownership">
        <p>သင် တင်ပြသော လုပ်ငန်းအချက်အလက်၊ Review၊ ပုံများ၏ ပိုင်ဆိုင်မှုသည် သင်နှင့်သာ ဆက်ဆံပါသည်။ Cherry Directory သည် Platform တွင် Display လုပ်ရန် License သာ ရပါသည်။</p>
      </Section>

      <Section titleMm="Community Data">
        <p>ဈေးနှုန်း၊ လျှပ်စစ် Status၊ ဓာတ်ဆီ Report များသည် Community-contributed data ဖြစ်ပြီး တိကျမှုကို 100% အာမမခံနိုင်ပါ။ ဤ Data များကို Reference ထားရုံသာ သုံးပြီး အရေးကြီးသော ဆုံးဖြတ်ချက်များအတွက် တည်းဖြတ်၍ စစ်ဆေးရန် တိုက်တွန်းပါသည်။</p>
      </Section>

      <Section titleMm="Moderation">
        <p>Admin နှင့် Moderator တို့သည် Community Standards ကို ထိန်းသိမ်းရန် မသင့်တော်သော Content များကို ဖယ်ရှားခွင့် ရှိပါသည်။</p>
      </Section>

      <Section titleMm="တာဝန်ကန့်သတ်ချက်">
        <p>Cherry Directory သည် Community တင်ပြသော Data ၏ တိကျမှု၊ လုပ်ငန်းပေးသော ဝန်ဆောင်မှုအရည်အသွေး၊ Review မှန်ကန်မှု တို့အတွက် တာဝန်မယူနိုင်ပါ။</p>
      </Section>
    </InfoLayout>
  )
}

// ── How to Use ─────────────────────────────────────────────────
export function HelpPage() {
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'သုံးစွဲနည်း' : 'How to Use' })

  const sections = [
    {
      icon: '🔍',
      titleMm: 'လုပ်ငန်းရှာဖွေနည်း',
      steps: [
        'Bottom navigation မှ "ရှာဖွေ" icon ကို နှိပ်ပါ',
        'Search box ထဲ လုပ်ငန်းအမည် ရိုက်ထည့်ပါ',
        'Category, မြို့ နှင့် "Verified Owner" filter ကို သုံး၍ ကျဉ်းမြောင်းနိုင်သည်',
        'Listing ကို နှိပ်ပြီး phone/viber/telegram ဖြင့် တိုက်ရိုက် ဆက်သွယ်နိုင်သည်',
      ],
    },
    {
      icon: '🏢',
      titleMm: 'လုပ်ငန်းထည့်နည်း',
      steps: [
        'Login ဝင်ရောက်ပြီး ညာဘက်အောက် + Button ကို နှိပ်ပါ',
        'လုပ်ငန်းအချက်အလက် (အမည်၊ ဖုန်း၊ လိပ်စာ) ဖြည့်ပြီး Submit နှိပ်ပါ',
        'Admin မှ စစ်ဆေးပြီးနောက် Directory ထဲ ပေါ်လာမည်',
        'ဆိုင်ရှင် ဖြစ်ကြောင်း Verify လုပ်ရန် Listing page မှ "ဒါ ကျွန်တော်ဆိုင်" ကို နှိပ်ပါ',
      ],
    },
    {
      icon: '📅',
      titleMm: 'Event Calendar သုံးနည်း',
      steps: [
        'Center bottom "Calendar" icon ကို နှိပ်ပါ',
        'ပြက္ခဒိန်ထဲ Event ရှိသော နေ့ တွင် Purple dot ပြနေမည်',
        'Date ကို နှိပ်ရင် ထိုနေ့ Event list ကျဆင်းမည်',
        '"Going" သို့မဟုတ် "Interested" ကို နှိပ်၍ RSVP လုပ်နိုင်သည်',
      ],
    },
    {
      icon: '🛒',
      titleMm: 'ဈေးနှုန်း တင်ပြနည်း',
      steps: [
        'Community > ဈေးနှုန်းဘုတ် ကို ဖွင့်ပါ',
        'Category filter ဖြင့် ကုန်ပစ္စည်း ရှာဖွေပါ',
        'ကုန်ပစ္စည်းဘေးရှိ + Button ကို နှိပ်ပါ',
        'ဈေးကွက်တွင် ကြည့်ရှုသော တကယ့် ဈေးနှုန်း ရိုက်ထည့်ပြီး Submit နှိပ်ပါ (Login မလိုဘဲ ရပါသည်)',
      ],
    },
    {
      icon: '⚡',
      titleMm: 'လျှပ်စစ် Report လုပ်နည်း',
      steps: [
        'Community > လျှပ်စစ်အခြေအနေ ကို ဖွင့်ပါ',
        'သင်၏ ရပ်ကွက် Card ကို ရှာပါ',
        '"ဖြတ်သည်" သို့မဟုတ် "ပြန်ရ" button ကို နှိပ်ပါ',
        '၅ မိနစ်တစ်ကြိမ်သာ Report တင်နိုင်ပါသည်',
      ],
    },
    {
      icon: '🏆',
      titleMm: 'Points ရရှိနည်း',
      steps: [
        'Review ရေးသားပါ (+5 pts)',
        'လုပ်ငန်း Submit ပြီး Approved ဖြစ်ရပါသည် (+10/+20 pts)',
        'Event RSVP လုပ်ပါ (+2 pts)',
        'Chat Message ပို့ပါ (+1 pt, max 10/day)',
        'Leaderboard တွင် ကိုယ့် Rank ကြည့်နိုင်သည်',
      ],
    },
    {
      icon: '🔴',
      titleMm: 'သွေးလှူ / အခမဲ့ဆေးခန်း ရှာနည်း',
      steps: [
        'Community > ကျန်းမာရေးဝန်ဆောင်မှု ကို ဖွင့်ပါ',
        '"သွေးလှူ" tab ကို ရွေးချယ်ပါ',
        'လိုအပ်သော သွေးအုပ်စု (A+, O- စသည်) ဖြင့် Filter လုပ်နိုင်သည်',
        'ဆေးရုံ ဆက်သွယ်ရေး နံပါတ်ကို တိုက်ရိုက် ခေါ်ဆိုနိုင်သည်',
      ],
    },
    {
      icon: '📱',
      titleMm: 'App ကို Phone ထဲ ထည့်နည်း (PWA)',
      steps: [
        'Browser မှ Cherry Directory ဖွင့်ပြီး Header ရှိ "Install" ကို နှိပ်ပါ',
        '"Add to Home Screen" ကို ရွေးချယ်ပါ',
        'Internet မရှိလည်း Cache ဒေတာ ကြည့်ရှုနိုင်သည်',
        'Push Notification ဖွင့်ရန် Profile > Push Notifications toggle ကို on လုပ်ပါ',
      ],
    },
  ]

  return (
    <InfoLayout title="How to Use" titleMm="သုံးစွဲနည်းလမ်းညွှန်">
      {sections.map((sec, si) => (
        <div key={si} className="card-dark rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{sec.icon}</span>
            <h2 className="font-display font-bold text-base text-white">{sec.titleMm}</h2>
          </div>
          <ol className="space-y-2.5">
            {sec.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-brand-600/40 text-brand-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-white/60 font-myanmar leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      ))}

      {/* Contact */}
      <div className="card-dark rounded-2xl p-4 text-center space-y-2">
        <p className="text-sm font-display font-semibold text-white">မေးမြန်းလိုပါသလား?</p>
        <p className="text-xs text-white/50 font-myanmar">App ထဲ Chat room တွင် Admin ကို ရှာဖွေ မေးမြန်းနိုင်ပါသည်</p>
      </div>
    </InfoLayout>
  )
}
