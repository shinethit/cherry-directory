import { useEffect, useRef, useState } from 'react'

export function useServiceWorker() {
  const [ready, setReady] = useState(false)
  const [swState, setSwState] = useState('initializing')
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const waitingRef = useRef(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setSwState('unsupported')
      return
    }

    // Only register in production or if explicitly enabled
    // (Vite dev server + SW often conflict)
    const isDev = import.meta.env.MODE === 'development'
    const shouldRegister = !isDev || localStorage.getItem('enable_sw_dev') === 'true'

    if (!shouldRegister) {
      setSwState('skipped-dev')
      console.log('[SW] Skipped in development (set localStorage.enable_sw_dev=true to enable)')
      return
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        setSwState('registered')
        setReady(true)
        console.log('[SW] Registered, scope:', reg.scope)

        reg.onupdatefound = () => {
          const installing = reg.installing
          if (!installing) return
          installing.onstatechange = () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW] New version available — refresh to update')
              waitingRef.current = installing
              setUpdateAvailable(true)
            }
          }
        }
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err.message)
        setSwState('failed')
      })
  }, [])

  // Tell the waiting worker to activate, then reload once it takes over.
  // (sw.js only skipWaits on this message — never on install.)
  async function applyUpdate() {
    const onControllerChange = () => window.location.reload()
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true })
    const reg = await navigator.serviceWorker.getRegistration()
    const waiting = waitingRef.current || reg?.waiting
    if (waiting) waiting.postMessage('SKIP_WAITING')
    else window.location.reload()
  }

  return { ready, swState, updateAvailable, applyUpdate }
}
