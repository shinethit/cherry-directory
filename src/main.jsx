import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initErrorTracking } from './lib/errorHandler'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import PWAInstallBanner from './components/PWAInstallBanner'
import UpdatePrompt from './components/UpdatePrompt'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
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
  <QueryClientProvider client={queryClient}>
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
  </QueryClientProvider>
)
