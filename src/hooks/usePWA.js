import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)))
}

export function usePWA() {
  const [swReady, setSwReady] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [installable, setInstallable] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        setSwReady(true)
        // Check existing push subscription
        reg.pushManager.getSubscription().then(sub => setPushEnabled(!!sub))
      }).catch(err => console.warn('SW registration failed:', err))
    }

    // PWA install prompt
    const handler = e => { e.preventDefault(); setInstallable(true); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function enablePush(userId) {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
      // Save subscription to Supabase
      await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))),
        auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))),
      })
      setPushEnabled(true)
      return true
    } catch (err) {
      console.warn('Push subscription failed:', err)
      return false
    }
  }

  async function disablePush() {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    }
    setPushEnabled(false)
  }

  async function installApp() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstallable(false)
    setDeferredPrompt(null)
  }

  return { swReady, pushEnabled, installable, enablePush, disablePush, installApp }
}

// Send notification via Telegram Bot (server-side via Supabase Edge Function)
export async function notifyTelegram({ title, body, url, chatId }) {
  try {
    await supabase.functions.invoke('telegram-notify', {
      body: { title, body, url, chat_id: chatId },
    })
  } catch (err) {
    console.warn('Telegram notify failed:', err)
  }
}
