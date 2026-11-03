import { useEffect, useRef, useState } from 'react'
import { safeGet } from '../lib/safeStorage'

// Single registration point for the service worker (C-L1 — the duplicate
// registration in main.jsx was removed in v9.3).
// v9.3 (H-6): a worker downloaded in the background used to never surface
// the update prompt (only onupdatefound was watched), and applyUpdate()
// could reload-loop with no feedback. Now we check reg.waiting /
// reg.installing right after registration, poll reg.update() every 60 min
// and on focus/visibilitychange, and applyUpdate() has a 4 s timeout
// fallback reload, an "updating…" state, and a once-per-session guard on
// the no-waiting reload path.

const UPDATE_POLL_MS = 60 * 60 * 1000
const APPLY_TIMEOUT_MS = 4000
const NO_WAITING_RELOAD_KEY = 'cherry_sw_no_waiting_reload'

export function useServiceWorker() {
  const [ready, setReady] = useState(false)
  const [swState, setSwState] = useState('initializing')
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updating, setUpdating] = useState(false)
  const waitingRef = useRef(null)
  const updatingRef = useRef(false)

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

    const pollForUpdate = () => {
      if (!regRef) return
      regRef.update().catch((err) => console.warn('[SW] Update check failed:', err?.message))
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        regRef = reg
        setSwState('registered')
        setReady(true)
        console.log('[SW] Registered, scope:', reg.scope)

        checkWaiting(reg)

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

  // Tell the waiting worker to activate, then reload once it takes over.
  // (sw.js only skipWaits on this message — never on install.)
  async function applyUpdate() {
    if (updatingRef.current) return
    updatingRef.current = true
    setUpdating(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
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

  return { ready, swState, updateAvailable, updating, applyUpdate }
}
