import { useState, useEffect, useRef } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import { useLang } from '../contexts/LangContext'
import { yangonToday } from '../lib/myanmarDate'
import { safeGet, safeSet } from '../lib/safeStorage'

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
      desc: 'ဈေးနှုန်း၊ ဓာတ်ဆီ စတဲ့ သတင်းအချက်အလက်များ',
    },
    en: {
      title: 'Community Features',
      desc: 'Prices, fuel and more — reported by community',
    },
  },
  {
    icon: '🏆',
    mm: {
      title: 'အမှတ် ရယူပါ',
      desc: 'Review ရေး၊ Listing တင်၊ Chat လုပ်ပြီး အမှတ် ရယူပြီး Leaderboard မှာ ပါဝင်ပါ',
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

  const startedRef = useRef(false)

  useEffect(() => {
    // Check if onboarding already shown (safe storage — never throws, H-2)
    if (safeGet(ONBOARDING_KEY)) return
    // Sequential first-launch flow: wait for the splash screen to be
    // dismissed ('cherry:splash-done') before the 1.5s timer — or proceed
    // at once if consent was already given today (no splash this launch).
    let t
    let fallback
    const start = () => {
      if (startedRef.current) return
      startedRef.current = true
      if (fallback) clearTimeout(fallback)
      t = setTimeout(() => setShow(true), 1500)
    }
    if (safeGet('cherry_consent_date') === yangonToday()) {
      start()
      return () => clearTimeout(t)
    }
    const onSplashDone = () => start()
    window.addEventListener('cherry:splash-done', onSplashDone)
    // A-F5 fallback: the chain is event-only, so a deep link that never
    // mounts the splash would wait forever. One-shot 8 s fallback timer
    // starts the guide anyway (it checks consent state again at that point
    // via the stored date — if consent still isn't given, the splash is
    // showing instead and this guide stays hidden behind it).
    fallback = setTimeout(() => {
      if (safeGet('cherry_consent_date') === yangonToday()) start()
    }, 8000)
    return () => {
      window.removeEventListener('cherry:splash-done', onSplashDone)
      clearTimeout(t)
      clearTimeout(fallback)
    }
  }, [])

  function finish() {
    safeSet(ONBOARDING_KEY, '1')
    setShow(false)
    window.dispatchEvent(new Event('cherry:onboarding-done'))
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
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 backdrop-blur-md p-6 pt-safe"
    >
      <div
        className="w-full max-w-md bg-gradient-to-br from-[#1a0030] to-[#0d0015] border border-brand-400/30 rounded-3xl p-6 space-y-5 shadow-2xl shadow-brand-900/50"
        onClick={e => e.stopPropagation()}
      >
        {/* Skip button */}
        <div className="flex justify-end">
          <button
            onClick={skip}
            className="flex items-center gap-1 text-xs px-3 py-2 min-h-[36px] text-white/60 hover:text-white/80 transition-colors"
            aria-label={lang === 'mm' ? 'ကျော်မည်' : 'Skip'}
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

        {/* Progress dots — tappable to jump to a step */}
        <div className="flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={lang === 'mm' ? `အဆင့် ${i + 1}` : `Step ${i + 1}`}
              className="flex items-center justify-center min-w-[24px] min-h-[24px] p-1"
            >
              <span
                className={`block rounded-full transition-all ${i === step ? 'w-6 h-1.5 bg-brand-500' : 'w-1.5 h-1.5 bg-white/20'}`}
              />
            </button>
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
              {lang === 'mm' ? 'ပြန်သွားမည်' : 'Back'}
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
        <p className="text-[10px] text-white/50 text-center font-mono">
          {step + 1} / {STEPS.length}
        </p>
      </div>
    </div>
  )
}
