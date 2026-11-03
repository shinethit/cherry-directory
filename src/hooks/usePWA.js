import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { showInfo } from '../lib/toast'

export function usePWA() {
  const [swReady, setSwReady] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [installable, setInstallable] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    // NOTE: the service worker is registered once, in main.jsx. Do NOT
    // register it here again — the duplicate registration served no purpose.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        setSwReady(true)
        // Check existing push subscription
        reg.pushManager.getSubscription().then(sub => setPushEnabled(!!sub)).catch(() => {})
      }).catch(() => {})
    }

    // PWA install prompt
    const handler = e => { e.preventDefault(); setInstallable(true); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function enablePush() {
    // Honest stub: there is no push server and sw.js has no 'push' listener,
    // so subscribing would create a device that can never be notified.
    // (ProfilePage still calls this; it now gets a truthful toast instead of
    // a silent dead subscription.)
    showInfo('Push notification မရသေးပါ — နောက်ထပ် version တွင် ရနိုင်မည်')
    return false
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
