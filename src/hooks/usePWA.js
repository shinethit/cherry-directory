import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { showInfo } from '../lib/toast'
import {
  setInstallPrompt,
  clearInstallPrompt,
  getInstallPrompt,
  useInstallPrompt,
} from '../lib/installPromptStore'

export function usePWA() {
  const [swReady, setSwReady] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  // installable is derived from the SHARED prompt store (H-21): the
  // beforeinstallprompt event is one-shot, so usePWA and PWAInstallBanner
  // must not keep separate copies — one consuming it left the other with
  // a dead button.
  const sharedPrompt = useInstallPrompt()
  const [installable, setInstallable] = useState(false)

  useEffect(() => {
    setInstallable(!!sharedPrompt)
  }, [sharedPrompt])

  useEffect(() => {
    // NOTE: the service worker is registered once, in useServiceWorker.js.
    // Do NOT register it here again.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        setSwReady(true)
        // Check existing push subscription
        reg.pushManager.getSubscription().then(sub => setPushEnabled(!!sub)).catch(() => {})
      }).catch(() => {})
    }

    // PWA install prompt — stored in the shared store, not locally.
    const handler = e => { e.preventDefault(); setInstallPrompt(e) }
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
    // H-21: any resolved outcome (accepted OR dismissed) consumes the
    // one-shot prompt — clear it and hide the button, so a dismissed
    // prompt never leaves a dead Install button until reload.
    const prompt = getInstallPrompt()
    if (!prompt) { setInstallable(false); return }
    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      void outcome // accepted or dismissed — either way the prompt is spent
    } catch (err) {
      console.warn('Install failed:', err)
    } finally {
      clearInstallPrompt()
      setInstallable(false)
    }
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
