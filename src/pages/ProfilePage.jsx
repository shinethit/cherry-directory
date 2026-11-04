import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Sparkles, MapPin, LogOut, Edit3, Crown, Shield, User, BookMarked, Star, Building2, Bell, BellOff, Download, Trophy, Clock, ChevronRight, Calendar } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../contexts/AppConfigContext'
import { usePWA } from '../hooks/usePWA'
import { useSEO } from '../hooks/useSEO'
import { timeAgo } from '../hooks/usePresence'
import { uploadImage } from '../lib/cloudinary'
import { supabase } from '../lib/supabase'
import { showError } from '../lib/toast'
import OfflineCachePanel from '../components/OfflineCachePanel'
import TierBadge from '../components/TierBadge'

const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', icon: Crown,  color: 'text-gold-400',   bg: 'bg-gold-500/20 border-gold-500/40' },
  admin:       { label: 'Admin',       icon: Crown,  color: 'text-gold-400',   bg: 'bg-gold-500/15 border-gold-500/30' },
  moderator:   { label: 'Moderator',   icon: Shield, color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/30' },
  member:      { label: 'Member',      icon: User,   color: 'text-brand-300',  bg: 'bg-brand-600/20 border-brand-400/30' },
}

export default function ProfilePage() {
  const navigate  = useNavigate()
  const { id: profileId } = useParams()
  const { profile, isAdmin, isModerator, signOut, updateProfile, user, isLoggedIn } = useAuth()
  const { lang }  = useLang()
  const config = useAppConfig()
  const { installable, installApp, pushEnabled, enablePush, disablePush } = usePWA()
  useSEO({ title: 'Profile' })

  // /profile/:id (C-4): when :id is someone else's id, this page is their
  // public profile — read-only. Owner-only controls (Edit / Sign Out /
  // Settings / Offline panel) are hidden for other users' profiles.
  const isOther = !!profileId && profileId !== user?.id
  const [otherProfile, setOtherProfile] = useState(null)
  const [otherLoading, setOtherLoading] = useState(isOther)
  const [otherError, setOtherError] = useState('')
  // Public profile extras (F9): the other user's review count + listings.
  const [otherReviews, setOtherReviews] = useState(0)
  const [otherListings, setOtherListings] = useState([])

  useEffect(() => {
    if (!isOther) return
    let cancelled = false
    async function loadOther() {
      setOtherLoading(true)
      setOtherError('')
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, nickname, bio, avatar_url, points, role, last_seen')
          .eq('id', profileId)
          .single()
        if (error) throw error
        if (!cancelled) setOtherProfile(data)
        // Review count + approved listings for the public profile (F9).
        // Best-effort: a failure here must not break the profile itself.
        const [rc, lc] = await Promise.allSettled([
          supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', profileId),
          supabase.from('listings').select('id, name, name_mm, address, address_mm, cover_url, logo_url').eq('submitted_by', profileId).eq('status', 'approved').order('created_at', { ascending: false }).limit(10),
        ])
        if (!cancelled) {
          if (rc.status === 'fulfilled') setOtherReviews(rc.value?.count || 0)
          if (lc.status === 'fulfilled') setOtherListings(lc.value?.data || [])
        }
      } catch (err) {
        console.warn('Other profile load failed:', err)
        if (!cancelled) setOtherError(err?.message || 'Profile မတွေ့ပါ')
      } finally {
        if (!cancelled) setOtherLoading(false)
      }
    }
    loadOther()
    return () => { cancelled = true }
  }, [isOther, profileId])

  // The profile on display: someone else's (read-only) or the signed-in user's.
  const viewed = isOther ? otherProfile : profile

  const [editing, setEditing]     = useState(false)
  const [name, setName]           = useState(profile?.full_name || '')
  const [nickname, setNickname]   = useState(profile?.nickname || '')
  const [bio, setBio]             = useState(profile?.bio || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [myStats, setMyStats]     = useState({ listings: 0, reviews: 0, bookmarks: 0, rsvps: 0 })
  const [statsError, setStatsError] = useState('')
  const [nickError, setNickError] = useState('')

  // Profile loads async — the mount-time useState initializers above run
  // before it arrives. Sync the fields when it lands, so saving cannot
  // wipe them with ''. Only sync while not editing, to never clobber
  // text the user is typing.
  useEffect(() => {
    if (!profile || editing) return
    setName(profile.full_name || '')
    setNickname(profile.nickname || '')
    setBio(profile.bio || '')
  }, [profile, editing])

  // Stats are the signed-in user's own counts (never another user's).
  // allSettled: one failing count must not zero out the other three
  // (F-MED-5). A failure shows a retry affordance instead of silent 0s.
  async function loadStats() {
    if (!user) return
    setStatsError('')
    const results = await Promise.allSettled([
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('submitted_by', user.id),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('event_rsvps').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    ])
    const countOf = (r) => (r.status === 'fulfilled' ? (r.value?.count || 0) : 0)
    setMyStats({
      listings: countOf(results[0]),
      reviews: countOf(results[1]),
      bookmarks: countOf(results[2]),
      rsvps: countOf(results[3]),
    })
    const failed = results.find(r => r.status === 'rejected')
    if (failed) {
      console.warn('Profile stats load partially failed:', failed.reason)
      setStatsError(failed.reason?.message || 'Stats အချို့ ရယူမရပါ')
    }
  }

  useEffect(() => {
    if (!user || isOther) return
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOther])

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // Avatar size limit (F16): the upload helper enforces none, so
    // check here — the 2MB cap and the note below must match.
    if (file.size > 2 * 1024 * 1024) {
      showError('ပုံ အများဆုံး 2MB သာ တင်နိုင်ပါသည် — ပုံသေးသေးလေး ရွေးပါ')
      e.target.value = ''
      return
    }
    setUploading(true)
    try {
      const url = await uploadImage(file, 'avatars')
      await updateProfile({ avatar_url: url })
    } catch (err) {
      console.warn('Avatar upload failed:', err)
      showError(err?.message || 'Avatar တင်မရပါ — ထပ်ကြိုးစားပါ')
    } finally {
      setUploading(false)
    }
  }

  async function saveProfile() {
    setNickError('')
    if (nickname && !/^[a-zA-Z0-9_]{3,20}$/.test(nickname)) {
      setNickError('Nickname: အက္ခရာ ၃-၂၀ လုံး၊ စာလုံး/ဂဏန်း/underscore (_) သာ')
      return
    }
    setSaving(true)
    try {
      await updateProfile({ full_name: name, nickname: nickname || null, bio })
      setEditing(false)
    } catch (err) {
      // Surface ALL errors, not only unique-constraint ones.
      const msg = err?.message || 'Profile သိမ်းမရပါ'
      if (err.message?.includes('unique')) setNickError('ဒီ Nickname ကို တစ်ယောက်ယောက် သုံးထားပြီးပါပြီ')
      else setNickError(msg)
      showError(msg)
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

  const role = ROLE_CONFIG[viewed?.role || 'member']
  const RoleIcon = role.icon
  const displayName = viewed?.nickname ? `@${viewed.nickname}` : viewed?.full_name || 'User'

  // Guests need to sign in to see their own profile (F-MED-4) — the same
  // "Login Required" gate the sibling pages use. Another user's public
  // profile stays viewable without login.
  if (!isLoggedIn && !isOther) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70dvh] px-8 text-center">
        <User size={48} className="text-brand-400 mb-4" />
        <h2 className="font-display font-bold text-xl text-white mb-2">
          {lang === 'mm' ? 'Login လိုအပ်သည်' : 'Login Required'}
        </h2>
        <p className="text-white/50 font-myanmar mb-6">
          {lang === 'mm' ? 'Profile ကြည့်ရန် Login ဝင်ပါ' : 'Sign in to see your profile'}
        </p>
        <button onClick={() => navigate('/login')} className="btn-primary">
          {lang === 'mm' ? 'Login ဝင်ရောက်မည်' : 'Sign In'}
        </button>
      </div>
    )
  }

  if (isOther && otherLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh]">
        <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isOther && (otherError || !otherProfile)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70dvh] px-8 text-center">
        <User size={48} className="text-white/20 mb-4" />
        <h2 className="font-display font-bold text-xl text-white mb-2">
          {lang === 'mm' ? 'Profile မတွေ့ပါ' : 'Profile not found'}
        </h2>
        <p className="text-white/50 font-myanmar mb-6">{otherError}</p>
        <button onClick={() => navigate('/leaderboard')} className="btn-primary">
          {lang === 'mm' ? 'Leaderboard သို့ ပြန်မည်' : 'Back to Leaderboard'}
        </button>
      </div>
    )
  }

  return (
    <div className="py-4 px-4 space-y-4">

      {/* ── Profile card ── */}
      <div className="card-dark p-6 rounded-3xl text-center space-y-3">
        <div className="relative inline-block">
          {isOther ? (
            <div className="w-20 h-20 rounded-3xl bg-brand-700 border-2 border-brand-400/30 flex items-center justify-center overflow-hidden mx-auto">
              {viewed?.avatar_url
                ? <img src={viewed.avatar_url} alt="" className="w-full h-full object-cover" />
                : <span className="text-3xl font-bold text-white">{viewed?.full_name?.[0] || '?'}</span>
              }
            </div>
          ) : (
          <label className="cursor-pointer">
            <div className="w-20 h-20 rounded-3xl bg-brand-700 border-2 border-brand-400/30 flex items-center justify-center overflow-hidden mx-auto">
              {viewed?.avatar_url
                ? <img src={viewed.avatar_url} alt="" className="w-full h-full object-cover" />
                : <span className="text-3xl font-bold text-white">{viewed?.full_name?.[0] || '?'}</span>
              }
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-3xl">
              <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!isOther && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center border-2 border-[#0d0015] text-[10px]">✏️</div>}
        </div>
        {/* Avatar tap target is the 80px photo itself (F16) — the note
            below states the 2MB limit the upload check enforces. */}
        {!isOther && !editing && (
          <p className="text-[10px] text-white/60 font-myanmar">Avatar ပြောင်းရန် ပုံကို နှိပ်ပါ · ပုံ အများဆုံး 2MB</p>
        )}

        {editing ? (
          <div className="space-y-2 text-left">
            <div>
              <label className="block text-[10px] text-white/60 mb-1">{lang === 'mm' ? 'နာမည်' : 'Full Name'}</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-dark" />
            </div>
            <div>
              <label className="block text-[10px] text-white/60 mb-1">
                Nickname <span className="text-white/60 font-normal">(optional · shown as @name)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-sm">@</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={e => { setNickname(e.target.value.toLowerCase()); setNickError('') }}
                  className="input-dark pl-7"
                  placeholder="yourname"
                  maxLength={20}
                />
              </div>
              {nickError && <p className="text-[10px] text-red-400 mt-1">{nickError}</p>}
              <p className="text-[9px] text-white/60 mt-1">စာလုံး၊ ဂဏန်း၊ underscore (_) သာ — ၃ မှ ၂၀ လုံးအထိ။</p>
            </div>
            <div>
              <label className="block text-[10px] text-white/60 mb-1">Bio</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} className="input-dark resize-none h-16 font-myanmar" placeholder="Bio..." maxLength={200} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveProfile} disabled={saving} className="btn-primary flex-1 text-sm">
                {saving ? '...' : lang === 'mm' ? 'Save' : 'Save'}
              </button>
              {/* Cancel restores the original values (F7 / FB-13) — closing
                  edit mode alone left the edited text in the form. */}
              <button onClick={() => { setName(profile?.full_name || ''); setNickname(profile?.nickname || ''); setBio(profile?.bio || ''); setEditing(false); setNickError('') }} className="btn-ghost flex-1 text-sm">
                {lang === 'mm' ? 'Cancel' : 'Cancel'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <h2 className="font-display font-bold text-xl text-white">{viewed?.full_name || 'User'}</h2>
              {viewed?.nickname && (
                <p className="text-sm text-brand-300 font-mono mt-0.5">@{viewed.nickname}</p>
              )}
              {viewed?.bio && <p className="text-xs text-white/50 mt-1 font-myanmar">{viewed.bio}</p>}
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className={`badge border ${role.bg} ${role.color}`}>
                <RoleIcon size={11} /> {role.label}
              </span>
              {/* Tier badge always renders — even at 0 points (tier 0 /
                  Bronze), a user must see their tier (F-LOW-2). */}
              {/* Points with label + link to the Points Guide (F18). */}
              <button onClick={() => navigate('/points')} className="badge bg-gold-500/15 text-gold-400 border border-gold-500/25 hover:bg-gold-500/25 transition-colors">
                <Trophy size={10} /> {lang === 'mm' ? `အမှတ်: ${(viewed?.points || 0).toLocaleString()} မှတ်` : `Points: ${(viewed?.points || 0).toLocaleString()}`}
              </button>
              <TierBadge points={viewed?.points || 0} size="sm" lang={lang} />
            </div>
            {viewed?.last_seen && (
              <p className="text-[10px] text-white/60">
                <Clock size={9} className="inline mr-1" />
                {timeAgo(viewed.last_seen, lang)}
              </p>
            )}
            {!isOther && (
              <button onClick={() => setEditing(true)} className="btn-ghost text-sm flex items-center gap-2 mx-auto">
                <Edit3 size={14} /> {lang === 'mm' ? 'Profile ပြင်မယ်' : 'Edit Profile'}
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Public profile extras (F9): review count + listings ── */}
      {isOther && (
      <div className="card-dark p-4 rounded-3xl space-y-3">
        <div className="flex items-center gap-2">
          <Star size={15} className="text-gold-400" />
          <p className="text-sm font-display font-semibold text-white">
            {lang === 'mm' ? `Reviews ${otherReviews} ခု` : `Reviews: ${otherReviews}`}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-white/60 font-display font-semibold uppercase tracking-wider px-1 mb-2">
            {lang === 'mm' ? 'တင်ထားသော လုပ်ငန်းများ' : 'Listings'}
          </p>
          {otherListings.length === 0 ? (
            <p className="text-xs text-white/60 font-myanmar px-1">{lang === 'mm' ? 'လုပ်ငန်း မတင်ထားသေးပါ' : 'No listings yet'}</p>
          ) : (
            <div className="space-y-2">
              {otherListings.map(l => (
                <button key={l.id} onClick={() => navigate(`/directory/${l.id}`)} className="w-full flex items-center gap-3 p-2 rounded-2xl hover:bg-white/6 transition-colors text-left">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {(l.cover_url || l.logo_url)
                      ? <img src={l.cover_url || l.logo_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      : <Building2 size={16} className="text-white/30" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate font-myanmar">{lang === 'mm' ? (l.name_mm || l.name) : l.name}</p>
                    {(l.address_mm || l.address) && (
                      <p className="text-[11px] text-white/60 truncate font-myanmar">{lang === 'mm' ? (l.address_mm || l.address) : (l.address || l.address_mm)}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-white/20 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── Stats grid (own profile only) ── */}
      {!isOther && (
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Building2,    label: lang === 'mm' ? 'လုပ်ငန်း' : 'Listings',  value: myStats.listings,  action: () => navigate('/my-submissions') },
          { icon: Star,         label: 'Reviews',                               value: myStats.reviews,  action: () => navigate('/my-reviews') },
          { icon: BookMarked,   label: lang === 'mm' ? 'သိမ်းထားသော' : 'Saved',      value: myStats.bookmarks, action: () => navigate('/bookmarks') },
          { icon: Calendar,     label: lang === 'mm' ? 'RSVP' : 'RSVPs',       value: myStats.rsvps,    action: () => navigate('/my-rsvps') },
        ].map(({ icon: Icon, label, value, action, highlight }) => (
          action ? (
            <button key={label} onClick={action} className="card-dark p-3 rounded-2xl text-center hover:bg-white/8 transition-colors">
              <Icon size={15} className={`mx-auto mb-1 ${highlight ? 'text-gold-400' : 'text-brand-300'}`} />
              <p className={`font-display font-bold text-base ${highlight ? 'text-gold-400' : 'text-white'}`}>{(value || 0).toLocaleString()}</p>
              <p className="text-[8px] text-white/60">{label}</p>
            </button>
          ) : (
            // F8 (v9.5): Reviews now has a dedicated page (/my-reviews),
            // so the stat is a button like the others.
            <div key={label} className="card-dark p-3 rounded-2xl text-center">
              <Icon size={15} className="mx-auto mb-1 text-brand-300" />
              <p className="font-display font-bold text-base text-white">{(value || 0).toLocaleString()}</p>
              <p className="text-[8px] text-white/60">{label}</p>
            </div>
          )
        ))}
      </div>
      )}
      {!isOther && statsError && (
        <button onClick={loadStats} className="w-full text-center text-[11px] text-amber-400 font-myanmar hover:text-amber-300 transition-colors">
          ⚠️ {statsError} — {lang === 'mm' ? 'ထပ်ကြိုးစားမည်' : 'Retry'}
        </button>
      )}


      {/* ── Settings (own profile only) ── */}
      {!isOther && (
      <div className="space-y-2">
        <p className="text-[10px] text-white/60 font-display font-semibold uppercase tracking-wider px-1">
          {lang === 'mm' ? 'Settings' : 'Settings'}
        </p>

        {'Notification' in window && (
          <button onClick={togglePush} disabled={pushLoading} className="w-full flex items-center gap-3 p-4 card-dark rounded-2xl hover:bg-white/8 transition-colors">
            {pushEnabled ? <Bell size={18} className="text-brand-300" /> : <BellOff size={18} className="text-white/40" />}
            <div className="text-left flex-1">
              <p className="text-sm font-display font-semibold text-white">Push Notifications</p>
              <p className="text-xs text-white/60">{pushEnabled ? (lang === 'mm' ? 'ဖွင့်ထားသည်' : 'Enabled') : (lang === 'mm' ? 'ပိတ်ထားသည်' : 'Disabled')}</p>
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
              <p className="text-xs text-white/60">{lang === 'mm' ? 'Home screen မှာ ထည့်မည်' : 'Add to home screen'}</p>
            </div>
          </button>
        )}
      </div>
      )}

      {/* ── Quick links (own profile only) ── */}
      {!isOther && (
      <div className="space-y-2">
        <p className="text-[10px] text-white/60 font-display font-semibold uppercase tracking-wider px-1">
          {lang === 'mm' ? 'အမြန်လင့်' : 'Quick Links'}
        </p>

        {[
          { icon: Trophy,    label: 'Top Contributors', labelMm: 'Top Contributors', path: '/leaderboard', color: 'text-gold-400' },
          { icon: Sparkles,  label: 'Points Guide',     labelMm: 'Points လမ်းညွှန်',  path: '/points',      color: 'text-gold-400' },
          { icon: BookMarked,label: 'Saved Items',      labelMm: 'သိမ်းထားသော',      path: '/bookmarks',  color: 'text-brand-300' },
          { icon: MapPin,     label: 'Saved Places',     labelMm: 'သိမ်းထားသောနေရာများ', path: '/saved-places', color: 'text-emerald-300' },
          { icon: Calendar,   label: 'My RSVPs',          labelMm: 'တက်မည့် ဖြစ်ရပ်များ',  path: '/my-rsvps',   color: 'text-green-300' },
          { icon: Building2, label: 'My Submissions',  labelMm: 'ကျွန်တော့်တင်ထားသောများ', path: '/my-submissions', color: 'text-amber-300' },
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
      )}

      {/* ── Offline Cache (own profile only) ── */}
      {!isOther && (
      <div className="space-y-2">
        <p className="text-[10px] text-white/60 font-display font-semibold uppercase tracking-wider px-1">
          {lang === 'mm' ? 'အော့ဖ်လိုင်း' : 'Offline'}
        </p>
        <OfflineCachePanel />
      </div>
      )}

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
        <p className="text-center text-[10px] text-white/60 mt-4 mb-2">
          {config.app_name || 'Cherry Directory'} • {config.app_city || 'Taunggyi'} © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}