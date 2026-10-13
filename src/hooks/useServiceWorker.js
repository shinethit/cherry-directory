import { useEffect, useState } from 'react'

export function useServiceWorker() {
  const [ready, setReady] = useState(false)
  const [swState, setSwState] = useState('initializing')

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
            }
          }
        }
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err.message)
        setSwState('failed')
      })
  }, [])

  return { ready, swState }
}
