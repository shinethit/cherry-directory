import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Edit3, Crown, Shield, User, BookMarked, Star, Building2, Bell, BellOff, Download, Trophy, Clock, ChevronRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../hooks/useAppConfig'
import { usePWA } from '../hooks/usePWA'
import { useSEO } from '../hooks/useSEO'
import { usePoints } from '../hooks/usePoints'
import { timeAgo } from '../hooks/usePresence'
import { uploadImage } from '../lib/cloudinary'
import { supabase } from '../lib/supabase'

const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', icon: Crown,  color: 'text-gold-400',   bg: 'bg-gold-500/20 border-gold-500/40' },
  admin:       { label: 'Admin',       icon: Crown,  color: 'text-gold-400',   bg: 'bg-gold-500/15 border-gold-500/30' },
  moderator:   { label: 'Moderator',   icon: Shield, color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/30' },
  member:      { label: 'Member',      icon: User,   color: 'text-brand-300',  bg: 'bg-brand-600/20 border-brand-400/30' },
}

export default function ProfilePage() {
  const navigate  = useNavigate()
  const { profile, isAdmin, isModerator, signOut, updateProfile, user } = useAuth()
  const { lang }  = useLang()
  const config = useAppConfig()
  const { installable, installApp, pushEnabled, enablePush, disablePush } = usePWA()
  const { getHistory } = usePoints()
  useSEO({ title: 'Profile' })

  const [editing, setEditing]     = useState(false)
  const [name, setName]           = useState(profile?.full_name || '')
  const [nickname, setNickname]   = useState(profile?.nickname || '')
  const [bio, setBio]             = useState(profile?.bio || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [myStats, setMyStats]     = useState({ listings: 0, reviews: 0, bookmarks: 0, rsvps: 0 })
  const [recentPoints, setRecentPoints] = useState([])
  const [nickError, setNickError] = useState('')

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const [{ count: l }, { count: r }, { count: b }, { count: rv }, pts] = await Promise.all([
          supabase.from('listings').select('*', { count: 'exact', head: true }).eq('submitted_by', user.id),
          supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('event_rsvps').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          getHistory(5),
        ])
        setMyStats({ listings: l || 0, reviews: r || 0, bookmarks: b || 0, rsvps: rv || 0 })
        setRecentPoints(pts)
      } catch (err) {
        console.warn('Profile stats load failed:', err)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const url = await uploadImage(file, 'avatars')
    await updateProfile({ avatar_url: url })
    setUploading(false)
  }

  async function saveProfile() {
    setNickError('')
    // Validate nickname: alphanumeric + underscore, 3-20 chars
    if (nickname && !/^[a-zA-Z0-9_]{3,20}$/.test(nickname)) {
      setNickError('Nickname: 3-20 chars, letters/numbers/underscore only')
      return
    }
    setSaving(true)
    try {
      await updateProfile({ full_name: name, nickname: nickname || null, bio })
      setEditing(false)
    } catch (err) {
      if (err.message?.includes('unique')) setNickError('Nickname already taken')
    }
    setSaving(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  async function togglePush() {
    setPushLoading(true)
    if (pushEnabled) await disablePush()
    else await enablePush(user?.id)
    setPushLoading(false)
  }

  const role = ROLE_CONFIG[profile?.role || 'member']
  const RoleIcon = role.icon
  const displayName = profile?.nickname ? `@${profile.nickname}` : profile?.full_name || 'User'

  const POINT_LABELS = {
    write_review:     { mm: 'Review ရေး',      en: 'Wrote a review'   },
    submit_listing:   { mm: "လုပ်ငန်း Submit",     en: 'Submitted listing' },
    listing_approved: { mm: "လုပ်ငန်း Approved",   en: 'Listing approved'  },
    rsvp_going:       { mm: 'Event RSVP',       en: 'RSVP to event'    },
    chat_message:     { mm: 'Chat message',     en: 'Chat message'     },
    claim_approved:   { mm: 'Claim Approved',   en: 'Claim approved'   },
  }

  return (
    <div className="py-4 px-4 space-y-4">

      {/* ── Profile card ── */}
      <div className="card-dark p-6 rounded-3xl text-center space-y-3">
        <div className="relative inline-block">
          <label className="cursor-pointer">
            <div className="w-20 h-20 rounded-3xl bg-brand-700 border-2 border-brand-400/30 flex items-center justify-center overflow-hidden mx-auto">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : <span className="text-3xl font-bold text-white">{profile?.full_name?.[0] || '?'}</span>
              }
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-3xl">
              <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center border-2 border-[#0d0015] text-[10px]">✏️</div>
        </div>

        {editing ? (
          <div className="space-y-2 text-left">
            <div>
              <label className="block text-[10px] text-white/40 mb-1">{lang === 'mm' ? 'နာမည်' : 'Full Name'}</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-dark text-sm" />
            </div>
            <div>
              <label className="block text-[10px] text-white/40 mb-1">
                Nickname <span className="text-white/25 font-normal">(optional · shown as @name)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">@</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={e => { setNickname(e.target.value.toLowerCase()); setNickError('') }}
                  className="input-dark text-sm pl-7"
                  placeholder="yourname"
                  maxLength={20}
                />
              </div>
              {nickError && <p className="text-[10px] text-red-400 mt-1">{nickError}</p>}
              <p className="text-[9px] text-white/25 mt-1">Letters, numbers, underscore only. 3-20 chars.</p>
            </div>
            <div>
              <label className="block text-[10px] text-white/40 mb-1">Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} className="input-dark text-sm resize-none h-16 font-myanmar" placeholder="Bio..." maxLength={200} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveProfile} disabled={saving} className="btn-primary flex-1 text-sm">
                {saving ? '...' : lang === 'mm' ? 'Save' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setNickError('') }} className="btn-ghost flex-1 text-sm">
                {lang === 'mm' ? 'Cancel' : 'Cancel'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <h2 className="font-display font-bold text-xl text-white">{profile?.full_name || 'User'}</h2>
              {profile?.nickname && (
                <p className="text-sm text-brand-300 font-mono mt-0.5">@{profile.nickname}</p>
              )}
              {profile?.bio && <p className="text-xs text-white/50 mt-1 font-myanmar">{profile.bio}</p>}
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className={`badge border ${role.bg} ${role.color}`}>
                <RoleIcon size={11} /> {role.label}
              </span>
              {(profile?.points || 0) > 0 && (
                <span className="badge bg-gold-500/15 text-gold-400 border border-gold-500/25">
                  <Trophy size={10} /> {(profile.points || 0).toLocaleString()} pts
                </span>
              )}
            </div>
            {profile?.last_seen && (
              <p className="text-[10px] text-white/25">
                <Clock size={9} className="inline mr-1" />
                {timeAgo(profile.last_seen, lang)}
              </p>
            )}
            <button onClick={() => setEditing(true)} className="btn-ghost text-sm flex items-center gap-2 mx-auto">
              <Edit3 size={14} /> {lang === 'mm' ? 'Profile ပြင်မယ်' : 'Edit Profile'}
            </button>
          </>
        )}
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Building2,    label: lang === 'mm' ? 'လုပ်ငန်း' : 'Listings',  value: myStats.listings,  action: () => navigate('/directory') },
          { icon: Star,         label: 'Reviews',                               value: myStats.reviews   },
          { icon: BookMarked,   label: lang === 'mm' ? 'Saved' : 'Saved',      value: myStats.bookmarks, action: () => navigate('/bookmarks') },
          { icon: Trophy,       label: 'Points',                                value: profile?.points || 0, highlight: true },
        ].map(({ icon: Icon, label, value, action, highlight }) => (
          <button key={label} onClick={action} disabled={!action} className={`card-dark p-3 rounded-2xl text-center ${action ? 'hover:bg-white/8 transition-colors' : ''}`}>
            <Icon size={15} className={`mx-auto mb-1 ${highlight ? 'text-gold-400' : 'text-brand-300'}`} />
            <p className={`font-display font-bold text-base ${highlight ? 'text-gold-400' : 'text-white'}`}>{(value || 0).toLocaleString()}</p>
            <p className="text-[8px] text-white/40">{label}</p>
          </button>
        ))}
      </div>

      {/* ── Recent points ── */}
      {recentPoints.length > 0 && (
        <div className="card-dark rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-display font-bold text-white/50 uppercase tracking-wider">Recent Points</p>
            <button onClick={() => navigate('/leaderboard')} className="text-[10px] text-brand-300 hover:text-brand-200">
              Leaderboard →
            </button>
          </div>
          <div className="space-y-2">
            {recentPoints.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-xs font-mono text-green-400 font-bold w-8 text-right">+{p.points}</span>
                <p className="text-[11px] text-white/50 flex-1">
                  {(POINT_LABELS[p.action]?.[lang] || p.action)}
                </p>
                <span className="text-[9px] text-white/20">{timeAgo(p.created_at, lang)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Settings ── */}
      <div className="space-y-2">
        <p className="text-[10px] text-white/30 font-display font-semibold uppercase tracking-wider px-1">
          {lang === 'mm' ? 'Settings' : 'Settings'}
        </p>

        {'Notification' in window && (
          <button onClick={togglePush} disabled={pushLoading} className="w-full flex items-center gap-3 p-4 card-dark rounded-2xl hover:bg-white/8 transition-colors">
            {pushEnabled ? <Bell size={18} className="text-brand-300" /> : <BellOff size={18} className="text-white/40" />}
            <div className="text-left flex-1">
              <p className="text-sm font-display font-semibold text-white">Push Notifications</p>
              <p className="text-xs text-white/40">{pushEnabled ? (lang === 'mm' ? 'ဖွင့်ထားသည်' : 'Enabled') : (lang === 'mm' ? 'ပိတ်ထားသည်' : 'Disabled')}</p>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${pushEnabled ? 'bg-brand-500' : 'bg-white/15'}`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${pushEnabled ? 'translate-x-4' : ''}`} />
            </div>
          </button>
        )}

        {installable && (
          <button onClick={installApp} className="w-full flex items-center gap-3 p-4 card-dark rounded-2xl hover:bg-white/8 transition-colors">
            <Download size={18} className="text-brand-300" />
            <div className="text-left flex-1">
              <p className="text-sm font-display font-semibold text-white">{lang === 'mm' ? 'App တင်မည်' : 'Install App'}</p>
              <p className="text-xs text-white/40">{lang === 'mm' ? 'Home screen မှာ ထည့်မည်' : 'Add to home screen'}</p>
            </div>
          </button>
        )}
      </div>

      {/* ── Quick links ── */}
      <div className="space-y-2">
        <p className="text-[10px] text-white/30 font-display font-semibold uppercase tracking-wider px-1">
          {lang === 'mm' ? 'အမြန်လင့်' : 'Quick Links'}
        </p>

        {[
          { icon: Trophy,    label: 'Top Contributors', labelMm: 'Top Contributors', path: '/leaderboard', color: 'text-gold-400' },
          { icon: BookMarked,label: 'Saved Items',      labelMm: 'Saved Items',      path: '/bookmarks',  color: 'text-brand-300' },
          { icon: Building2, label: 'Add Listing',      labelMm: 'လုပ်ငန်းထည့်မည်',  path: '/submit',     color: 'text-brand-300' },
          ...(isModerator ? [{ icon: Shield, label: 'Admin Panel', labelMm: 'Admin Panel', path: '/admin', color: 'text-amber-400' }] : []),
        ].map(({ icon: Icon, label, labelMm, path, color }) => (
          <button key={path} onClick={() => navigate(path)} className="w-full flex items-center gap-3 p-4 card-dark rounded-2xl hover:bg-white/8 transition-colors">
            <Icon size={18} className={color} />
            <p className="text-sm font-display font-semibold text-white flex-1 text-left">
              {lang === 'mm' ? labelMm : label}
            </p>
            <ChevronRight size={16} className="text-white/20" />
          </button>
        ))}

        <button onClick={handleSignOut} className="w-full flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl hover:bg-red-500/15 transition-colors">
          <LogOut size={18} className="text-red-400" />
          <p className="text-sm font-display font-semibold text-red-300">
            {lang === 'mm' ? 'Logout ထွက်မည်' : 'Sign Out'}
          </p>
        </button>
      </div>

      {/* ── App info footer ── */}
      <div className="px-4 pt-2">
        <div className="grid grid-cols-2 gap-2">
          {[
            { path: '/help',    icon: '❓', labelMm: 'သုံးစွဲနည်း',        labelEn: 'How to Use'    },
            { path: '/about',   icon: '🍒', labelMm: 'ကျွန်ုပ်တို့အကြောင်း', labelEn: 'About Us'      },
            { path: '/privacy', icon: '🔒', labelMm: 'ကိုယ်ရေးလုံခြုံမှု',  labelEn: 'Privacy Policy' },
            { path: '/terms',   icon: '📄', labelMm: 'စည်းမျဉ်းများ',       labelEn: 'Terms of Service' },
          ].map(({ path, icon, labelMm, labelEn }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex items-center gap-2 p-3 card-dark rounded-2xl hover:bg-white/6 transition-colors"
            >
              <span className="text-base">{icon}</span>
              <p className="text-xs text-white/50 font-myanmar">{lang === 'mm' ? labelMm : labelEn}</p>
            </button>
          ))}
        </div>
        <p className="text-center text-[10px] text-white/20 mt-4 mb-2">
          {config.app_name || 'Cherry Directory'} • {config.app_city || 'Taunggyi'} © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
