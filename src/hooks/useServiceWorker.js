import { useEffect, useRef, useState } from 'react'
import { safeGet } from '../lib/safeStorage'
import { APP_VERSION } from '../lib/appVersion'
import { isServerVersionNewer } from '../lib/versionCompare'
import { isLongTaskRunning } from '../lib/longTask'

// Single registration point for the service worker (C-L1 — the duplicate
// registration in main.jsx was removed in v9.3).
// v9.3 (H-6): a worker downloaded in the background used to never surface
// the update prompt (only onupdatefound was watched), and applyUpdate()
// could reload-loop with no feedback. Now we check reg.waiting /
// reg.installing right after registration, poll reg.update() every 60 min
// and on focus/visibilitychange, and applyUpdate() has a 4 s timeout
// fallback reload, an "updating…" state, and a once-per-session guard on
// the no-waiting reload path.
// v9.22: detection no longer depends on sw.js bytes — CACHE_VERSION went
// v11 → v12 in 9.18 and never changed again, so 9.19–9.21 shipped a
// byte-identical sw.js and the prompt could never fire. Now the app asks
// the server for its version (/version.json, SW-bypassed) on the same
// cadence; on a mismatch the prompt means "the server has a newer
// version", whether or not a waiting worker downloaded.

// v9.27: checkServerVersion only prompts when the server version is
// numerically newer (a rollback never prompts); focus/visibility checks
// are throttled to one per 5 min; the hook exposes serverVersion so
// UpdatePrompt can apply the same newer-check and the 24 h dismissal
// backstop.
const UPDATE_POLL_MS = 60 * 60 * 1000
const APPLY_TIMEOUT_MS = 4000
const NO_WAITING_RELOAD_KEY = 'cherry_sw_no_waiting_reload'
// v9.22: how long to wait for a waiting worker after reg.update() when
// the server version is newer, and how long a bounded reg.update() may
// take inside reloadForUpdate().
const VERSION_WAIT_MS = 20000
const VERSION_WAIT_STEP_MS = 1000
const REG_UPDATE_TIMEOUT_MS = 5000
// v9.26: how often a deferred update reload re-checks whether the long
// task that blocked it has finished.
const LONG_TASK_POLL_MS = 5000
// v9.27: focus/visibility checks fire at most once per 5 min — every
// app-switch used to fire a /version.json fetch (in addition to the
// in-flight versionCheckRef guard). Detection semantics unchanged.
const FOCUS_CHECK_MIN_MS = 5 * 60 * 1000

export function useServiceWorker() {
  const [ready, setReady] = useState(false)
  const [swState, setSwState] = useState('initializing')
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updating, setUpdating] = useState(false)
  // v9.39: the new version's full change log from /version.json
  // (changesMy/changesEn) — STATE, not just a ref, so UpdatePrompt
  // re-renders when it lands. Kept in a ref too, so the change check
  // below can compare without re-rendering on every poll.
  const [serverChanges, setServerChanges] = useState(null)
  const serverChangesRef = useRef(null)
  const waitingRef = useRef(null)
  const updatingRef = useRef(false)
  const serverVersionRef = useRef(null)
  const versionCheckRef = useRef(false)
  // v9.27: last time a focus/visibility check ran (throttle, see below).
  const lastFocusCheckRef = useRef(0)
  // v9.26: timer for a reload deferred while a long task runs.
  const deferTimerRef = useRef(null)

  // v9.26: schedule a deferred reload — poll every 5 s until no long
  // task is running, then run `action` once. A pending deferral is
  // never duplicated (a second call while one is pending is a no-op)
  // and never lost: the update stays pending (updateAvailable stays
  // true) until the reload actually happens. If the tab closes first,
  // the update simply applies on the next visit.
  function deferReload(action) {
    if (deferTimerRef.current) return
    deferTimerRef.current = setInterval(() => {
      if (isLongTaskRunning()) return
      clearInterval(deferTimerRef.current)
      deferTimerRef.current = null
      action()
    }, LONG_TASK_POLL_MS)
  }

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setSwState('unsupported')
      return
    }

    // Only register in production or if explicitly enabled
    // (Vite dev server + SW often conflict)
    const isDev = import.meta.env.MODE === 'development'
    const shouldRegister = !isDev || safeGet('enable_sw_dev') === 'true'

    if (!shouldRegister) {
      setSwState('skipped-dev')
      console.log('[SW] Skipped in development (set localStorage.enable_sw_dev=true to enable)')
      return
    }

    let regRef = null
    let pollTimer = null

    const watchInstalling = (installing) => {
      if (!installing) return
      installing.onstatechange = () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[SW] New version available — refresh to update')
          waitingRef.current = installing
          setUpdateAvailable(true)
        }
      }
    }

    const checkWaiting = (reg) => {
      // Worker already downloaded in the background (e.g. by a previous
      // page load) — surface the prompt immediately instead of waiting
      // for the next onupdatefound.
      if (reg.waiting) {
        waitingRef.current = reg.waiting
        setUpdateAvailable(true)
      }
      if (reg.installing) watchInstalling(reg.installing)
    }

    // v9.22: ask the server which version is live and compare with the
    // running bundle. /version.json is bypassed by sw.js (network-only),
    // so the answer can never come from the old SW cache. On a mismatch:
    // nudge reg.update() and wait up to ~20 s for a waiting worker, then
    // show the prompt WHETHER OR NOT one appeared — the prompt now means
    // "the server has a newer version", and reloadForUpdate() reloads
    // through the network-first navigation even without a waiting worker.
    const checkServerVersion = async (reg) => {
      if (versionCheckRef.current) return
      versionCheckRef.current = true
      try {
        const res = await fetch('/version.json', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json().catch(() => null)
        const serverVersion = data?.version
        if (!serverVersion) return
        // v9.39: keep the server's change log (if it sent one) so the
        // update prompt can show the FULL new-version log, not one
        // generic line. Set before the newer-check below so the log is
        // kept even when the server is not newer (a rollback still
        // carries its own log for the modal). Only set state when the
        // log actually changed — the poll runs hourly / on focus.
        const nextChanges = (data?.changesMy || data?.changesEn)
          ? { changesMy: data.changesMy ?? null, changesEn: data.changesEn ?? null }
          : null
        if (JSON.stringify(nextChanges) !== JSON.stringify(serverChangesRef.current)) {
          serverChangesRef.current = nextChanges
          setServerChanges(nextChanges)
        }
        if (serverVersionRef.current === serverVersion) return
        serverVersionRef.current = serverVersion
        // v9.27: only a numerically NEWER server version prompts — a
        // rollback (server older than running) must never show as an
        // update. Unparseable versions fall back to exact inequality.
        // The ref is set before this check so UpdatePrompt can also
        // suppress a waiting-worker prompt after a rollback.
        if (!isServerVersionNewer(serverVersion, APP_VERSION)) return
        console.log('[SW] Server version', serverVersion, 'is newer than running', APP_VERSION)
        try {
          await reg.update()
        } catch (err) {
          console.warn('[SW] Update check failed:', err?.message)
        }
        const deadline = Date.now() + VERSION_WAIT_MS
        while (Date.now() < deadline) {
          if (reg.waiting) {
            waitingRef.current = reg.waiting
            break
          }
          await new Promise((r) => setTimeout(r, VERSION_WAIT_STEP_MS))
        }
        setUpdateAvailable(true)
      } catch (err) {
        // Offline / server unreachable: stay silent, retry next poll.
        console.warn('[SW] Version check failed:', err?.message)
      } finally {
        versionCheckRef.current = false
      }
    }

    const pollForUpdate = () => {
      if (!regRef) return
      regRef.update().catch((err) => console.warn('[SW] Update check failed:', err?.message))
      checkServerVersion(regRef)
    }

    // v9.27: throttle focus/visibility-triggered checks to at most one
    // per 5 min (the registration-time check above and the 60 min poll
    // are unaffected).
    const throttledFocusCheck = () => {
      const now = Date.now()
      if (now - lastFocusCheckRef.current < FOCUS_CHECK_MIN_MS) return
      lastFocusCheckRef.current = now
      pollForUpdate()
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        regRef = reg
        setSwState('registered')
        setReady(true)
        console.log('[SW] Registered, scope:', reg.scope)

        checkWaiting(reg)
        checkServerVersion(reg)

        reg.onupdatefound = () => watchInstalling(reg.installing)

        // Periodic + focus/visibility polling so a new build is noticed
        // without waiting for a full reload cycle.
        pollTimer = setInterval(pollForUpdate, UPDATE_POLL_MS)
        const onFocus = () => throttledFocusCheck()
        const onVisible = () => { if (!document.hidden) throttledFocusCheck() }
        window.addEventListener('focus', onFocus)
        document.addEventListener('visibilitychange', onVisible)
        // Keep the listeners alive for cleanup below.
        regRef._swListeners = { onFocus, onVisible }
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err.message)
        setSwState('failed')
      })

    return () => {
      if (pollTimer) clearInterval(pollTimer)
      if (deferTimerRef.current) clearInterval(deferTimerRef.current)
      if (regRef?._swListeners) {
        window.removeEventListener('focus', regRef._swListeners.onFocus)
        document.removeEventListener('visibilitychange', regRef._swListeners.onVisible)
      }
    }
  }, [])

  // v9.22 reloadForUpdate (exported as applyUpdate so UpdatePrompt's
  // import is unchanged): set updating FIRST so the button shows
  // "အပ်ဒိတ်လုပ်နေသည်…" during the wait, then a bounded reg.update()
  // (~5 s, best-effort). If a worker is waiting, SKIP_WAITING + wait for
  // controllerchange (4 s fallback reload). If none is waiting — the
  // common case while sw.js is unchanged — reload anyway: the
  // network-first navigation fetches the new bundle. The once-per-session
  // guard on the no-waiting branch stays, so an offline reload serving
  // the old cached shell cannot loop.
  // v9.26: every reload above is gated on isLongTaskRunning() — while a
  // long task (e.g. CSV import) runs, the reload is deferred (5 s poll,
  // then the reload path runs once) instead of wiping the task's state.
  async function reloadForUpdate() {
    if (updatingRef.current) return
    // v9.26: NEVER reload while a long task (e.g. a CSV import) is
    // running — the reload would wipe its in-progress state. Defer
    // instead: poll every 5 s and run the reload path once the task
    // finishes. Deliberately set nothing here (no updatingRef /
    // setUpdating): the deferred retry must be able to re-enter, and
    // the button must not spin "updating…" for the whole import.
    // Detection keeps running — only the reload is deferred.
    if (isLongTaskRunning()) {
      console.log('[SW] Long task running — deferring update reload')
      deferReload(reloadForUpdate)
      return
    }
    updatingRef.current = true
    setUpdating(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      // Bounded reg.update(): a hung update check must not leave the
      // button spinning — failure is non-fatal, the reload below still
      // fetches the new bundle through the network-first navigation.
      try {
        await Promise.race([
          reg?.update?.() ?? Promise.resolve(),
          new Promise((r) => setTimeout(r, REG_UPDATE_TIMEOUT_MS)),
        ])
      } catch {
        // Best-effort only.
      }
      const waiting = waitingRef.current || reg?.waiting
      if (!waiting) {
        // v9.26: the bounded reg.update() above can take seconds — a
        // long task may have started meanwhile. Check again before
        // reloading, and defer WITHOUT consuming the once-per-session
        // reload (the sessionStorage flag is only written below).
        if (isLongTaskRunning()) {
          console.log('[SW] Long task running — deferring update reload')
          deferReload(reloadForUpdate)
          return
        }
        // No worker waiting: reload once per session at most — an
        // unconditional reload here used to loop forever.
        let reloaded = false
        try {
          reloaded = window.sessionStorage.getItem(NO_WAITING_RELOAD_KEY) === '1'
          if (!reloaded) window.sessionStorage.setItem(NO_WAITING_RELOAD_KEY, '1')
        } catch {
          // sessionStorage unavailable — reload once anyway, the flag
          // simply can't persist.
        }
        if (!reloaded) window.location.reload()
        return
      }
      let reloaded = false
      const doReload = () => {
        if (reloaded) return
        // v9.26: the worker may take control (or the 4 s fallback may
        // fire) while a long task started after applyUpdate began.
        // Defer the reload itself — do NOT mark reloaded, so the
        // deferred call below still reloads once the task finishes.
        if (isLongTaskRunning()) {
          console.log('[SW] Long task running — deferring update reload')
          deferReload(doReload)
          return
        }
        reloaded = true
        window.location.reload()
      }
      navigator.serviceWorker.addEventListener('controllerchange', doReload, { once: true })
      waiting.postMessage('SKIP_WAITING')
      // Fallback: if the new worker never takes control, reload anyway
      // after 4 s instead of leaving the button spinning forever.
      setTimeout(() => {
        navigator.serviceWorker.removeEventListener('controllerchange', doReload)
        doReload()
      }, APPLY_TIMEOUT_MS)
    } catch (err) {
      console.warn('[SW] Apply update failed:', err)
      // v9.26: even the last-resort reload must not fire mid-task.
      if (isLongTaskRunning()) {
        deferReload(() => { try { window.location.reload() } catch { /* ignore */ } })
      } else {
        window.location.reload()
      }
    } finally {
      // updating stays true until the reload happens; reset only if we
      // are still on the page (no-waiting path when already reloaded).
      setTimeout(() => {
        updatingRef.current = false
        setUpdating(false)
      }, APPLY_TIMEOUT_MS + 500)
    }
  }

  return { ready, swState, updateAvailable, updating, serverVersion: serverVersionRef.current, serverChanges, applyUpdate: reloadForUpdate }
}
