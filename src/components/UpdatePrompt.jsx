import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useServiceWorker } from '../hooks/useServiceWorker'
import { safeGet, safeSet } from '../lib/safeStorage'
import { APP_VERSION } from '../lib/appVersion'
import { setUpdateToastVisible } from '../lib/floatingBanners'

// Shows a real update prompt when the service worker reports a new version
// waiting (useServiceWorker detects it via onupdatefound, an already-waiting
// worker, or periodic reg.update() polling). Tapping reloads through
// SKIP_WAITING — the SW never activates on its own. While the update is in
// flight the button is disabled with an "updating…" label (H-6).
//
// v9.14 (F-1): the toast is dismissible, sits above the floating-button
// band, auto-hides after ~10 s, and always wins over the install
// banner/pill (it publishes its visibility via floatingBanners.js).
//
// NOTE on the dismiss key: the waiting worker's own version string is
// NOT exposed to the page — useServiceWorker only reports
// updateAvailable (boolean), and sw.js carries no app-version channel —
// so the key is keyed on the RUNNING version (APP_VERSION). Each pending
// update is seen while running exactly one version, so dismissing
// suppresses that update's prompt; once the user actually updates,
// APP_VERSION changes and a future update's prompt is unaffected.
const DISMISSED_KEY = `cherry_update_dismissed_${APP_VERSION}`
const AUTO_HIDE_MS = 10_000

export default function UpdatePrompt() {
  const { updateAvailable, updating, applyUpdate } = useServiceWorker()
  const [dismissed, setDismissed] = useState(() => safeGet(DISMISSED_KEY) !== null)
  // Session-only hide (auto-hide): NOT recorded persistently, so a fresh
  // visit shows the prompt again. Reset when a NEW update arrives after
  // a previous one was auto-hidden.
  const [autoHidden, setAutoHidden] = useState(false)
  const prevAvailableRef = useRef(false)

  const shown = updateAvailable && !dismissed && !autoHidden

  useEffect(() => {
    if (updateAvailable && !prevAvailableRef.current) setAutoHidden(false)
    prevAvailableRef.current = updateAvailable
  }, [updateAvailable])

  // (d) Publish visibility so the install banner / pill can suppress
  // themselves — at most one floating banner at a time.
  useEffect(() => {
    setUpdateToastVisible(shown)
    return () => setUpdateToastVisible(false)
  }, [shown])

  // (c) Auto-hide after ~10 s as a session-only hide.
  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setAutoHidden(true), AUTO_HIDE_MS)
    return () => clearTimeout(t)
  }, [shown])

  // (a) Persistent per-version dismissal — this version's prompt never
  // shows again, on this device, even after a reload.
  function dismiss() {
    safeSet(DISMISSED_KEY, '1')
    setDismissed(true)
  }

  if (!shown) return null

  return (
    <div className="fixed left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-[100]" style={{ bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 5rem)' }}>
      <div className="bg-[#1a0028]/95 backdrop-blur-md border border-brand-400/20 rounded-2xl p-3 shadow-xl shadow-black/40 flex items-center gap-3">
        <span className="text-2xl flex-shrink-0">🍒</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display font-bold text-white leading-tight">အသစ်ထွက်ပြီ</p>
          <p className="text-[10px] text-white/50 font-myanmar">Version အသစ် ရနေပြီ — ပြန်ဖွင့်ပြီး အပ်ဒိတ်လုပ်မည်</p>
        </div>
        <button
          onClick={applyUpdate}
          disabled={updating}
          className="flex-shrink-0 px-3 py-2 bg-brand-600 rounded-xl text-white text-xs font-display font-semibold disabled:opacity-50"
        >
          {updating ? 'အပ်ဒိတ်လုပ်နေသည်…' : 'ပြန်ဖွင့်မည်'}
        </button>
        <button
          onClick={dismiss}
          aria-label="ပိတ်မည်"
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-white/8 rounded-full"
        >
          <X size={13} className="text-white/50" />
        </button>
      </div>
    </div>
  )
}
