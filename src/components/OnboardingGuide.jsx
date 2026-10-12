import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import { useLang } from '../contexts/LangContext'

const ONBOARDING_KEY = 'cherry_onboarding_done'

const STEPS = [
  {
    icon: '🍒',
    mm: {
      title: 'Cherry Directory မှ ကြိုဆိုပါတယ်',
      desc: 'တောင်ကြီးမြို့ရဲ့ ဒေသဆိုင်ရာ အချက်အလက်အားလုံး တစ်နေရာတည်းမှာ',
    },
    en: {
      title: 'Welcome to Cherry Directory',
      desc: 'All local info for Taunggyi in one place',
    },
  },
  {
    icon: '🔍',
    mm: {
      title: 'လုပ်ငန်းများ ရှာဖွေပါ',
      desc: 'Directory မှ စားသောက်ဆိုင်၊ ဆေးရုံ၊ ကျောင်း စသည် ရှာနိုင်သည်',
    },
    en: {
      title: 'Find Businesses',
      desc: 'Browse restaurants, hospitals, schools and more',
    },
  },
  {
    icon: '🏘️',
    mm: {
      title: 'Community Features များ',
      desc: 'ဈေးနှုန်း၊ လျှပ်စစ်၊ ဓာတ်ဆီ၊ ရာသီဥတု စတဲ့ သတင်းအချက်အလက်များ',
    },
    en: {
      title: 'Community Features',
      desc: 'Prices, power, fuel, weather and more — reported by community',
    },
  },
  {
    icon: '🏆',
    mm: {
      title: 'Points ရယူပါ',
      desc: 'Review ရေး၊ Listing တင်၊ Chat လုပ်ပြီး Points ရယူပြီး Leaderboard မှာ ပါဝင်ပါ',
    },
    en: {
      title: 'Earn Points',
      desc: 'Write reviews, submit listings, chat — earn points & climb leaderboard',
    },
  },
  {
    icon: '📱',
    mm: {
      title: 'App အနေနဲ့ ထည့်ပါ',
      desc: 'Home Screen မှာ ထည့်ပြီး Notification ဖွင့်ပါ',
    },
    en: {
      title: 'Install as App',
      desc: 'Add to home screen and enable notifications',
    },
  },
]

export default function OnboardingGuide() {
  const { lang } = useLang()
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    // Check if onboarding already shown
    if (localStorage.getItem(ONBOARDING_KEY)) return
    // Show after 1.5 sec (after splash)
    const t = setTimeout(() => setShow(true), 1500)
    return () => clearTimeout(t)
  }, [])

  function finish() {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShow(false)
  }

  function skip() {
    finish()
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1)
    else finish()
  }

  function prev() {
    if (step > 0) setStep(step - 1)
  }

  if (!show) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const text = lang === 'mm' ? current.mm : current.en

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 backdrop-blur-md p-6"
      onClick={skip}
    >
      <div
        className="w-full max-w-md bg-gradient-to-br from-[#1a0030] to-[#0d0015] border border-brand-400/30 rounded-3xl p-6 space-y-5 shadow-2xl shadow-brand-900/50"
        onClick={e => e.stopPropagation()}
      >
        {/* Skip button */}
        <div className="flex justify-end">
          <button
            onClick={skip}
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
          >
            {lang === 'mm' ? 'ကျော်မည်' : 'Skip'} <X size={12} />
          </button>
        </div>

        {/* Icon + Content */}
        <div className="text-center space-y-3">
          <div className="text-6xl animate-bounce" style={{ animationDuration: '2s' }}>
            {current.icon}
          </div>
          <div className="flex items-center justify-center gap-1 text-gold-400 text-[10px] font-display font-bold uppercase tracking-wider">
            <Sparkles size={11} />
            {lang === 'mm' ? 'အသစ်စတင်' : 'Getting Started'}
          </div>
          <h2 className="font-display font-bold text-xl text-white leading-snug">
            {text.title}
          </h2>
          <p className="text-sm text-white/60 font-myanmar leading-relaxed">
            {text.desc}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all ${i === step ? 'w-6 h-1.5 bg-brand-500' : 'w-1.5 h-1.5 bg-white/20'}`}
            />
          ))}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={prev}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-white/8 border border-white/15 text-white/70 text-sm font-semibold hover:bg-white/12 transition-colors"
            >
              <ChevronLeft size={14} />
              {lang === 'mm' ? 'နောက်' : 'Back'}
            </button>
          )}
          <button
            onClick={next}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 text-white text-sm font-display font-bold hover:opacity-90 transition-opacity"
          >
            {isLast
              ? (lang === 'mm' ? 'စတင်လိုက်ရအောင် 🚀' : 'Get Started 🚀')
              : (lang === 'mm' ? 'ရှေ့ဆက်' : 'Next')
            }
            {!isLast && <ChevronRight size={14} />}
          </button>
        </div>

        {/* Step counter */}
        <p className="text-[9px] text-white/25 text-center font-mono">
          {step + 1} / {STEPS.length}
        </p>
      </div>
    </div>
  )
}
