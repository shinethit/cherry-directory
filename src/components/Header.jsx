import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Menu, X, User, LogOut, Settings, Shield, Bell, Home, Bookmark, Trophy, MessageCircle, Calendar, Users, Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../contexts/AppConfigContext'

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, isLoggedIn, isAdmin, isModerator, signOut } = useAuth()
  const { lang } = useLang()
  const config = useAppConfig()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location])

  const menuItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/directory', label: 'Directory', icon: Search },
    { path: '/calendar', label: 'Calendar', icon: Calendar },
    { path: '/community', label: 'Community', icon: Users },
    { path: '/chat', label: 'Chat', icon: MessageCircle },
    { path: '/bookmarks', label: 'Saved', icon: Bookmark },
    { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  ]

  const adminItems = [
    { path: '/admin', label: 'Admin Panel', icon: Shield },
    { path: '/admin/categories', label: 'Categories', icon: Settings },
    { path: '/admin/bulk-import', label: 'Bulk Import', icon: Settings },
    { path: '/admin/settings', label: 'App Settings', icon: Settings },
  ]

  const handleLogout = async () => {
    await signOut()
    navigate('/')
    setMenuOpen(false)
  }

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#0a0018]/90 backdrop-blur-lg border-b border-white/10'
            : 'bg-transparent'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <span className="text-lg">🍒</span>
            </div>
            <div className="hidden sm:block">
              <p className="font-display font-bold text-sm text-white leading-tight">
                {config.app_name || 'Cherry Directory'}
              </p>
              <p className="text-[9px] text-white/40 font-myanmar">{config.app_city || 'တောင်ကြီးမြို့'}</p>
            </div>
          </button>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <button
              onClick={() => {
                localStorage.setItem('lang', lang === 'mm' ? 'en' : 'mm')
                window.location.reload()
              }}
              className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center text-xs font-bold text-white/60 hover:text-white/90"
            >
              {lang === 'mm' ? 'EN' : 'မြန်မာ'}
            </button>

            {/* Menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center"
            >
              {menuOpen ? <X size={18} className="text-white" /> : <Menu size={18} className="text-white" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md pt-16" onClick={() => setMenuOpen(false)}>
          <div className="p-4 space-y-2" onClick={e => e.stopPropagation()}>
            {/* User section */}
            {isLoggedIn && profile && (
              <div className="card-dark p-4 rounded-2xl mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center overflow-hidden">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={18} className="text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{profile.full_name || 'User'}</p>
                  <p className="text-[10px] text-white/40">
                    {profile.role === 'admin' ? 'Admin' : profile.role === 'moderator' ? 'Moderator' : 'Member'}
                  </p>
                </div>
                <button onClick={handleLogout} className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
                  <LogOut size={14} className="text-red-400" />
                </button>
              </div>
            )}

            {!isLoggedIn && (
              <button
                onClick={() => navigate('/login')}
                className="w-full btn-primary text-sm py-3 mb-4"
              >
                Login / Sign Up
              </button>
            )}

            {/* Main menu items */}
            {menuItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/8 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                <item.icon size={18} className="text-white/50" />
                <span className="text-sm text-white/80">{item.label}</span>
              </Link>
            ))}

            {/* Admin section */}
            {(isAdmin || isModerator) && (
              <div className="pt-2 mt-2 border-t border-white/8">
                <p className="text-[10px] text-amber-400/70 px-3 py-1 font-bold uppercase tracking-wider">Admin</p>
                {adminItems.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/8 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <item.icon size={18} className="text-amber-400/50" />
                    <span className="text-sm text-white/80">{item.label}</span>
                  </Link>
                ))}
              </div>
            )}

            {/* Info links */}
            <div className="pt-2 mt-2 border-t border-white/8">
              <Link to="/about" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/8 transition-colors" onClick={() => setMenuOpen(false)}>
                <span className="text-white/50 text-sm">🍒</span>
                <span className="text-sm text-white/60">About</span>
              </Link>
              <Link to="/help" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/8 transition-colors" onClick={() => setMenuOpen(false)}>
                <span className="text-white/50 text-sm">❓</span>
                <span className="text-sm text-white/60">How to Use</span>
              </Link>
              <Link to="/privacy" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/8 transition-colors" onClick={() => setMenuOpen(false)}>
                <span className="text-white/50 text-sm">🔒</span>
                <span className="text-sm text-white/60">Privacy</span>
              </Link>
              <Link to="/terms" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/8 transition-colors" onClick={() => setMenuOpen(false)}>
                <span className="text-white/50 text-sm">📄</span>
                <span className="text-sm text-white/60">Terms</span>
              </Link>
            </div>

            <p className="text-[9px] text-white/20 text-center py-4">
              {config.app_name} v2.0 • {config.app_city}
            </p>
          </div>
        </div>
      )}

      {/* Spacer for fixed header */}
      <div className="h-14" />
    </>
  )
}
