import { NavLink, useLocation } from 'react-router-dom'
import { Home, Search, Calendar, Users, User, MessageCircle, PlusCircle } from 'lucide-react'

export default function BottomNav() {
  const location = useLocation()
  
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/directory', icon: Search, label: 'ရှာဖွေ' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/community', icon: Users, label: 'Community' },
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
        
        {/* Quick Add Button */}
        <NavLink
          to="/submit"
          className="flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-2xl transition-all duration-200 text-white/40 hover:text-white/70"
        >
          <PlusCircle size={22} className="text-brand-400" />
          <span className="text-[10px] font-medium">ထည့်</span>
        </NavLink>
      </div>
    </nav>
  )
}
