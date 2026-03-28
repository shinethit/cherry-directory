import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LangProvider } from './contexts/LangContext'
import { AppConfigProvider } from './contexts/AppConfigContext'
import { ThemeProvider } from './contexts/ThemeContext'

// Layout
import BottomNav from './components/BottomNav'
import Header from './components/Header'

// Pages (keep your existing imports)
import HomePage from './pages/HomePage'
import DirectoryPage from './pages/DirectoryPage'
import ListingDetailPage from './pages/ListingDetailPage'
import EditListingPage from './pages/EditListingPage'
import SubmitListingPage from './pages/SubmitListingPage'
import MenuPage from './pages/MenuPage'
import NewsPage from './pages/NewsPage'
import PostDetailPage from './pages/PostDetailPage'
import EventFormPage from './pages/EventFormPage'
import CalendarPage from './pages/CalendarPage'
import CommunityPage from './pages/CommunityPage'
import EmergencyPage from './pages/EmergencyPage'
import MarketPricePage from './pages/MarketPricePage'
import PowerCutPage from './pages/PowerCutPage'
import FuelPage from './pages/FuelPage'
import LostFoundPage from './pages/LostFoundPage'
import LostFoundDetailPage from './pages/LostFoundDetailPage'
import JobBoardPage from './pages/JobBoardPage'
import ChatPage from './pages/ChatPage'
import ProfilePage from './pages/ProfilePage'
import LoginPage from './pages/LoginPage'
import BookmarksPage from './pages/BookmarksPage'
import LeaderboardPage from './pages/LeaderboardPage'
import ClaimPage from './pages/ClaimPage'
import AdminPage from './pages/AdminPage'
import CategoryManagerPage from './pages/CategoryManagerPage'
import BulkImportPage from './pages/BulkImportPage'
import AppSettingsPage from './pages/AppSettingsPage'
import NoticeBoardPage from './pages/NoticeBoardPage'
import { AboutPage, PrivacyPage, TermsPage, HelpPage } from './pages/InfoPages'
import { 
  WeatherAlertPage, 
  DonationPage, 
  HealthServicePage, 
  BusSchedulePage, 
  ToursPage 
} from './pages/CommunityFeaturePages'
import RentPage from './pages/RentPage'
import TutoringPage from './pages/TutoringPage'
import HistoryPage, { HistoryDetailPage } from './pages/HistoryPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0d0015]">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-white/50 text-sm font-myanmar">Loading...</p>
      </div>
    </div>
  )
}

function AppRoutes() {
  const { loading } = useAuth()
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
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/directory" element={<DirectoryPage />} />
        <Route path="/directory/:id" element={<ListingDetailPage />} />
        <Route path="/directory/:id/edit" element={<EditListingPage />} />
        <Route path="/directory/:id/menu" element={<MenuPage />} />
        <Route path="/submit" element={<SubmitListingPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/news/:id" element={<PostDetailPage />} />
        <Route path="/events/create" element={<EventFormPage />} />
        <Route path="/events/edit/:id" element={<EventFormPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/emergency" element={<EmergencyPage />} />
        <Route path="/prices" element={<MarketPricePage />} />
        <Route path="/power" element={<PowerCutPage />} />
        <Route path="/fuel" element={<FuelPage />} />
        <Route path="/lost-found" element={<LostFoundPage />} />
        <Route path="/lost-found/:id" element={<LostFoundDetailPage />} />
        <Route path="/jobs" element={<JobBoardPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/bus" element={<BusSchedulePage />} />
        <Route path="/health" element={<HealthServicePage />} />
        <Route path="/notices" element={<NoticeBoardPage />} />
        <Route path="/weather" element={<WeatherAlertPage />} />
        <Route path="/donations" element={<DonationPage />} />
        <Route path="/tours" element={<ToursPage />} />
        <Route path="/rent" element={<RentPage />} />
        <Route path="/tutoring" element={<TutoringPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/history/:id" element={<HistoryDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:id" element={<ProfilePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/bookmarks" element={<BookmarksPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/claim/:id" element={<ClaimPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/categories" element={<CategoryManagerPage />} />
        <Route path="/admin/bulk-import" element={<BulkImportPage />} />
        <Route path="/admin/settings" element={<AppSettingsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
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