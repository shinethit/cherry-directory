// Shared install-prompt store — v9.3 (H-21).
// The beforeinstallprompt event can only be used once: after the user
// dismisses it, a second prompt() call does nothing. usePWA (Home/Profile
// install buttons) and PWAInstallBanner each kept their own copy of the
// prompt, so one could consume it while the other still showed a dead
// button. Both now read/write this single store: any resolved outcome
// (accepted OR dismissed) clears it and marks the app not installable.
import { useSyncExternalStore } from 'react'

let promptEvent = null
const listeners = new Set()

function emit() {
  listeners.forEach((fn) => {
    try {
      fn()
    } catch (e) {
      console.warn('installPrompt listener failed:', e)
    }
  })
}

export function setInstallPrompt(e) {
  promptEvent = e || null
  emit()
}

export function clearInstallPrompt() {
  promptEvent = null
  emit()
}

export function getInstallPrompt() {
  return promptEvent
}

export function subscribeInstallPrompt(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// React hook: re-renders when the shared prompt changes.
export function useInstallPrompt() {
  return useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt)
}
