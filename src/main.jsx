import React from 'react'
import ReactDOM from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { queryClient } from './lib/queryClient'
import App from './App'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initErrorTracking } from './lib/errorHandler'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import PWAInstallBanner from './components/PWAInstallBanner'
import UpdatePrompt from './components/UpdatePrompt'

// v9.17 (Issue 4/5): persist the query cache to localStorage so pages
// render instantly from cache (vital under VPN) and the Profile Offline
// panel finally shows real data. The persister key MUST stay
// 'cherry-directory-cache' — OfflineCachePanel reads exactly that key
// (cacheStatus.js). maxAge 24 h. The client itself lives in
// src/lib/queryClient.js (single client — the duplicate inline client
// that used to live here is gone; OfflineCachePanel's useQueryClient
// resolves to this provider's client).
const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'cherry-directory-cache',
})

// Sentry stays completely off unless VITE_SENTRY_DSN is set (Vercel env var).
initErrorTracking(import.meta.env.VITE_SENTRY_DSN)

console.log('=== APP STARTING ===')
console.log('Environment:', import.meta.env.MODE)

// NOTE (C-L1): the service worker is registered exactly once, in
// useServiceWorker.js (single registration point, with the dev-mode guard).
// The duplicate registration that used to live here — including its
// unguarded localStorage read before createRoot (H-2, blank white screen
// on SecurityError) — was removed in v9.3.

ReactDOM.createRoot(document.getElementById('root')).render(
  <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}>
    <ErrorBoundary>
      <App />
      {/* PWA install banner needs no contexts, so it lives here as a sibling. */}
      <PWAInstallBanner />
      <UpdatePrompt />
    </ErrorBoundary>
    {/* ToastContainer lives OUTSIDE ErrorBoundary (I-LOW): toasts fired
        after a crash used to be invisible because the boundary unmounted
        everything inside it. */}
    <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} closeOnClick pauseOnHover draggable />
  </PersistQueryClientProvider>
)
