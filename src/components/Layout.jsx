import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Home, Search, CalendarDays, Users, Newspaper, ShieldCheck, Plus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { usePresence } from '../hooks/usePresence'
import Header from './Header'
import PWAInstallBanner from './PWAInstallBanner'

const NAV = [
  { path: '/',           icon: Home,         labelMm: 'ပင်မ',      labelEn: 'Home'      },
  { path: '/news',       icon: Newspaper,    labelMm: 'သတင်း',    labelEn: 'News'      },
  { path: '/calendar',   icon: CalendarDays, labelMm: 'Calendar',  labelEn: 'Events',   center: true },
  { path: '/community',  icon: Users,        labelMm: 'Community', labelEn: 'Community' },
  { path: '/directory',  icon: Search,       labelMm: 'ရှာဖွေ',    labelEn: 'Search'    },
]

export default function Layout() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { isLoggedIn, isModerator } = useAuth()
  const lang = localStorage.getItem('cd_lang') || 'mm'
  usePresence()  // app-wide online tracking

  // Community sub-paths count as /community active
  const communityPaths = ['/community','/prices','/power','/fuel','/lost-found','/jobs','/bus','/notices','/weather','/donations','/tours']

  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto relative">
      <Header />
      <main className="flex-1 pb-24 pt-2 page-enter">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50">
        <div className="glass border-t border-white/8 px-2 pb-safe">
          <div className="flex items-end justify-around py-2">
            {NAV.map(({ path, icon: Icon, labelMm, labelEn, center }) => {
              const active = path === '/'
                ? location.pathname === '/'
                : path === '/community'
                ? communityPaths.some(p => location.pathname.startsWith(p))
                : location.pathname.startsWith(path)
              const label = lang === 'mm' ? labelMm : labelEn

              if (center) return (
                <button key={path} onClick={() => navigate(path)} className="relative -mt-5 flex flex-col items-center">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200 ${active ? 'bg-gold-500 shadow-gold-500/30' : 'bg-brand-600 shadow-brand-900/40'}`}>
                    <Icon size={24} className="text-white" />
                  </div>
                  <span className={`text-[9px] mt-1 font-display font-semibold ${active ? 'text-gold-400' : 'text-white/40'}`}>{label}</span>
                </button>
              )
              return (
                <button key={path} onClick={() => navigate(path)} className={`nav-item ${active ? 'active' : ''}`}>
                  <Icon size={20} />
                  <span className="text-[9px] font-display font-semibold">{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {/* FABs — hidden on submit/edit/admin pages to avoid overlap */}
      {isLoggedIn && !location.pathname.startsWith('/submit') && !location.pathname.startsWith('/edit') && (
        <button onClick={() => navigate('/submit')} className="fixed bottom-24 right-4 w-12 h-12 rounded-2xl btn-primary flex items-center justify-center shadow-xl shadow-brand-900/50 z-40">
          <Plus size={22} />
        </button>
      )}
      {isModerator && !location.pathname.startsWith('/admin') && !location.pathname.startsWith('/submit') && !location.pathname.startsWith('/edit') && (
        <button onClick={() => navigate('/admin')} className="fixed bottom-40 left-4 w-12 h-12 rounded-2xl bg-amber-600/80 flex items-center justify-center shadow-xl z-40">
          <ShieldCheck size={20} className="text-white" />
        </button>
      )}

      <PWAInstallBanner />
    </div>
  )
}
