import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Crown, Globe, Download } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { usePWA } from '../hooks/usePWA'
import { useAppConfig } from '../hooks/useAppConfig'

function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="font-mono text-xs font-bold text-white/80 tabular-nums">
      {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
    </span>
  )
}

export default function Header() {
  const navigate = useNavigate()
  const { isLoggedIn, profile, isAdmin } = useAuth()
  const { lang, toggleLang } = useLang()
  const { installable, installApp } = usePWA()
  const config = useAppConfig()
  const today = new Date().toLocaleDateString(lang === 'mm' ? 'my-MM' : 'en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  })

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/8">
      <div className="flex justify-between items-center px-4 py-1.5 border-b border-white/5">
        <span className="text-[10px] text-gold-500/70 font-mono tracking-wider">{today}</span>
        <div className="flex items-center gap-2">
          {installable && (
            <button onClick={installApp} className="flex items-center gap-1 text-[10px] text-brand-300 hover:text-brand-200 transition-colors">
              <Download size={11} /> Install
            </button>
          )}
          <button
            onClick={toggleLang}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/8 text-white/60 hover:bg-white/12 hover:text-white transition-all"
          >
            <Globe size={10} />
            {lang === 'mm' ? 'EN' : 'မြ'}
          </button>
          <Clock />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl overflow-hidden border border-white/15 shadow-lg shadow-brand-900/50 flex-shrink-0 bg-[#2a0050]">
            <img src="/logo.png" alt="Cherry Directory" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-display font-bold text-base text-white leading-none tracking-tight">{config.app_name || 'Cherry Directory'}</h1>
            <p className="text-[10px] text-white/40 font-body mt-0.5">{config.app_city || 'တောင်ကြီးမြို့'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <span className="badge bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Crown size={10} /> Admin
            </span>
          )}
          {isLoggedIn ? (
            <button onClick={() => navigate('/profile')} className="w-9 h-9 rounded-xl overflow-hidden border border-white/15 flex items-center justify-center bg-brand-700">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
                : <span className="text-sm font-bold text-white">{profile?.full_name?.[0] || '?'}</span>}
            </button>
          ) : (
            <button onClick={() => navigate('/login')} className="btn-ghost flex items-center gap-1.5 text-xs py-2 px-3">
              <LogIn size={14} /> Login
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
