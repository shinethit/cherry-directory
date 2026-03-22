import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import HomePage          from './pages/HomePage'
import DirectoryPage     from './pages/DirectoryPage'
import ListingDetailPage from './pages/ListingDetailPage'
import EditListingPage   from './pages/EditListingPage'
import MenuPage          from './pages/MenuPage'
import NewsPage          from './pages/NewsPage'
import PostDetailPage    from './pages/PostDetailPage'
import CalendarPage      from './pages/CalendarPage'
import EventFormPage     from './pages/EventFormPage'
import ChatPage          from './pages/ChatPage'
import LoginPage         from './pages/LoginPage'
import ProfilePage       from './pages/ProfilePage'
import AdminPage         from './pages/AdminPage'
import SubmitListingPage from './pages/SubmitListingPage'
import BulkImportPage    from './pages/BulkImportPage'
import ClaimPage         from './pages/ClaimPage'
import BookmarksPage     from './pages/BookmarksPage'
import LeaderboardPage   from './pages/LeaderboardPage'
// Community
import CommunityPage     from './pages/CommunityPage'
import MarketPricePage   from './pages/MarketPricePage'
import PowerCutPage      from './pages/PowerCutPage'
import FuelPage          from './pages/FuelPage'
import LostFoundPage     from './pages/LostFoundPage'
import JobBoardPage      from './pages/JobBoardPage'
import NoticeBoardPage   from './pages/NoticeBoardPage'
import { WeatherAlertPage, DonationPage, HealthServicePage } from './pages/CommunityFeaturePages'
import { AboutPage, PrivacyPage, TermsPage, HelpPage } from './pages/InfoPages'
import EmergencyPage from './pages/EmergencyPage'
import CategoryManagerPage from './pages/CategoryManagerPage'

function ProtectedRoute({ children, require: requireRole }) {
  const { isLoggedIn, isAdmin, isModerator, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" /></div>
  if (!isLoggedIn) return <Navigate to="/login" replace />
  if (requireRole === 'admin'     && !isAdmin)     return <Navigate to="/" replace />
  if (requireRole === 'moderator' && !isModerator) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        {/* Directory */}
        <Route path="directory"          element={<DirectoryPage />} />
        <Route path="directory/:id"      element={<ListingDetailPage />} />
        <Route path="directory/:id/edit" element={<ProtectedRoute><EditListingPage /></ProtectedRoute>} />
        <Route path="directory/:id/menu" element={<MenuPage />} />
        <Route path="claim/:id"          element={<ProtectedRoute><ClaimPage /></ProtectedRoute>} />
        {/* News */}
        <Route path="news"     element={<NewsPage />} />
        <Route path="news/:id" element={<PostDetailPage />} />
        {/* Calendar */}
        <Route path="calendar"        element={<CalendarPage />} />
        <Route path="events/create"   element={<ProtectedRoute require="moderator"><EventFormPage /></ProtectedRoute>} />
        <Route path="events/edit/:id" element={<ProtectedRoute><EventFormPage /></ProtectedRoute>} />
        {/* Chat */}
        <Route path="chat" element={<ChatPage />} />
        {/* Community Hub */}
        <Route path="community"  element={<CommunityPage />} />
        <Route path="prices"     element={<MarketPricePage />} />
        <Route path="power"      element={<PowerCutPage />} />
        <Route path="fuel"       element={<FuelPage />} />
        <Route path="lost-found" element={<LostFoundPage />} />
        <Route path="jobs"       element={<JobBoardPage />} />
        <Route path="notices"    element={<NoticeBoardPage />} />
        <Route path="weather"    element={<WeatherAlertPage />} />
        <Route path="donations"  element={<DonationPage />} />
        <Route path="health"     element={<HealthServicePage />} />
        {/* User */}
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="login"       element={<LoginPage />} />
        <Route path="profile"     element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="bookmarks"   element={<ProtectedRoute><BookmarksPage /></ProtectedRoute>} />
        <Route path="submit"      element={<ProtectedRoute><SubmitListingPage /></ProtectedRoute>} />
        {/* Admin */}
        <Route path="bulk-import" element={<ProtectedRoute require="moderator"><BulkImportPage /></ProtectedRoute>} />
        <Route path="admin"            element={<ProtectedRoute require="moderator"><AdminPage /></ProtectedRoute>} />
        <Route path="admin/categories" element={<ProtectedRoute require="moderator"><CategoryManagerPage /></ProtectedRoute>} />
        {/* Info pages */}
        <Route path="about"     element={<AboutPage />} />
        <Route path="privacy"   element={<PrivacyPage />} />
        <Route path="terms"     element={<TermsPage />} />
        <Route path="help"      element={<HelpPage />} />
        <Route path="emergency" element={<EmergencyPage />} />
      </Route>
    </Routes>
  )
}
