import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LangProvider } from './contexts/LangContext'
import { AppConfigProvider } from './contexts/AppConfigContext'
import { ThemeProvider } from './contexts/ThemeContext'

// Layout — always loaded
import BottomNav from './components/BottomNav'
import Header from './components/Header'
import AnnouncementBanner from './components/AnnouncementBanner'
import OnboardingGuide from './components/OnboardingGuide'
import { ConfirmProvider } from './components/ConfirmModal'
import { logVisit } from './lib/visitTracking'
import { schedulePrefetch } from './lib/prefetch'
import { usePresence } from './hooks/usePresence'

// ── Lazy pages — default exports ─────────────────────────────
// H-28: lazy() has no timeout and no retry — a hung or failed chunk fetch
// used to show "Loading..." forever. FB-2: lazyWithRetry tries at most 3
// times (first try + 2 retries), then throws — the ErrorBoundary shows a
// Myanmar error screen with a retry button. It NEVER reloads the page
// itself: an unconditional reload here used to loop forever.
function lazyWithRetry(importFn) {
  return lazy(async () => {
    let lastErr
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await importFn()
      } catch (err) {
        lastErr = err
        console.warn(`[chunk] Load failed (attempt ${attempt + 1}/3):`, err)
      }
    }
    throw lastErr
  })
}

const HomePage            = lazyWithRetry(() => import('./pages/HomePage'))
const DirectoryPage       = lazyWithRetry(() => import('./pages/DirectoryPage'))
const ListingDetailPage   = lazyWithRetry(() => import('./pages/ListingDetailPage'))
const EditListingPage     = lazyWithRetry(() => import('./pages/EditListingPage'))
const SubmitListingPage   = lazyWithRetry(() => import('./pages/SubmitListingPage'))
const MenuPage            = lazyWithRetry(() => import('./pages/MenuPage'))
const NewsPage            = lazyWithRetry(() => import('./pages/NewsPage'))
const PostDetailPage      = lazyWithRetry(() => import('./pages/PostDetailPage'))
const EventFormPage       = lazyWithRetry(() => import('./pages/EventFormPage'))
const CalendarPage        = lazyWithRetry(() => import('./pages/CalendarPage'))
const CommunityPage       = lazyWithRetry(() => import('./pages/CommunityPage'))
const EmergencyPage       = lazyWithRetry(() => import('./pages/EmergencyPage'))
const MarketPricePage     = lazyWithRetry(() => import('./pages/MarketPricePage'))
const LostFoundPage       = lazyWithRetry(() => import('./pages/LostFoundPage'))
const LostFoundDetailPage = lazyWithRetry(() => import('./pages/LostFoundDetailPage'))
const JobBoardPage        = lazyWithRetry(() => import('./pages/JobBoardPage'))
const ChatPage            = lazyWithRetry(() => import('./pages/ChatPage'))
const ProfilePage         = lazyWithRetry(() => import('./pages/ProfilePage'))
const LoginPage           = lazyWithRetry(() => import('./pages/LoginPage'))
const ResetPasswordPage   = lazyWithRetry(() => import('./pages/ResetPasswordPage'))
const LeaderboardPage     = lazyWithRetry(() => import('./pages/LeaderboardPage'))
const PointsGuidePage     = lazyWithRetry(() => import('./pages/PointsGuidePage'))
const ClaimPage           = lazyWithRetry(() => import('./pages/ClaimPage'))
const AdminPage           = lazyWithRetry(() => import('./pages/AdminPage'))
const CategoryManagerPage = lazyWithRetry(() => import('./pages/CategoryManagerPage'))
const BulkImportPage      = lazyWithRetry(() => import('./pages/BulkImportPage'))
const AppSettingsPage     = lazyWithRetry(() => import('./pages/AppSettingsPage'))
const NoticeBoardPage     = lazyWithRetry(() => import('./pages/NoticeBoardPage'))
const SearchPage          = lazyWithRetry(() => import('./pages/SearchPage'))
const NotificationsPage   = lazyWithRetry(() => import('./pages/NotificationsPage'))
const SavedPage           = lazyWithRetry(() => import('./pages/SavedPage'))
const MySubmissionsPage   = lazyWithRetry(() => import('./pages/MySubmissionsPage'))
const MyRsvpsPage         = lazyWithRetry(() => import('./pages/MyRsvpsPage'))
const MyReviewsPage       = lazyWithRetry(() => import('./pages/MyReviewsPage'))
const NotFoundPage        = lazyWithRetry(() => import('./pages/NotFoundPage'))
const NewsEditPage        = lazyWithRetry(() => import('./pages/NewsEditPage'))
const RentPage            = lazyWithRetry(() => import('./pages/RentPage'))
const TutoringPage        = lazyWithRetry(() => import('./pages/TutoringPage'))
const AdminReportsPage    = lazyWithRetry(() => import('./pages/AdminReportsPage'))
const VisitorsPage       = lazyWithRetry(() => import('./pages/VisitorsPage'))
const FuelPage            = lazyWithRetry(() => import('./pages/FuelPage'))

// ── Named exports — wrapped ──────────────────────────────────
const AboutPage           = lazyWithRetry(() => import('./pages/InfoPages').then(m => ({ default: m.AboutPage })))
const PrivacyPage         = lazyWithRetry(() => import('./pages/InfoPages').then(m => ({ default: m.PrivacyPage })))
const TermsPage           = lazyWithRetry(() => import('./pages/InfoPages').then(m => ({ default: m.TermsPage })))
const HelpPage            = lazyWithRetry(() => import('./pages/InfoPages').then(m => ({ default: m.HelpPage })))

const DonationPage        = lazyWithRetry(() => import('./pages/CommunityFeaturePages').then(m => ({ default: m.DonationPage })))
const HealthServicePage   = lazyWithRetry(() => import('./pages/CommunityFeaturePages').then(m => ({ default: m.HealthServicePage })))
const BusSchedulePage     = lazyWithRetry(() => import('./pages/CommunityFeaturePages').then(m => ({ default: m.BusSchedulePage })))
const ToursPage           = lazyWithRetry(() => import('./pages/CommunityFeaturePages').then(m => ({ default: m.ToursPage })))

const HistoryPage         = lazyWithRetry(() => import('./pages/HistoryPage'))
const HistoryDetailPage   = lazyWithRetry(() => import('./pages/HistoryPage').then(m => ({ default: m.HistoryDetailPage })))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[60dvh]">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-white/50 text-sm font-myanmar">Loading...</p>
      </div>
    </div>
  )
}

// Admin / moderator / super_admin only. Defence-in-depth: the admin pages
// also render-guard themselves, but the route must not even mount for others.
// H-3: isAdmin/isModerator derive from profile?.role, so while the profile
// is still loading we show a spinner — NOT the lock message. If the profile
// failed to load for a logged-in user, offer a Retry that re-fetches it
// (refreshProfile, Track 3's AuthContext interface).
function RequireAdmin({ children }) {
  const { loading, profileLoading, profile, isAdmin, isModerator, isLoggedIn, refreshProfile } = useAuth()
  const [profileFailed, setProfileFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    // Profile finished loading (or never started one) and a logged-in user
    // still has no profile — the fetch failed or returned nothing.
    if (!loading && !profileLoading && isLoggedIn && !profile) setProfileFailed(true)
    else if (profile) setProfileFailed(false)
  }, [loading, profileLoading, isLoggedIn, profile])

  if (loading || profileLoading) return <LoadingSpinner />
  if (!isAdmin && !isModerator) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh] px-8 text-center">
        <div>
          <p className="text-white/50 font-myanmar">🔒 Admin / Moderator သာ ကြည့်နိုင်သည်</p>
          {profileFailed && (
            <button
              disabled={retrying}
              onClick={async () => {
                setRetrying(true)
                try { await refreshProfile?.() } finally { setRetrying(false) }
              }}
              className="btn-primary text-xs px-4 py-2 mt-4 disabled:opacity-50"
            >
              {retrying ? 'ပြန်တင်နေသည်…' : 'ပြန်ကြိုးစားမည်'}
            </button>
          )}
        </div>
      </div>
    )
  }
  return children
}

// H-28: Suspense fallback with a timeout — if a lazy chunk still hasn't
// loaded after 30 s (v9.14: was 10 s — slow mobile data needs the headroom),
// auto-reload ONCE (sessionStorage guard, set before reloading, so a
// persistently failing chunk can never loop) and only then escalate to an
// error screen with Retry. The timer resets on every navigation and is
// cancelled as soon as the chunk actually renders (SuspenseLoaded mounts
// only then).
const CHUNK_TIMEOUT_MS = 30000
// Set before the one auto-reload; cleared on every successful chunk load.
const CHUNK_RELOAD_KEY = 'cherry_chunk_reloaded'

function SuspenseLoaded({ onLoaded }) {
  useEffect(() => { onLoaded() }, [onLoaded])
  return null
}

function TimedSuspense({ children }) {
  const { pathname } = useLocation()
  const [timedOut, setTimedOut] = useState(false)
  const loadedRef = useRef(false)
  useEffect(() => {
    loadedRef.current = false
    setTimedOut(false)
    const t = setTimeout(() => {
      if (loadedRef.current) return
      // v9.14: chunk stall — reload once, guarded so it can't loop.
      try {
        if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
          window.location.reload()
          return
        }
      } catch { /* storage unavailable — fall through to error screen */ }
      setTimedOut(true)
    }, CHUNK_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [pathname])
  if (timedOut) return <ErrorScreen onRetry={() => window.location.reload()} variant="chunk" />
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SuspenseLoaded onLoaded={() => {
        loadedRef.current = true
        try { sessionStorage.removeItem(CHUNK_RELOAD_KEY) } catch { /* ignore */ }
      }} />
      {children}
    </Suspense>
  )
}

function AppRoutes() {
  const { loading } = useAuth()
  const [timeoutExceeded, setTimeoutExceeded] = useState(false)

  // S33 (v9.17): keep presence alive for logged-in users — pings
  // last_seen/is_online every minute, which feeds the leaderboard
  // online dots and the Profile "last seen" line. No-op for guests.
  usePresence()

  // v9.12: log one visit per browser session (once only — logVisit guards
  // on sessionStorage). Fire-and-forget and never throws; a missing table
  // (migration not run yet) or blocked network fails silently.
  useEffect(() => {
    try { logVisit() } catch { /* never break boot */ }
    // v9.17 (Issue 4/5): warm the persisted query cache on idle after
    // boot, so pages render instantly under VPN and the Offline panel
    // shows real counts. Never blocks first paint, never throws.
    try { schedulePrefetch() } catch { /* never break boot */ }
  }, [])

  // H-28: preload the HomePage chunk on boot so the landing route rarely
  // suspends at all; idle-time so it never competes with first paint.
  // v9.14: also preload ListingDetail + Menu — the two chunks users most
  // often open next (same fire-and-forget pattern, safe to skip on error).
  useEffect(() => {
    const preload = () => {
      import('./pages/HomePage').catch(() => {})
      import('./pages/ListingDetailPage').catch(() => {})
      import('./pages/MenuPage').catch(() => {})
    }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(preload, { timeout: 3000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(preload, 1000)
    return () => clearTimeout(t)
  }, [])

  // v9.22: 30 s — the auth safety net is bound at ~25 s (5 s × 4 re-arms
  // while a profile fetch is in flight), so the ErrorScreen must only
  // appear after it, when boot is really stuck. At 8 s it fired while
  // the safety net was still re-arming, and its reload Retry restarted
  // the whole boot cycle.
  useEffect(() => {
    if (!loading) {
      setTimeoutExceeded(false)
      return
    }
    const timer = setTimeout(() => {
      console.warn('Auth loading timeout exceeded')
      setTimeoutExceeded(true)
    }, 30000)
    return () => clearTimeout(timer)
  }, [loading])

  if (loading && !timeoutExceeded) return <LoadingSpinner />
  if (timeoutExceeded) return <ErrorScreen onRetry={() => window.location.reload()} variant="auth" />

  return (
    // v9.14: flex column + min-h-dvh so BottomNav is sticky (last in-flow
    // child) instead of fixed — no vertical jump, no height mismatch.
    // The <main> is flex-1 with pb-32: 128px clearance between the last
    // page content and the nav, covering the fixed floating buttons
    // (bottom 80px + 48px tall = 80–128px band). Root padding would land
    // BELOW the sticky nav, so the clearance lives on <main>, not root.
    <div
      className="flex min-h-dvh flex-col bg-gradient-to-b from-[#0d0015] to-[#1a0030] dark:from-[#0d0015] dark:to-[#1a0030]"
      style={{ paddingTop: 'calc(4.25rem + env(safe-area-inset-top))' }}
    >
      <Header />
      <AnnouncementBanner />
      <ScrollToTop />
      <main className="flex-1 pb-32">
      <TimedSuspense>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/directory" element={<DirectoryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/my-submissions" element={<MySubmissionsPage />} />
          <Route path="/my-rsvps" element={<MyRsvpsPage />} />
          <Route path="/bookmarks" element={<Navigate to="/saved" replace />} />
          <Route path="/saved-places" element={<Navigate to="/saved?tab=places" replace />} />
          <Route path="/directory/:id" element={<ListingDetailPage />} />
          <Route path="/directory/:id/edit" element={<EditListingPage />} />
          <Route path="/directory/:id/menu" element={<MenuPage />} />
          <Route path="/submit" element={<SubmitListingPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/news/:id" element={<PostDetailPage />} />
          <Route path="/events/create" element={<EventFormPage />} />
          <Route path="/events/edit/:id" element={<EventFormPage />} />
          <Route path="/news/edit/:id" element={<NewsEditPage />} />
          <Route path="/news/create" element={<NewsEditPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/emergency" element={<EmergencyPage />} />
          <Route path="/prices" element={<MarketPricePage />} />
          <Route path="/fuel" element={<FuelPage />} />
          <Route path="/lost-found" element={<LostFoundPage />} />
          <Route path="/lost-found/:id" element={<LostFoundDetailPage />} />
          <Route path="/jobs" element={<JobBoardPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/bus" element={<BusSchedulePage />} />
          <Route path="/health" element={<HealthServicePage />} />
          <Route path="/notices" element={<NoticeBoardPage />} />
          <Route path="/donations" element={<DonationPage />} />
          <Route path="/donations/:id" element={<DonationPage />} />
          <Route path="/my-reviews" element={<MyReviewsPage />} />
          <Route path="/tours" element={<ToursPage />} />
          <Route path="/rent" element={<RentPage />} />
          <Route path="/tutoring" element={<TutoringPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:id" element={<HistoryDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/points" element={<PointsGuidePage />} />
          <Route path="/claim/:id" element={<ClaimPage />} />
          <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="/admin/categories" element={<RequireAdmin><CategoryManagerPage /></RequireAdmin>} />
          <Route path="/admin/bulk-import" element={<RequireAdmin><BulkImportPage /></RequireAdmin>} />
          <Route path="/admin/settings" element={<RequireAdmin><AppSettingsPage /></RequireAdmin>} />
          <Route path="/admin/reports" element={<RequireAdmin><AdminReportsPage /></RequireAdmin>} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/visitors" element={<VisitorsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </TimedSuspense>
      </main>
      <OnboardingGuide />
      <BottomNav />
    </div>
  )
}

// FB-4: different text per situation — a slow auth load is not a chunk
// failure, and neither is "cannot connect to server".
function ErrorScreen({ onRetry, variant }) {
  const copy = variant === 'chunk'
    ? { title: 'App တင်မရပါ', body: 'App ရဲ့ အစိတ်အပိုင်း တစ်ခုခု တင်မရပါ — ထပ်ကြိုးစားကြည့်ပါ။' }
    : variant === 'auth'
      ? { title: 'အကောင့် တင်နေသည်…', body: 'အကောင့် ဖွင့်တာ ကြာနေသည် — ထပ်ကြိုးစားကြည့်ပါ။' }
      : { title: 'ချိတ်ဆက်၍ မရပါ', body: 'ဆာဗာသို့ ချိတ်ဆက်၍ မရပါ — ထပ်ကြိုးစားကြည့်ပါ။' }
  return (
    <div className="min-h-dvh bg-[#0d0015] flex items-center justify-center p-4">
      <div className="card-dark rounded-2xl p-6 max-w-md text-center border border-red-500/30">
        <span className="text-5xl mb-4 block">⚠️</span>
        <h2 className="text-white font-display font-bold text-lg mb-2">{copy.title}</h2>
        <p className="text-white/50 text-sm font-myanmar mb-4">{copy.body}</p>
        <button onClick={onRetry} className="btn-primary text-sm py-3 px-6 min-h-[44px]">ပြန်ကြိုးစားမည်</button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LangProvider>
        <AuthProvider>
          <AppConfigProvider>
            <ThemeProvider>
              <ConfirmProvider>
                <AppRoutes />
              </ConfirmProvider>
            </ThemeProvider>
          </AppConfigProvider>
        </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  )
}
