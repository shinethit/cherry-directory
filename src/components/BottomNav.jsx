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
    { path: '/community', icon: Users, label: 'အသိုင်းအဝိုင်း' },
    { path: '/', icon: Home, label: 'ပင်မ', isCenter: true },
    { path: '/calendar', icon: Calendar, label: 'ပြက္ခဒိန်' },
    { path: '/profile', icon: User, label: 'ပရိုဖိုင်' },
  ]

  return (
    <>
      {/* Floating Add Button — v9.14: hidden on /chat (the composer lives
          there; the button covered it). BottomNav already reads the route
          via useLocation for active states. */}
      {location.pathname !== '/chat' && (
      <NavLink
        to="/submit"
        aria-label="လုပ်ငန်း တင်မည်"
        className="fixed left-4 z-50 h-12 px-3 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center gap-1.5 shadow-lg shadow-brand-900/40 border-2 border-white/20 hover:scale-105 transition-transform"
        style={{ bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 12px)' }}
      >
        <PlusCircle size={22} className="text-white flex-shrink-0" />
        <span className="text-xs font-bold text-white">တင်မည်</span>
      </NavLink>
      )}

      {/* Admin Floating Button */}
      {(isAdmin || isModerator) && (
        <NavLink
          to="/admin"
          aria-label="Admin Panel"
          className="fixed right-4 z-50 h-10 px-3 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center gap-1.5 shadow-lg hover:bg-amber-500/30 transition-all"
          style={{ bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 12px)' }}
        >
          <Shield size={16} className="text-amber-400 flex-shrink-0" />
          <span className="text-xs font-bold text-amber-400">Admin</span>
        </NavLink>
      )}

      {/* Bottom Navigation Bar – v9.14: sticky (last child of the App
          flex column) + solid bg-[#140020] instead of fixed 95% glass,
          so content never shows through and the bar can't jump.
          v9.20: FIXED height = var(--nav-h) + safe-area (was content-sized
          — the long label အသိုင်းအဝိုင်း wrapped to two lines, the nav grew
          ~16px, and the FABs' hard-coded 5rem bottom put them ON the nav).
          Labels are whitespace-nowrap + shrink-0 so the height can never
          depend on wrapping again; the FABs derive their bottom from the
          same --nav-h, so the two can never drift apart. */}
      <nav
        className="sticky bottom-0 z-40 bg-[#140020] border-t border-white/8"
        style={{ height: 'calc(var(--nav-h) + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-md mx-auto">
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
                    <div className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-2xl border-b-2 transition-all duration-200 ${
                      active
                        ? 'text-brand-300 bg-brand-600/30 shadow-lg shadow-brand-900/30 border-brand-400'
                        : 'text-white/60 hover:text-white/80 border-transparent'
                    }`}>
                      <Icon size={28} strokeWidth={active ? 2.5 : 1.8} />
                      <span className={`text-nav text-xs font-medium mt-0.5 whitespace-nowrap shrink-0 ${active ? 'font-bold' : ''}`}>{item.label}</span>
                    </div>
                  </NavLink>
                )
              }
              
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 py-2 px-2 rounded-2xl border-b-2 transition-all duration-200 ${
                      active
                        ? 'text-brand-300 bg-brand-600/20 border-brand-400'
                        : 'text-white/60 hover:text-white/80 border-transparent'
                    }`
                  }
                >
                  <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                  <span className={`text-nav text-xs font-medium whitespace-nowrap shrink-0 ${active ? 'font-bold' : ''}`}>{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}