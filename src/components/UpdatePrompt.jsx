import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useServiceWorker } from '../hooks/useServiceWorker'
import { safeGet, safeSet } from '../lib/safeStorage'
import { APP_VERSION } from '../lib/appVersion'
import { isServerVersionNewer } from '../lib/versionCompare'
import { setUpdateToastVisible } from '../lib/floatingBanners'
import { isLongTaskRunning } from '../lib/longTask'

// Shows a real update prompt when the service worker reports a new version
// waiting (useServiceWorker detects it via onupdatefound, an already-waiting
// worker, or periodic reg.update() polling). Tapping reloads through
// SKIP_WAITING — the SW never activates on its own. While the update is in
// flight the button is disabled with an "updating…" label (H-6).
//
// v9.14 (F-1): the toast is dismissible, sits above the floating-button
// band, and always wins over the install banner/pill (it publishes its
// visibility via floatingBanners.js).
// v9.22: the 10 s auto-hide is REMOVED — the toast used to vanish before
// the user could tap it, leaving no in-app way to apply a waiting
// update. It now stays until dismissed (X, per-version persistent) or
// applied.
//
// NOTE on the dismiss key: the waiting worker's own version string is
// NOT exposed to the page — useServiceWorker only reports
// updateAvailable (boolean), and sw.js carries no app-version channel —
// so the key is keyed on the RUNNING version (APP_VERSION). Each pending
// update is seen while running exactly one version, so dismissing
// suppresses that update's prompt; once the user actually updates,
// APP_VERSION changes and a future update's prompt is unaffected.
//
// v9.27: Cancel didn't stick. Two causes fixed here — (M1) a dismissal
// in one tab never reached another tab (no `storage` listener anywhere),
// so switching to a tab mounted before the dismissal re-showed the
// prompt; (M2) the dismissal write was never verified, so a silent
// localStorage failure left it in-memory only and any reload re-showed
// it. The dismissal is now recorded as JSON { version, at }, verified
// by read-back (one retry, then a warn, in-memory dismissal kept), and
// synced across tabs via the `storage` event + a re-read on focus. A
// dismissal older than 24 h stops suppressing the prompt when the
// server is still newer, so a stale key can never hide an update
// forever. The old bare-'1' value is still honoured (unknown time:
// never expires via the backstop).
const DISMISSED_KEY = `cherry_update_dismissed_${APP_VERSION}`
const DISMISSAL_MAX_AGE_MS = 24 * 60 * 60 * 1000

// v9.27: parse a stored dismissal. Returns null when there is none;
// { at: <ms|null> } otherwise. The old bare '1' and any unparseable
// non-empty value count as a dismissal with unknown time.
function parseDismissal(raw) {
  if (raw == null) return null
  if (raw === '1') return { at: null }
  try {
    const obj = JSON.parse(raw)
    if (obj && typeof obj === 'object') {
      if (obj.version && obj.version !== APP_VERSION) return null
      return { at: typeof obj.at === 'number' ? obj.at : null }
    }
  } catch {
    // Unparseable value: treat as a dismissal rather than re-showing a
    // prompt the user already closed.
  }
  return { at: null }
}

// v9.27: is a stored dismissal still suppressing the prompt? A dismissal
// with a timestamp older than 24 h stops suppressing once the server is
// still newer. With no parseable timestamp (old '1') or no known server
// version, the dismissal stands.
function isDismissalActive(raw, serverVersion) {
  const d = parseDismissal(raw)
  if (!d) return false
  if (d.at == null) return true
  if (Date.now() - d.at <= DISMISSAL_MAX_AGE_MS) return true
  if (serverVersion && isServerVersionNewer(serverVersion, APP_VERSION)) return false
  return true
}

export default function UpdatePrompt() {
  const { updateAvailable, updating, applyUpdate, serverVersion } = useServiceWorker()
  const [dismissed, setDismissed] = useState(() => isDismissalActive(safeGet(DISMISSED_KEY), serverVersion))
  // v9.26: while a long task (e.g. a CSV import) is running, the
  // "ပြန်ဖွင့်မည်" button must not reload — a reload would wipe the
  // task's in-progress state. Polled every 1 s while the prompt is
  // visible; the click handler re-checks the flag as well.
  const [longTaskBusy, setLongTaskBusy] = useState(false)
  // v9.27: latest server version for the storage/focus handlers below
  // (a ref so the once-registered listeners never go stale).
  const serverVersionRef = useRef(serverVersion)
  useEffect(() => { serverVersionRef.current = serverVersion }, [serverVersion])

  // v9.27: the server version is only known once the hook's fetch lands;
  // re-evaluate the 24 h backstop then — an expired dismissal re-shows
  // the prompt when the server is still newer.
  useEffect(() => {
    if (!dismissed || !serverVersion) return
    if (!isDismissalActive(safeGet(DISMISSED_KEY), serverVersion)) setDismissed(false)
  }, [serverVersion, dismissed])

  // v9.27 (M1): cross-tab dismissal. A dismissal in another tab fires a
  // `storage` event here — adopt it at once instead of keeping this
  // instance's stale in-memory state. The focus re-read is belt-and-
  // braces (one localStorage read per focus) for any event missed while
  // the tab was in the background.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== DISMISSED_KEY) return
      const raw = e.newValue ?? safeGet(DISMISSED_KEY)
      if (raw == null) return
      if (isDismissalActive(raw, serverVersionRef.current)) setDismissed(true)
    }
    const onFocus = () => {
      setDismissed(isDismissalActive(safeGet(DISMISSED_KEY), serverVersionRef.current))
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // v9.27: only prompt when the server is actually newer — a rollback
  // (server older than running) must never prompt as an update. With no
  // server version known (e.g. the waiting-worker path), keep the
  // existing behaviour and prompt.
  const serverIsNewer = serverVersion == null || isServerVersionNewer(serverVersion, APP_VERSION)
  const shown = updateAvailable && !dismissed && serverIsNewer

  useEffect(() => {
    if (!shown) return
    const check = () => setLongTaskBusy(isLongTaskRunning())
    check()
    const t = setInterval(check, 1000)
    return () => clearInterval(t)
  }, [shown])

  // (d) Publish visibility so the install banner / pill can suppress
  // themselves — at most one floating banner at a time.
  useEffect(() => {
    setUpdateToastVisible(shown)
    return () => setUpdateToastVisible(false)
  }, [shown])

  // (a) Persistent per-version dismissal — this version's prompt never
  // shows again, on this device, even after a reload.
  function dismiss() {
    // v9.27 (M2): verify the write — safeSet swallows quota/security
    // failures, so a failed write used to leave the dismissal in-memory
    // only and any reload re-showed the prompt. Retry once, warn, and
    // still hide for the session either way.
    const payload = JSON.stringify({ version: APP_VERSION, at: Date.now() })
    const persisted = () => safeSet(DISMISSED_KEY, payload) && safeGet(DISMISSED_KEY) === payload
    if (!persisted() && !persisted()) {
      console.warn('[UpdatePrompt] Dismissal could not be saved; hiding for this session only')
    }
    setDismissed(true)
  }

  // v9.26: re-check the flag on click (the 1 s poll above can lag a
  // task that started a moment ago) — while busy, do nothing except
  // make sure the note shows.
  function handleApply() {
    if (isLongTaskRunning()) {
      setLongTaskBusy(true)
      return
    }
    applyUpdate()
  }

  if (!shown) return null

  return (
    <div className="fixed left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-[100]" style={{ bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 5rem)' }}>
      <div className="bg-[#1a0028]/95 backdrop-blur-md border border-brand-400/20 rounded-2xl p-3 shadow-xl shadow-black/40 flex items-center gap-3">
        <span className="text-2xl flex-shrink-0">🍒</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display font-bold text-white leading-tight">အသစ်ထွက်ပြီ</p>
          <p className="text-[10px] text-white/50 font-myanmar">{longTaskBusy ? 'လက်ရှိ လုပ်ငန်း ပြီးသွားမှ အပ်ဒိတ် အလိုအလျောက် ပြောင်းသွားမည်' : 'Version အသစ် ရနေပြီ — ပြန်ဖွင့်ပြီး အပ်ဒိတ်လုပ်မည်'}</p>
        </div>
        <button
          onClick={handleApply}
          disabled={updating || longTaskBusy}
          className="flex-shrink-0 px-3 py-2 bg-brand-600 rounded-xl text-white text-xs font-display font-semibold disabled:opacity-50"
        >
          {updating ? 'အပ်ဒိတ်လုပ်နေသည်…' : longTaskBusy ? 'စောင့်နေသည်…' : 'ပြန်ဖွင့်မည်'}
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
