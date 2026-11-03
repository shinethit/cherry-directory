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

// ── Lazy pages — default exports ─────────────────────────────
// H-28: lazy() has no timeout and no retry — a hung or failed chunk fetch
// used to show "Loading..." forever. lazyWithRetry retries the import once,
// then reloads the page (a stale cached chunk / failed deploy is the usual
// cause); the Suspense fallback below escalates to an error screen with
// Retry if the chunk still hasn't arrived after 10 s.
function lazyWithRetry(importFn) {
  return lazy(async () => {
    try {
      return await importFn()
    } catch (err) {
      console.warn('[chunk] First load failed, retrying once:', err)
      try {
        return await importFn()
      } catch (err2) {
        console.warn('[chunk] Retry failed, reloading page:', err2)
        window.location.reload()
        throw err2
      }
    }
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
const NewsEditPage        = lazyWithRetry(() => import('./pages/NewsEditPage'))
const RentPage            = lazyWithRetry(() => import('./pages/RentPage'))
const TutoringPage        = lazyWithRetry(() => import('./pages/TutoringPage'))
const AdminReportsPage    = lazyWithRetry(() => import('./pages/AdminReportsPage'))
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
// loaded after 10 s, escalate from the spinner to an error screen with
// Retry. The timer resets on every navigation and is cancelled as soon as
// the chunk actually renders (SuspenseLoaded mounts only then).
const CHUNK_TIMEOUT_MS = 10000

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
    const t = setTimeout(() => { if (!loadedRef.current) setTimedOut(true) }, CHUNK_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [pathname])
  if (timedOut) return <ErrorScreen onRetry={() => window.location.reload()} />
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SuspenseLoaded onLoaded={() => { loadedRef.current = true }} />
      {children}
    </Suspense>
  )
}

function AppRoutes() {
  const { loading } = useAuth()
  const [timeoutExceeded, setTimeoutExceeded] = useState(false)

  // H-28: preload the HomePage chunk on boot so the landing route rarely
  // suspends at all; idle-time so it never competes with first paint.
  useEffect(() => {
    const preload = () => { import('./pages/HomePage').catch(() => {}) }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(preload, { timeout: 3000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = setTimeout(preload, 1000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!loading) {
      setTimeoutExceeded(false)
      return
    }
    const timer = setTimeout(() => {
      console.warn('Auth loading timeout exceeded')
      setTimeoutExceeded(true)
    }, 8000)
    return () => clearTimeout(timer)
  }, [loading])

  if (loading && !timeoutExceeded) return <LoadingSpinner />
  if (timeoutExceeded) return <ErrorScreen onRetry={() => window.location.reload()} />

  return (
    <div
      className="min-h-dvh bg-gradient-to-b from-[#0d0015] to-[#1a0030] dark:from-[#0d0015] dark:to-[#1a0030] pb-20"
      style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}
    >
      <Header />
      <AnnouncementBanner />
      <ScrollToTop />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TimedSuspense>
      <BottomNav />
      <OnboardingGuide />
    </div>
  )
}

function ErrorScreen({ onRetry }) {
  return (
    <div className="min-h-dvh bg-[#0d0015] flex items-center justify-center p-4">
      <div className="card-dark rounded-2xl p-6 max-w-md text-center border border-red-500/30">
        <span className="text-5xl mb-4 block">⚠️</span>
        <h2 className="text-white font-display font-bold text-lg mb-2">Connection Issue</h2>
        <p className="text-white/50 text-sm font-myanmar mb-4">Unable to connect to server. Please check your internet connection.</p>
        <button onClick={onRetry} className="btn-primary text-sm py-2 px-6">Retry</button>
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
