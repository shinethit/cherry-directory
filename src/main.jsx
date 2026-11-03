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


// ── Register Service Worker (production only) ─────────────
if ('serviceWorker' in navigator) {
  const isDev = import.meta.env.MODE === 'development'
  const enableInDev = localStorage.getItem('enable_sw_dev') === 'true'
  if (!isDev || enableInDev) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        (reg) => console.log('[SW] Registered:', reg.scope),
        (err) => console.warn('[SW] Registration failed:', err.message)
      )
    })
  } else {
    console.log('[SW] Skipped (dev mode). Enable with: localStorage.enable_sw_dev=true')
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <App />
      {/* PWA install banner needs no contexts, so it lives here as a sibling. */}
      <PWAInstallBanner />
      <UpdatePrompt />
      {/* ToastContainer must exist or showError/showSuccess toasts are invisible. */}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} closeOnClick pauseOnHover draggable />
    </ErrorBoundary>
  </QueryClientProvider>
)