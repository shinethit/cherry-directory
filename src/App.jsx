import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { usePrefetchAll } from './hooks/usePrefetchAll'
import { LangProvider } from './contexts/LangContext'
import { AppConfigProvider } from './contexts/AppConfigContext'
import { ThemeProvider } from './contexts/ThemeContext'

// Layout — always loaded
import BottomNav from './components/BottomNav'
import Header from './components/Header'
import AnnouncementBanner from './components/AnnouncementBanner'
import OnboardingGuide from './components/OnboardingGuide'

// ── Lazy pages — default exports ─────────────────────────────
const HomePage            = lazy(() => import('./pages/HomePage'))
const DirectoryPage       = lazy(() => import('./pages/DirectoryPage'))
const ListingDetailPage   = lazy(() => import('./pages/ListingDetailPage'))
const EditListingPage     = lazy(() => import('./pages/EditListingPage'))
const SubmitListingPage   = lazy(() => import('./pages/SubmitListingPage'))
const MenuPage            = lazy(() => import('./pages/MenuPage'))
const NewsPage            = lazy(() => import('./pages/NewsPage'))
const PostDetailPage      = lazy(() => import('./pages/PostDetailPage'))
const EventFormPage       = lazy(() => import('./pages/EventFormPage'))
const CalendarPage        = lazy(() => import('./pages/CalendarPage'))
const CommunityPage       = lazy(() => import('./pages/CommunityPage'))
const EmergencyPage       = lazy(() => import('./pages/EmergencyPage'))
const MarketPricePage     = lazy(() => import('./pages/MarketPricePage'))
const LostFoundPage       = lazy(() => import('./pages/LostFoundPage'))
const LostFoundDetailPage = lazy(() => import('./pages/LostFoundDetailPage'))
const JobBoardPage        = lazy(() => import('./pages/JobBoardPage'))
const ChatPage            = lazy(() => import('./pages/ChatPage'))
const ProfilePage         = lazy(() => import('./pages/ProfilePage'))
const LoginPage           = lazy(() => import('./pages/LoginPage'))
const LeaderboardPage     = lazy(() => import('./pages/LeaderboardPage'))
const PointsGuidePage     = lazy(() => import('./pages/PointsGuidePage'))
const ClaimPage           = lazy(() => import('./pages/ClaimPage'))
const AdminPage           = lazy(() => import('./pages/AdminPage'))
const CategoryManagerPage = lazy(() => import('./pages/CategoryManagerPage'))
const BulkImportPage      = lazy(() => import('./pages/BulkImportPage'))
const AppSettingsPage     = lazy(() => import('./pages/AppSettingsPage'))
const NoticeBoardPage     = lazy(() => import('./pages/NoticeBoardPage'))
const SearchPage          = lazy(() => import('./pages/SearchPage'))
const NotificationsPage   = lazy(() => import('./pages/NotificationsPage'))
const SavedPage           = lazy(() => import('./pages/SavedPage'))
const MySubmissionsPage   = lazy(() => import('./pages/MySubmissionsPage'))
const MyRsvpsPage         = lazy(() => import('./pages/MyRsvpsPage'))
const NewsEditPage        = lazy(() => import('./pages/NewsEditPage'))
const RentPage            = lazy(() => import('./pages/RentPage'))
const TutoringPage        = lazy(() => import('./pages/TutoringPage'))
const AdminReportsPage    = lazy(() => import('./pages/AdminReportsPage'))

// ── Named exports — wrapped ──────────────────────────────────
const AboutPage           = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.AboutPage })))
const PrivacyPage         = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.PrivacyPage })))
const TermsPage           = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.TermsPage })))
const HelpPage            = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.HelpPage })))

const DonationPage        = lazy(() => import('./pages/CommunityFeaturePages').then(m => ({ default: m.DonationPage })))
const HealthServicePage   = lazy(() => import('./pages/CommunityFeaturePages').then(m => ({ default: m.HealthServicePage })))
const BusSchedulePage     = lazy(() => import('./pages/CommunityFeaturePages').then(m => ({ default: m.BusSchedulePage })))
const ToursPage           = lazy(() => import('./pages/CommunityFeaturePages').then(m => ({ default: m.ToursPage })))

const HistoryPage         = lazy(() => import('./pages/HistoryPage'))
const HistoryDetailPage   = lazy(() => import('./pages/HistoryPage').then(m => ({ default: m.HistoryDetailPage })))

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

function AppRoutes() {
  const { loading } = useAuth()
  usePrefetchAll()
  const [timeoutExceeded, setTimeoutExceeded] = useState(false)

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
      className="min-h-screen bg-gradient-to-b from-[#0d0015] to-[#1a0030] dark:from-[#0d0015] dark:to-[#1a0030] pb-20"
      style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}
    >
      <Header />
      <AnnouncementBanner />
      <ScrollToTop />
      <Suspense fallback={<LoadingSpinner />}>
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
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/points" element={<PointsGuidePage />} />
          <Route path="/claim/:id" element={<ClaimPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/categories" element={<CategoryManagerPage />} />
          <Route path="/admin/bulk-import" element={<BulkImportPage />} />
          <Route path="/admin/settings" element={<AppSettingsPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <BottomNav />
      <OnboardingGuide />
    </div>
  )
}

function ErrorScreen({ onRetry }) {
  return (
    <div className="min-h-screen bg-[#0d0015] flex items-center justify-center p-4">
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
              <AppRoutes />
            </ThemeProvider>
          </AppConfigProvider>
        </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  )
}
