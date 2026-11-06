import { useEffect, useRef, useState } from 'react'
import { safeGet } from '../lib/safeStorage'
import { APP_VERSION } from '../lib/appVersion'

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

const UPDATE_POLL_MS = 60 * 60 * 1000
const APPLY_TIMEOUT_MS = 4000
const NO_WAITING_RELOAD_KEY = 'cherry_sw_no_waiting_reload'
// v9.22: how long to wait for a waiting worker after reg.update() when
// the server version is newer, and how long a bounded reg.update() may
// take inside reloadForUpdate().
const VERSION_WAIT_MS = 20000
const VERSION_WAIT_STEP_MS = 1000
const REG_UPDATE_TIMEOUT_MS = 5000

export function useServiceWorker() {
  const [ready, setReady] = useState(false)
  const [swState, setSwState] = useState('initializing')
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updating, setUpdating] = useState(false)
  const waitingRef = useRef(null)
  const updatingRef = useRef(false)
  const serverVersionRef = useRef(null)
  const versionCheckRef = useRef(false)

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
        if (!serverVersion || serverVersion === APP_VERSION) return
        if (serverVersionRef.current === serverVersion) return
        serverVersionRef.current = serverVersion
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
        const onFocus = () => pollForUpdate()
        const onVisible = () => { if (!document.hidden) pollForUpdate() }
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
  async function reloadForUpdate() {
    if (updatingRef.current) return
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
      window.location.reload()
    } finally {
      // updating stays true until the reload happens; reset only if we
      // are still on the page (no-waiting path when already reloaded).
      setTimeout(() => {
        updatingRef.current = false
        setUpdating(false)
      }, APPLY_TIMEOUT_MS + 500)
    }
  }

  return { ready, swState, updateAvailable, updating, applyUpdate: reloadForUpdate }
}
