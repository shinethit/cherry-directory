import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'

const DISMISSED_KEY = 'cherry_install_dismissed'

export default function PWAInstallBanner() {
  const [show, setShow]         = useState(false)
  const [prompt, setPrompt]     = useState(null)
  const [installing, setInstalling] = useState(false)
  const [isIOS, setIsIOS]       = useState(false)
  const [isIOSGuide, setIsIOSGuide] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (window.navigator.standalone === true) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
    if (ios) {
      setIsIOS(true)
      const t = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(t)
    }

    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      setTimeout(() => setShow(true), 2000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    setShow(false)
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  async function install() {
    if (isIOS) { setIsIOSGuide(true); return }
    if (!prompt) return
    setInstalling(true)
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') { setShow(false); localStorage.setItem(DISMISSED_KEY, '1') }
    } catch (err) { console.warn('Install failed:', err) }
    setInstalling(false)
  }

  if (!show) return null

  if (isIOSGuide) return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsIOSGuide(false)}>
      <div className="w-full max-w-sm bg-[#1a0028] border border-white/15 rounded-3xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <img src="/icons/icon-96.png" alt="Cherry Directory" className="w-12 h-12 rounded-2xl" />
          <div>
            <p className="font-display font-bold text-white text-sm">Cherry Directory Install</p>
            <p className="text-[11px] text-white/50">iPhone / iPad</p>
          </div>
          <button onClick={() => { setIsIOSGuide(false); dismiss() }} className="ml-auto w-7 h-7 flex items-center justify-center bg-white/8 rounded-full">
            <X size={14} className="text-white/60" />
          </button>
        </div>
        <div className="space-y-2">
          {[
            { step: '1', text: 'Safari မှာ Share button (⎙) နှိပ်ပါ' },
            { step: '2', text: '"Add to Home Screen" ရွေးပါ' },
            { step: '3', text: '"Add" နှိပ်ပြီး Install လုပ်ပါ' },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-600/60 border border-brand-400/30 flex items-center justify-center text-[10px] font-bold text-brand-300 flex-shrink-0">{step}</span>
              <p className="text-xs text-white/70 font-myanmar">{text}</p>
            </div>
          ))}
        </div>
        <button onClick={() => { setIsIOSGuide(false); dismiss() }} className="w-full py-2.5 rounded-2xl bg-brand-600/40 border border-brand-400/30 text-brand-200 text-sm font-display font-semibold">
          နားလည်ပြီ
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-[100]">
      <div className="bg-[#1a0028]/95 backdrop-blur-md border border-brand-400/20 rounded-2xl p-3 shadow-xl shadow-black/40 flex items-center gap-3">
        <img src="/icons/icon-96.png" alt="" className="w-11 h-11 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display font-bold text-white leading-tight">Cherry Directory</p>
          <p className="text-[10px] text-white/50 font-myanmar">App အနေနဲ့ Install လုပ်မယ်</p>
        </div>
        <button onClick={install} disabled={installing} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-brand-600 rounded-xl text-white text-xs font-display font-semibold">
          <Download size={13} />
          {installing ? '...' : 'Install'}
        </button>
        <button onClick={dismiss} className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-white/8 rounded-full">
          <X size={13} className="text-white/50" />
        </button>
      </div>
    </div>
  )
}
