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
    { path: '/', icon: Home, label: 'Home' },
    { path: '/directory', icon: Search, label: 'ရှာဖွေ' },
    { path: '/community', icon: Users, label: 'Community' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/profile', icon: User, label: 'Profile' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/8 pb-2 pt-1">
      <div className="flex items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.path)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-2xl transition-all duration-200 ${
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
        
        {/* Floating Add Button - Position absolute to center */}
        <div className="relative">
          <NavLink
            to="/submit"
            className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-900/40 border-2 border-white/20 hover:scale-105 transition-transform"
          >
            <PlusCircle size={24} className="text-white" />
          </NavLink>
        </div>
      </div>
      
      {/* Admin Floating Button (Bottom Right) */}
      {(isAdmin || isModerator) && (
        <NavLink
          to="/admin"
          className="fixed bottom-20 right-4 w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shadow-lg hover:bg-amber-500/30 transition-all z-50"
        >
          <Shield size={18} className="text-amber-400" />
        </NavLink>
      )}
    </nav>
  )
}
