import { NavLink, useLocation } from 'react-router-dom'
import { Home, Search, Calendar, Users, User, PlusCircle, Shield } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function BottomNav() {
  const location = useLocation()
  const { isAdmin, isModerator } = useAuth()
  
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const navItems = [
    { path: '/directory', icon: Search, label: 'ရှာဖွေ' },
    { path: '/community', icon: Users, label: 'Community' },
    { path: '/', icon: Home, label: 'Home', isCenter: true },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/profile', icon: User, label: 'Profile' },
  ]

  return (
    <>
      {/* Floating Add Button - Bottom Left */}
      <NavLink
        to="/submit"
        className="fixed left-4 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-900/40 border-2 border-white/20 hover:scale-105 transition-transform"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <PlusCircle size={24} className="text-white" />
      </NavLink>

      {/* Admin Floating Button - Bottom Right */}
      {(isAdmin || isModerator) && (
        <NavLink
          to="/admin"
          className="fixed right-4 z-50 w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shadow-lg hover:bg-amber-500/30 transition-all"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        >
          <Shield size={18} className="text-amber-400" />
        </NavLink>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-white/8 pb-2 pt-2" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-around px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            
            if (item.isCenter) {
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="relative -top-4"
                >
                  <div className={`flex flex-col items-center gap-0.5 py-2 px-4 rounded-2xl transition-all duration-200 ${
                    active
                      ? 'text-brand-400 bg-brand-600/30 shadow-lg shadow-brand-900/30'
                      : 'text-white/40 hover:text-white/70'
                  }`}>
                    <Icon size={28} strokeWidth={active ? 2.5 : 1.8} />
                    <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
                  </div>
                </NavLink>
              )
            }
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 px-3 rounded-2xl transition-all duration-200 ${
                    active
                      ? 'text-brand-400 bg-brand-600/20'
                      : 'text-white/40 hover:text-white/70'
                  }`
                }
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </>
  )
}