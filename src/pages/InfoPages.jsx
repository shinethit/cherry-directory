import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../contexts/AppConfigContext'
import { useSEO } from '../hooks/useSEO'
import { APP_VERSION } from '../lib/appVersion'
import { goBackOrHome } from '../lib/navigation'

// ── Shared layout ─────────────────────────────────────────────
function InfoLayout({ title, titleMm, children }) {
  const navigate = useNavigate()
  const { lang } = useLang() // S34 (v9.17): page title follows the language
  const shownTitle = lang === 'mm' ? (titleMm || title) : (title || titleMm)
  return (
    <div className="pb-12">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => goBackOrHome(navigate, '/')} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display font-bold text-lg text-white">{shownTitle}</h1>
      </div>
      <div className="px-4 space-y-6 text-sm text-white/70 leading-relaxed font-myanmar">
        {children}
      </div>
    </div>
  )
}

function Section({ title, titleMm, children }) {
  const { lang } = useLang() // S34 (v9.17): section title follows the language
  const shownTitle = lang === 'mm' ? (titleMm || title) : (title || titleMm)
  return (
    <div className="space-y-2">
      <h2 className="font-display font-bold text-base text-white">{shownTitle}</h2>
      <div className="text-white/60 space-y-2 leading-relaxed">{children}</div>
    </div>
  )
}

// ── Disclaimer Banner Component ───────────────────────────────
function DisclaimerBanner() {
  return (
    <div className="bg-amber-500/15 border-2 border-red-500/60 rounded-2xl p-5 my-4 shadow-lg shadow-red-900/20">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <span className="text-4xl text-red-500 animate-pulse">⚠️</span>
        </div>
        <div>
          <p className="text-red-400 font-bold text-lg font-myanmar mb-2">
            သတိပြုရန် အရေးကြီး
          </p>
          <p className="text-amber-300 text-base font-myanmar leading-relaxed">
            ဤ App အတွင်းရှိ အချက်အလက်အများစုသည် Community မှ တင်ပြသော အချက်အလက်များ ဖြစ်ပါသည်။ ဖန်တီးသူက အချက်အလက်တိုင်း၏ မှန်ကန်မှုကို အာမမခံနိုင်ပါ။ ဖုန်းနံပါတ်နှင့် လိပ်စာများကို ကိုယ်တိုင် စစ်ဆေးပြီးမှ ဆက်သွယ်ပါ။
          </p>
        </div>
      </div>
    </div>
  )
}

// ── About Us ─────────────────────────────────────────────────
export function AboutPage() {
  const { lang } = useLang()
  const config = useAppConfig()
  useSEO({ title: lang === 'mm' ? 'ကျွန်ုပ်တို့အကြောင်း' : 'About Us' })
  return (
    <InfoLayout title="About Us" titleMm="ကျွန်ုပ်တို့အကြောင်း">
      <div className="card-dark rounded-3xl p-6 text-center space-y-3">
        <div className="w-40 h-40 rounded-3xl overflow-hidden border-2 border-gold-500/40 shadow-2xl shadow-brand-900/60 mx-auto bg-[#2a0050]">
          <img src="/logo.png" alt="Cherry Directory" className="w-full h-full object-contain" />
        </div>
        <h2 className="font-display font-bold text-xl text-white">Cherry Directory</h2>
        <p className="text-sm text-brand-300">{config.app_city || "တောင်ကြီးမြို့"}</p>
        <p className="text-white/50 text-xs">Version {APP_VERSION} • Since 2026</p>
        <p className="text-white/60 text-xs italic">by Shine Thit</p>
      </div>

      <Section titleMm="Cherry Directory ဆိုသည်မှာ">
        <p>Cherry Directory သည် ဒေသတွင်း လုပ်ငန်းများကို ရှာဖွေနိုင်သော Community လမ်းညွှန် တစ်ခု ဖြစ်ပါသည်။</p>
        <p>လုပ်ငန်း ရှာဖွေခြင်း၊ ဖုန်းဆက်သွယ်ခြင်း၊ သတင်း ကြည့်ရှုခြင်း၊ ရပ်ရွာပွဲများတွင် ပါဝင်ခြင်းအပြင် ဒေသတွင်း ဈေးနှုန်းများနှင့် ဆီဆိုင်လမ်းညွှန်တို့ကိုလည်း ကြည့်ရှုနိုင်ပါသည်။</p>
      </Section>

      <Section titleMm="ကျွန်ုပ်တို့၏ ရည်မှန်းချက်">
        <p>မြို့သူ မြို့သားများ တစ်ဦးနှင့်တစ်ဦး ချိတ်ဆက်နိုင်ရေး၊ ဒေသတွင်း သတင်းအချက်အလက်များ မျှဝေနိုင်ရေး၊ ဒေသ စီးပွားရေး ဖွံ့ဖြိုးတိုးတက်ရေးနှင့် ရပ်ရွာ စိတ်ဓာတ် ခိုင်မာရေးတို့အတွက် ဖြစ်ပါသည်။</p>
      </Section>

      <Section titleMm="အသုံးပြုနည်း အကျဉ်း">
        <p>Home မှ လုပ်ငန်းများကို ရှာဖွေ ကြည့်ရှုနိုင်ပြီး Account ရှိရင် ကြိုက်သော လုပ်ငန်းကို သိမ်းထားနိုင်ပါသည်။ Community တွင် ဈေးနှုန်းများကို တင်ပြ၍ အခြားသူများနှင့် မျှဝေနိုင်ပြီး ပြက္ခဒိန်တွင် ရပ်ရွာပွဲများကို ကြည့်ရှုပြီး ပါဝင်မည်ဆိုတာ စာရင်းပေးနိုင်ပါသည်။ Account ရှိသူများသည် မိမိ လုပ်ငန်းကို တင်ပြနိုင်ပြီး ပိုင်ရှင်ဖြစ်ကြောင်း တောင်းဆို၍ အတည်ပြုခိုင်းနိုင်ပါသည်။</p>
      </Section>

      <Section titleMm="ဆိုင်ပိုင်ရှင်များအတွက်">
        <p>သင်၏ လုပ်ငန်းကို Cherry Directory တွင် ထည့်သွင်းထားခြင်းဖြင့် ဖောက်သည်အသစ်များ ပိုမိုရရှိနိုင်ပါသည်။</p>
        <p>ပိုင်ရှင်ဖြစ်ကြောင်း တောင်းဆိုလိုက်ပါက Admin က စစ်ဆေးပြီး အတည်ပြု တံဆိပ် ပေးအပ်ပါသည်။</p>
      </Section>

      <Section titleMm="Community Contributors">
        <p>ဈေးနှုန်း တင်ပြခြင်း၊ Review ရေးသားခြင်းစဖြင့် Community ကို ပါဝင်ကူညီသူတိုင်းကို အမှတ်ပေးပြီး အမှတ်စာရင်းတွင် အဆင့် တက်နိုင်ပါသည်။</p>
      </Section>

      <div className="card-dark rounded-2xl p-4 text-center space-y-2">
        <p className="text-xs text-white/60">Built with ❤️ for {config.app_city || "our city"}</p>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} Cherry Directory. All rights reserved.</p>
      </div>
    </InfoLayout>
  )
}

// ── Privacy Policy (with Disclaimer) ─────────────────────────
export function PrivacyPage() {
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'ကိုယ်ရေးလုံခြုံမှုမူဝါဒ' : 'Privacy Policy' })
  const updated = 'နိုဝင်ဘာ 2026'
  return (
    <InfoLayout title="Privacy Policy" titleMm="ကိုယ်ရေးလုံခြုံမှုမူဝါဒ">
      <p className="text-xs text-white/60">Last updated: {updated}</p>

      {/* ⚠️ DISCLAIMER BANNER - Prominent Yellow with Red Text */}
      <DisclaimerBanner />

      <Section titleMm="ကောက်ယူသောသတင်းအချက်အလက်">
        <p>Cherry Directory သည် အောက်ပါ သတင်းအချက်အလက်များကို ကောက်ယူပါသည်:</p>
        <ul className="space-y-1.5 ml-2">
          {[
            'Account ဖွင့်သောအခါ Email နှင့် နာမည်',
            'Profile ထဲ ကိုယ်တိုင် ထည့်သွင်းသော Avatar နှင့် Bio',
            'လုပ်ငန်း တင်ပြသောအခါ လုပ်ငန်းအမည်၊ လိပ်စာ၊ ဖုန်းနံပါတ်၊ ပုံများနှင့် တည်နေရာ (မြေပုံပေါ်က နေရာ — ထည့်ချင်မှ ထည့်ပါ)',
            'Review၊ သိမ်းဆည်းထားသော လုပ်ငန်း၊ အမှတ်နှင့် Leaderboard အချက်အလက်',
            'App သုံးနေချိန် နောက်ဆုံး ဖွင့်ခဲ့သော အချိန် (အွန်လိုင်း ရှိ/မရှိ ပြရန်)',
            'ဈေးနှုန်း တင်ပြချက်များနှင့် စကားပြောခန်း (Public Chat) စာများ',
            'လာရောက်ကြည့်ရှုမှု (တစ်ခါ ရောက်တိုင်း တစ်ကြိမ် — နိုင်ငံသာ မှတ်ပါသည်၊ IP လိပ်စာကို မသိမ်းပါ)',
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
            'Device Contact List (ဖုန်းထဲက Contact များ)',
            'Private Message (Public Chat သာ ရှိပါသည်)',
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
            'Account စီမံခန့်ခွဲရန်နှင့် App လုပ်ဆောင်ချက်များ (သိမ်းထားခြင်း၊ Review၊ ပွဲတက်ရန် စာရင်းပေးခြင်း) အသုံးပြုရန်',
            'အမှတ်စာရင်း ဖော်ပြရန် (အမှတ် တွက်ချက်မှု)',
            'Admin မှ မသင့်တော်သော အကြောင်းအရာများ စစ်ဆေး ဖယ်ရှားရန်',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-white/55">
              <span className="text-brand-400 flex-shrink-0 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section titleMm="Data သိမ်းဆည်းခြင်း">
        <p>အချက်အလက်များကို အင်တာနက်ပေါ်က လုံခြုံသော သိုလှောင်မှုတွင် သိမ်းဆည်းပြီး ပုံများကို ပုံသိမ်းဆည်းရေး ဝန်ဆောင်မှုတွင် သိမ်းဆည်းပါသည်။</p>
      </Section>

      <Section titleMm="Third-party ဝန်ဆောင်မှုများ">
        <p>Personal Data ကို မည်သူ့ကိုမှ မရောင်းပါ / မမျှဝေပါ။</p>
        <p>လာရောက်ကြည့်ရှုမှု စာရင်းအတွက် ဘယ် နိုင်ငံက လာကြည့်လဲ ဆိုတာသာ မှတ်ပါသည် — သင့်ရဲ့ အင်တာနက် လိပ်စာကို မသိမ်းပါ။</p>
      </Section>

      <Section titleMm="သင်၏ အခွင့်အရေး">
        <p>သင်သည် မိမိ Profile ကို ကိုယ်တိုင် Edit လုပ်နိုင်ပါသည်။ Account ဖျက်ချင်ပါက Admin ကို ဆက်သွယ်နိုင်ပါသည်။</p>
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
      <p className="text-xs text-white/60">Last updated: နိုဝင်ဘာ 2026</p>
      {/* H20: this page is informational only — no separate "Agree" button;
          using the app counts as agreement, as stated below. */}
      <p className="text-xs text-white/60 italic">ဤစာမျက်နှာသည် စည်းမျဉ်းများကို အသိပေးရန် အချက်အလက်သာ ဖြစ်ပါသည် — သီးခြား "သဘောတူ" ခလုတ် မလိုအပ်ပါ။</p>

      <Section titleMm="သဘောတူညီချက်">
        <p>Cherry Directory ကို သုံးစွဲသောအခါ ဤ စည်းမျဉ်းများကို သဘောတူကြောင်း မှတ်ယူပါသည်။</p>
      </Section>

      <Section titleMm="ခွင့်ပြုသောသုံးစွဲမှု">
        <ul className="space-y-1.5 ml-2">
          {[
            'ဒေသတွင်း လုပ်ငန်းများ ရှာဖွေကြည့်ရှုခြင်း',
            'လုပ်ငန်း တင်ပြခြင်းနှင့် Review မှန်မှန်ကန်ကန် ရေးသားခြင်း',
            'ရပ်ရွာအတွက် အကျိုးရှိသော စကားများ မျှဝေခြင်း',
            'မှန်ကန်သော ဈေးနှုန်း တင်ပြခြင်း',
          ].map((item, i) => <li key={i} className="flex items-start gap-2 text-white/55"><span className="text-green-400 flex-shrink-0 mt-0.5">✓</span><span>{item}</span></li>)}
        </ul>
      </Section>

      <Section titleMm="တားမြစ်သောသုံးစွဲမှု">
        <ul className="space-y-1.5 ml-2">
          {[
            'မမှန်ကန်သော အချက်အလက်များ တင်ပြခြင်း',
            'တစ်ပါးသူ လုပ်ငန်းကို ခွင့်မပြုဘဲ ပိုင်ဆိုင်ကြောင်း တောင်းဆိုခြင်း',
            'စာအမှိုက်များ တင်ခြင်း၊ အတု Review များ ရေးသားခြင်း',
            'အခြားသုံးစွဲသူများကို နှောင့်ယှက်ခြင်း၊ စော်ကားခြင်း',
            'သူများ၏ မူပိုင် (စာသား၊ ပုံ၊ သီချင်း) များကို ခွင့်မပြုဘဲ တင်ခြင်း',
            'App ၏ Security ကို ဖောက်ထွင်းကြိုးစားခြင်း',
          ].map((item, i) => <li key={i} className="flex items-start gap-2 text-white/55"><span className="text-red-400 flex-shrink-0 mt-0.5">✗</span><span>{item}</span></li>)}
        </ul>
      </Section>

      <Section titleMm="Content Ownership">
        <p>သင် တင်ပြသော လုပ်ငန်းအချက်အလက်၊ Review နှင့် ပုံများ၏ ပိုင်ဆိုင်မှုသည် သင်၌သာ ရှိပါသည်။ Cherry Directory သည် ၎င်းတို့ကို App တွင် ပြသခွင့်သာ ရရှိပါသည်။</p>
      </Section>

      <Section titleMm="Community Data">
        <p>ဈေးနှုန်း Report များသည် Community မှ တင်ပြသော အချက်အလက်များ ဖြစ်ပြီး တိကျမှုကို 100% အာမမခံနိုင်ပါ။ ဤ အချက်အလက်များကို ကိုးကားရုံသာ သုံးပြီး အရေးကြီးသော ဆုံးဖြတ်ချက်များအတွက် ကိုယ်တိုင် စစ်ဆေးပြီးမှ သုံးရန် တိုက်တွန်းပါသည်။</p>
      </Section>

      <Section titleMm="Moderation">
        <p>Admin နှင့် စီမံခန့်ခွဲသူတို့သည် ရပ်ရွာ စည်းကမ်းကို ထိန်းသိမ်းရန် မသင့်တော်သော အကြောင်းအရာများကို ဖယ်ရှားခွင့် ရှိပါသည်။</p>
      </Section>

      <Section titleMm="တာဝန်ကန့်သတ်ချက်">
        <p>Cherry Directory သည် Community တင်ပြသော Data ၏ တိကျမှု၊ လုပ်ငန်းပေးသော ဝန်ဆောင်မှုအရည်အသွေး၊ Review မှန်ကန်မှု တို့အတွက် တာဝန်မယူပါ။</p>
      </Section>
    </InfoLayout>
  )
}

// ── How to Use ─────────────────────────────────────────────────
export function HelpPage() {
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'သုံးစွဲနည်း' : 'How to Use' })
  const [query, setQuery] = useState('')

  const sections = [
    {
      icon: '👤',
      titleMm: 'ဧည့်သည် နဲ့ Account ဘာကွာလဲ',
      steps: [
        'ဧည့်သည် (Login မလိုဘူး) — လုပ်ငန်းရှာဖွေ + ဖုန်းဆက်၊ ဈေးနှုန်း ကြည့်/တင်၊ လုပ်ငန်းတင် (Admin စစ်ပြီးမှ ပေါ်)၊ Chat (နာမည်ပေးပြီး ပြော)၊ ဆီဆိုင် လမ်းညွှန်၊ သတင်း/ပွဲ ကြည့်',
        'Account ရှိရင် (အပေါ်က အားလုံး +) — Review ရေး + အဆင့်သတ်မှတ်၊ သိမ်းဆည်း (Saved)၊ အမှတ် + အမှတ်စာရင်း၊ ပွဲတက်ရန် စာရင်းပေးခြင်း',
        'Account လုပ်ရန် — "Login" ကို နှိပ်ပြီး Google သို့မဟုတ် Email ဖြင့် ဝင်ပါ (အခမဲ့)',
      ],
    },
    {
      icon: '🔍',
      titleMm: 'လုပ်ငန်းရှာဖွေနည်း',
      steps: [
        'Bottom navigation မှ "ရှာဖွေ" icon ကို နှိပ်ပါ',
        'Search box ထဲ လုပ်ငန်းအမည် ရိုက်ထည့်ပါ',
        'Category, မြို့ နှင့် "Verified" filter ကို သုံး၍ ကျဉ်းမြောင်းနိုင်သည်',
        'Listing ကို နှိပ်ပြီး phone/viber/telegram ဖြင့် တိုက်ရိုက် ဆက်သွယ်နိုင်သည်',
      ],
    },
    {
      icon: '🏢',
      titleMm: 'လုပ်ငန်းထည့်နည်း',
      steps: [
        'ညာဘက်အောက် + Button ကို နှိပ်ပါ (Login မလိုဘူး — ဧည့်သည်လည်း တင်နိုင်သည်)',
        'လုပ်ငန်းအချက်အလက် (အမည်၊ ဖုန်း၊ လိပ်စာ) ဖြည့်ပြီး "တင်သွင်းမည်" ကို နှိပ်ပါ',
        'Admin မှ စစ်ဆေးပြီးနောက် Directory ထဲ ပေါ်လာမည်',
        'ဆိုင်ရှင် ဖြစ်ကြောင်း Verify လုပ်ရန် Listing page အောက်နားက "ဤဆိုင်ရဲ့ ပိုင်ရှင်လား?" တွင် "ပိုင်ဆိုင်ကြောင်း တောင်းဆိုမည်" ကို နှိပ်ပါ',
        'Login ဝင်ထားရင် ကိုယ့်တင်ပြမှုများကို Profile > "ကျွန်တော့်တင်ထားသောများ" တွင် ကြည့်နိုင်သည်',
      ],
    },
    {
      icon: '✏️',
      titleMm: 'မှားနေတဲ့ လုပ်ငန်းကို ပြင်နည်း',
      steps: [
        'တိုက်ရိုက် ပြင်ဖို့ Account လိုပါသည် — ပြီးတော့ ဆိုင်ရှင် ကိုယ်တိုင် (သို့မဟုတ် Admin/Moderator) ပဲ ပြင်နိုင်သည်',
        'ဆိုင်ရှင်ဆိုရင်: Login ဝင် → Listing မှာ "ပိုင်ဆိုင်ကြောင်း တောင်းဆိုမည်" ကို နှိပ် → Claim အတည်ပြုပြီးရင် Edit လုပ်နိုင်သည်',
        'Account မရှိလည်း တိုင်ကြားနိုင်သည်: Listing မှာ "ဤလုပ်ငန်းကို တိုင်ကြားမည်" ကို နှိပ် → မှားနေတဲ့ အချက်ကို ရေး → Admin က စစ်ပြီး ပြင်ပေးမည်',
        'တခြားသူ့ဆိုင်ကို တိုက်ရိုက် ပြင်လို့မရပါ — Report ပဲ လုပ်နိုင်သည်',
      ],
    },
    {
      icon: '📅',
      titleMm: 'Event Calendar သုံးနည်း',
      steps: [
        'Bottom navigation မှ Home ၏ ညာဘက်ရှိ "ပြက္ခဒိန်" icon ကို နှိပ်ပါ',
        'ပြက္ခဒိန်ထဲ Event ရှိသော နေ့ တွင် Purple dot ပြနေမည်',
        'Date ကို နှိပ်ရင် ထိုနေ့ Event list ကျဆင်းမည်',
        '"ပါဝင်မည်" သို့မဟုတ် "စိတ်ဝင်စားသည်" ကို နှိပ်ပါ',
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
      icon: '🏆',
      titleMm: 'အမှတ် ရရှိနည်း',
      steps: [
        'Review ရေးသားပါ (+5 အမှတ်)',
        'လုပ်ငန်း တင်ပြီး အတည်ပြုခံရပါသည် (+10/+20 အမှတ်)',
        'ပွဲတက်ရန် စာရင်းပေးပါ (+2 အမှတ်)',
        'Chat Message ပို့ပါ (+1 အမှတ်, တစ်နေ့ အများဆုံး ၁၀ အမှတ်)',
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
      icon: '⛽',
      titleMm: 'ဆီဆိုင် လမ်းညွှန်',
      steps: [
        'Community > "ဓာတ်ဆီဆိုင်များ" ကို ဖွင့်ပါ',
        'ဆိုင်အမည်၊ လိပ်စာ၊ ဖုန်း၊ ဖွင့်ချိန်တို့ကို ကြည့်နိုင်သည်',
        'လက်ရှိ ဆီရှိမရှိ live မပြပါ — လိုအပ်ရင် ဆိုင်ကို တိုက်ရိုက်ဆက်သွယ်ပါ',
      ],
    },
    {
      icon: '💬',
      titleMm: 'Chat သုံးနည်း',
      steps: [
        'Community > "Public Chat" ကို ဖွင့်ပါ',
        'Login မလိုဘူး — နာမည်ပေးပြီး စာပို့နိုင်သည်',
        'အသစ်စာများ အလိုလို ပေါ်လာမည်',
      ],
    },
    {
      icon: '🔎',
      titleMm: 'ပျောက်ဆုံး ပစ္စည်း',
      steps: [
        'Community > "ပျောက်ဆုံးပစ္စည်း" ကို ဖွင့်ပါ',
        'ပျောက်တာ/တွေ့တာကို Login မလိုဘဲ တင်နိုင်သည် (နာမည်နှင့် ဖုန်း ထည့်ပါ)',
        'ပုံ ၃ ပုံအထိ တွဲနိုင်သည်',
      ],
    },
    {
      icon: '💼',
      titleMm: 'အလုပ် / အိမ်ငှား / ကျူရှင်',
      steps: [
        'Community မှ "အလုပ်ကြော်ငြာ" / "အိမ်/အခန်း ငှားရမ်း" / "ဆရာ/ကျောင်းသား" ကို ဖွင့်ပါ',
        'ကြော်ငြာများကို Login မလိုဘဲ ကြည့်နိုင်သည်',
        'ကြော်ငြာ တင်ရန် နှင့် ပိုင်ရှင်ဖုန်း ခေါ်ရန် Login ဝင်ရမည်',
      ],
    },
    {
      icon: '🆘',
      titleMm: 'အရေးပေါ် ဆက်သွယ်ရန်',
      steps: [
        'Home မှ "🆘 အရေးပေါ်" ခလုတ် (သို့) Community > "အရေးပေါ် ဆက်သွယ်ရေး" ကို နှိပ်ပါ',
        'ဆေးရုံ၊ ရဲ၊ မီးသတ် ဖုန်းနံပါတ်များ တိုက်ရိုက်ခေါ်နိုင်သည်',
        'Login မလိုဘူး',
      ],
    },
    {
      icon: '📱',
      titleMm: 'App ကို Phone ထဲ ထည့်နည်း',
      steps: [
        'Home စာမျက်နှာ အောက်နားရှိ 📲 "App ထည့်မည်" ခလုတ်ကို နှိပ်ပါ (ဖုန်းက install လုပ်လို့ရမှသာ ပေါ်ပါသည်)',
        'ခလုတ် မပေါ်ရင် browser menu → "Add to Home Screen" ကို ရွေးချယ်ပါ',
        'Internet မရှိလည်း Cache ဒေတာ ကြည့်ရှုနိုင်သည်',
        'အသိပေးချက် မရသေးပါ — နောက်ထပ် version တွင် ရနိုင်မည်',
      ],
    },
  ]

  // H12: filter help sections by the search box (title + steps).
  const q = query.trim().toLowerCase()
  const filteredSections = q
    ? sections.filter(sec =>
        sec.titleMm.toLowerCase().includes(q) ||
        sec.steps.some(step => step.toLowerCase().includes(q)))
    : sections

  return (
    <InfoLayout title="How to Use" titleMm="သုံးစွဲနည်းလမ်းညွှန်">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="အကူအညီ ရှာမယ်... (ဥပမာ လုပ်ငန်း၊ ဈေးနှုန်း)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="input-dark pl-8 w-full"
        />
      </div>
      {filteredSections.length === 0 ? (
        <p className="text-sm text-white/60 text-center py-8 font-myanmar">"{query}" နှင့် ကိုက်ညီသော အကူအညီ မတွေ့ပါ</p>
      ) : filteredSections.map((sec, si) => (
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