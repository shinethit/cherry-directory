import { useServiceWorker } from '../hooks/useServiceWorker'

// Shows a real update prompt when the service worker reports a new version
// waiting (useServiceWorker detects it via onupdatefound). Tapping reloads
// through SKIP_WAITING — the SW never activates on its own.
export default function UpdatePrompt() {
  const { updateAvailable, applyUpdate } = useServiceWorker()

  if (!updateAvailable) return null

  return (
    <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-[100]">
      <div className="bg-[#1a0028]/95 backdrop-blur-md border border-brand-400/20 rounded-2xl p-3 shadow-xl shadow-black/40 flex items-center gap-3">
        <span className="text-2xl flex-shrink-0">🍒</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display font-bold text-white leading-tight">အသစ်ထွက်ပြီ</p>
          <p className="text-[10px] text-white/50 font-myanmar">Version အသစ် ရနေပြီ — ပြန်ဖွင့်ပြီး အပ်ဒိတ်လုပ်မည်</p>
        </div>
        <button
          onClick={applyUpdate}
          className="flex-shrink-0 px-3 py-2 bg-brand-600 rounded-xl text-white text-xs font-display font-semibold"
        >
          ပြန်ဖွင့်မည်
        </button>
      </div>
    </div>
  )
}
