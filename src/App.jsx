function AppRoutes() {
  console.log('=== AppRoutes rendering ===')
  
  const { loading } = useAuth()
  console.log('Auth loading state:', loading)

  if (loading) {
    console.log('Still loading, showing spinner...')
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0d0015]">
        <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  console.log('Loading complete, rendering main app')
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LangProvider } from './contexts/LangContext'
import { AppConfigProvider } from './contexts/AppConfigContext'

// Layout
import BottomNav from './components/BottomNav'
import Header from './components/Header'

// Pages
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

// Community Features from CommunityFeaturePages.jsx
import { 
  WeatherAlertPage, 
  DonationPage, 
  HealthServicePage, 
  BusSchedulePage, 
  ToursPage 
} from './pages/CommunityFeaturePages'

// New Pages
import RentPage from './pages/RentPage'
import TutoringPage from './pages/TutoringPage'
import HistoryPage, { HistoryDetailPage } from './pages/HistoryPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function AppRoutes() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0d0015]">
        <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0d0015] to-[#1a0030] pb-20">
      <Header />
      <ScrollToTop />
      <Routes>
        {/* Public Routes */}
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
        
        {/* Community Features */}
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/emergency" element={<EmergencyPage />} />
        <Route path="/prices" element={<MarketPricePage />} />
        <Route path="/power" element={<PowerCutPage />} />
        <Route path="/fuel" element={<FuelPage />} />
        <Route path="/lost-found" element={<LostFoundPage />} />
        <Route path="/jobs" element={<JobBoardPage />} />
        <Route path="/chat" element={<ChatPage />} />
        
        {/* Community Features from CommunityFeaturePages */}
        <Route path="/bus" element={<BusSchedulePage />} />
        <Route path="/health" element={<HealthServicePage />} />
        <Route path="/notices" element={<NoticeBoardPage />} />
        <Route path="/weather" element={<WeatherAlertPage />} />
        <Route path="/donations" element={<DonationPage />} />
        <Route path="/tours" element={<ToursPage />} />
        
        {/* New Community Features */}
        <Route path="/rent" element={<RentPage />} />
        <Route path="/tutoring" element={<TutoringPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/history/:id" element={<HistoryDetailPage />} />
        
        {/* User Routes */}
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:id" element={<ProfilePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/bookmarks" element={<BookmarksPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/claim/:id" element={<ClaimPage />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/categories" element={<CategoryManagerPage />} />
        <Route path="/admin/bulk-import" element={<BulkImportPage />} />
        <Route path="/admin/settings" element={<AppSettingsPage />} />
        
        {/* Info Pages */}
        <Route path="/about" element={<AboutPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/help" element={<HelpPage />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <LangProvider>
        <AuthProvider>
          <AppConfigProvider>
            <AppRoutes />
          </AppConfigProvider>
        </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  )
}
