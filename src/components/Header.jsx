import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Menu, X, User, LogOut, Settings, Shield, Bell, Home, Bookmark, Trophy, MessageCircle, Calendar, Users, Search, Info, Siren, LayoutGrid, Upload, BarChart3, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../contexts/AppConfigContext'
import { useUnreadNotificationCount, useNotificationSubscription } from '../hooks/useNotifications'
import { useManualSync } from '../lib/manualSync'
import { safeGet, safeSet } from '../lib/safeStorage'
import { goBackOrHome } from '../lib/navigation'
import { APP_VERSION } from '../lib/appVersion'
// Main navigation pages — no back button needed
const MAIN_NAV_PATHS = ['/', '/directory', '/community', '/calendar', '/profile']

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, isLoggedIn, isAdmin, isModerator, signOut } = useAuth()
  const { lang, toggleLang } = useLang()
  const config = useAppConfig()
  const unreadCount = useUnreadNotificationCount()
  // G-M11: the realtime subscription was dead code (exported, never called)
  // so the badge only refreshed on the 60 s React Query staleTime. Calling
  // it here keeps the badge live.
  useNotificationSubscription()
  // v9.25: manual sync — re-download data by hand after a slow-network
  // load left it stale. Self-contained in this header button (its own
  // progress % + status pill); the Home load-progress bar is separate
  // and shares no state with this.
  const manualSync = useManualSync()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)

  // v9.20: lock body scroll while the drawer is open — the drawer is its
  // own overflow-y-auto sheet, and the page behind it must not scroll.
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [menuOpen])
  // Show back button on all pages except main nav pages
  const showBack = !MAIN_NAV_PATHS.includes(location.pathname)

  

  useEffect(() => {
    setMenuOpen(false)
  }, [location])

  // Auto-show Change Log on new version — only AFTER the onboarding guide
  // has been dismissed (first-launch sequence: splash → onboarding → changelog).
  // The version is marked seen ONLY when the user dismisses the modal, never on a timer.
  // (A-F7: retry-every-launch until seen is deliberate — no change.)
  useEffect(() => {
    const CURRENT_VERSION = APP_VERSION;
    const lastSeen = safeGet('cherry_last_seen_version');
    if (lastSeen === CURRENT_VERSION) return;
    let timer;
    let fallback;
    const show = () => { timer = setTimeout(() => setShowChangelog(true), 1500); };
    if (safeGet('cherry_onboarding_done')) {
      show();
    } else {
      const onDone = () => show();
      window.addEventListener('cherry:onboarding-done', onDone);
      // A-F5 fallback: if the onboarding-done event never arrives (e.g.
      // deep link first launch), re-check stored state once after 10 s.
      fallback = setTimeout(() => {
        if (safeGet('cherry_onboarding_done')) show();
      }, 10000);
      return () => { window.removeEventListener('cherry:onboarding-done', onDone); clearTimeout(timer); clearTimeout(fallback); };
    }
    return () => clearTimeout(timer);
  }, []);

  // v9.9: the A18 backdrop-vs-X distinction is REMOVED (user complaint —
  // tapping outside is the natural dismiss on mobile, and the popup kept
  // reappearing on every launch). Any dismiss now marks the version seen.
  function closeChangelog() {
    setShowChangelog(false);
    safeSet('cherry_last_seen_version', APP_VERSION);
  }

  function handleBack() {
    // HD1 (v9.20): shared goBackOrHome — a raw history.length check can
    // eject a deep-link visitor out of the app (history counts external
    // sites); the shared helper falls back to home instead.
    goBackOrHome(navigate, '/')
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/')
    setMenuOpen(false)
  }

  const menuItems = [
    { path: '/', label: 'ပင်မ', icon: Home },
    { path: '/directory', label: 'လမ်းညွှန်', icon: Search },
    { path: '/calendar', label: 'ပြက္ခဒိန်', icon: Calendar },
    { path: '/community', label: 'Community', icon: Users },
    { path: '/emergency', label: 'အရေးပေါ် 🆘', icon: Siren },
    { path: '/chat', label: 'စကားပြောခန်း', icon: MessageCircle },
    { path: '/saved', label: 'သိမ်းထားသော', icon: Bookmark },
    { path: '/leaderboard', label: 'အမှတ်စာရင်း', icon: Trophy },
  ]

  const adminItems = [
    { path: '/admin', label: 'Admin Panel', icon: Shield },
    { path: '/admin/categories', label: 'အမျိုးအစားများ', icon: LayoutGrid },
    { path: '/admin/bulk-import', label: 'အစုလိုက် တင်သွင်းခြင်း', icon: Upload },
    { path: '/admin/settings', label: 'App ဆက်တင်များ', icon: Settings },
    { path: '/admin/reports', label: 'အစီရင်ခံစာများ', icon: BarChart3 },
  ]

  return (
    <>
      {/* Header – v9.14: always solid bg-[#0d0015] (was transparent, then
          only 80% opaque when scrolled — content showed through). */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-[#0d0015] border-b border-white/10"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {showBack && (
              <button
                onClick={handleBack}
                className="w-11 h-11 shrink-0 rounded-lg bg-white/8 flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all"
                aria-label="နောက်သို့"
                title="နောက်သို့"
              >
                <ArrowLeft size={18} className="text-white" />
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 min-w-0"
            >
            <div className="w-8 h-8 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <img 
                src="/logo.png" 
                alt="Cherry Directory Logo" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null
                  e.target.style.display = 'none'
                  e.target.parentElement.innerHTML = '<span class="text-lg">🍒</span>'
                }}
              />
            </div>
            <div className="block min-w-0">
              <p className="font-display font-bold text-sm text-white leading-tight truncate">
                {config.app_name || 'Cherry Directory'}
              </p>
              <p className="text-[9px] text-white/60 font-myanmar truncate">{config.app_city || 'တောင်ကြီးမြို့'}</p>
            </div>
          </button>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
                        <button
              onClick={() => navigate('/search')}
              className="w-11 h-11 shrink-0 rounded-lg bg-white/8 flex items-center justify-center text-white/60 hover:text-white/90 transition-colors"
              aria-label="ရှာဖွေမည်"
              title="ရှာဖွေမည်"
            >
              <Search size={16} />
            </button>

                        <button
              onClick={() => navigate('/notifications')}
              className="relative w-11 h-11 shrink-0 rounded-lg bg-white/8 flex items-center justify-center text-white/60 hover:text-white/90 transition-colors"
              aria-label="အသိပေးချက်များ"
              title="အသိပေးချက်များ"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>


            {/* v9.25: manual sync — tap to re-download/sync data by hand
                (e.g. after a slow-network load left it stale). While
                syncing the button shows the REAL progress % (queries
                settled / total). Disabled while a sync or any in-flight
                refetch is running, so it can never double-fetch against
                auto-refresh. On failure the cached data stays visible
                and the button stays usable to retry. */}
            <button
              onClick={manualSync.sync}
              disabled={manualSync.busy}
              className="w-11 h-11 shrink-0 rounded-lg bg-white/8 flex flex-col items-center justify-center text-white/60 hover:text-white/90 transition-colors disabled:opacity-50"
              aria-label="ဒေတာ ပြန်ဆွဲမည်"
              title={manualSync.syncing ? `ပြန်ဆွဲနေသည်… ${manualSync.progress ?? 0}%` : 'ဒေတာ ပြန်ဆွဲမည်'}
            >
              {manualSync.syncing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span className="text-[9px] font-bold leading-none mt-0.5">{manualSync.progress ?? 0}%</span>
                </>
              ) : (
                <RefreshCw size={16} />
              )}
            </button>

            <button
              onClick={toggleLang}
              className="w-11 h-11 shrink-0 rounded-lg bg-white/8 flex items-center justify-center text-xs font-bold text-white/60 hover:text-white/90"
              aria-label="ဘာသာစကား ပြောင်းမည်"
              title="🌐 ဘာသာစကား ပြောင်းမည်"
            >
              {lang === 'mm' ? 'EN' : 'မြန်မာ'}
            </button>

            {/* v9.14: hidden on small screens so the title + buttons fit at
                390px — the Change Log still auto-opens on a new version. */}
            <button
              onClick={() => setShowChangelog(true)}
              className="w-11 h-11 shrink-0 rounded-lg bg-white/8 hidden sm:flex items-center justify-center text-white/60 hover:text-brand-300 transition-colors"
              aria-label="ဗားရှင်း မှတ်တမ်း"
              title="ဗားရှင်း မှတ်တမ်း"
            >
              <Info size={16} />
            </button>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-11 h-11 shrink-0 rounded-lg bg-white/8 flex items-center justify-center"
              aria-label="မီနူး"
              title="မီနူး"
            >
              {menuOpen ? <X size={20} className="text-white" /> : <Menu size={20} className="text-white" />}
            </button>
          </div>
        </div>
      </header>

      {/* v9.25: manual-sync result — plain success/failure text, clears
          itself after ~4 s (see useManualSync). Never a crash screen. */}
      {manualSync.status && (
        <div
          className={`fixed right-3 z-50 rounded-full px-3 py-2 text-xs font-myanmar shadow-lg ${
            manualSync.status === 'ok'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
          style={{ top: 'calc(4.25rem + env(safe-area-inset-top) + 0.5rem)' }}
          role="status"
        >
          {manualSync.status === 'ok'
            ? '✓ ဒေတာ အသစ် ရပြီ'
            : manualSync.status === 'partial'
              ? '⚠ တချို့ ဒေတာ ပြန်ဆွဲမရပါ'
              : '✗ ပြန်ဆွဲမရပါ — ထပ်ကြိုးစားပါ'}
        </div>
      )}

      {/* Menu Modal (drawer) — v9.20: a true full-screen sheet ABOVE all
          page chrome (z-[60] > fixed app header z-50, FABs z-50, AdminPage
          sticky z-50, every z-40 sticky sub-header). Previously z-40 tied
          with the sticky category headers and lost to them in DOM order,
          so the first menu item was half-clipped under the purple header.
          Top padding is safe-area only now (the sheet covers the app
          header too, so the old 4rem offset is gone) and the drawer has
          its OWN close button, since the header's X sits underneath it. */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md overflow-y-auto"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="p-4 space-y-2"
            style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            {/* v9.20: drawer header row with its own close button — the
                fixed app header (and its X) is covered by this sheet. */}
            <div className="flex items-center justify-between px-1 pb-1">
              <p className="font-display font-bold text-base text-white">မီနူး</p>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-11 h-11 shrink-0 rounded-lg bg-white/8 flex items-center justify-center"
                aria-label="မီနူး ပိတ်မည်"
                title="မီနူး ပိတ်မည်"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
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
                  <p className="text-[10px] text-white/60">
                    {profile.role === 'super_admin' ? 'Super Admin' : profile.role === 'admin' ? 'Admin' : profile.role === 'moderator' ? 'Moderator' : 'Member'}
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

            <div className="pt-2 mt-2 border-t border-white/8">
              <Link to="/about" className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/8 transition-colors" onClick={() => setMenuOpen(false)}>
                <span className="text-white/50 text-sm">🍒</span>
                <span className="text-sm text-white/60">အကြောင်း</span>
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

            <p className="text-[9px] text-white/60 text-center py-4">
              {config.app_name} v{APP_VERSION} • {config.app_city}
            </p>
          </div>
        </div>
      )}

      {/* Change Log Modal */}
      {showChangelog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pt-safe bg-black/80 backdrop-blur-md" onClick={closeChangelog}>
          <div className="w-full max-w-sm bg-[#1a0030] border border-white/10 rounded-3xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-white/8 sticky top-0 bg-[#1a0030] z-10">
              <div>
                <h3 className="font-display font-bold text-white text-base">Change Log</h3>
                <p className="text-[10px] text-white/60 font-myanmar">Version {APP_VERSION}</p>
              </div>
              <button onClick={closeChangelog} className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-white/50 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4">
              {[
                { v: '9.25', date: '2026-11-06', items: ['Home ဖွင့်ရင် ပျက်နေတာ ပြင်ပြီး — အကောင့်ဝင်ထားရင် တချို့အချိန်မှာ စာမျက်နှာ မှားသွားတတ်တာ', 'အမှားစာမျက်နှာက Profile ရှင်းတဲ့ ခလုတ် စာသား တိုသွားမည်', 'အလျားလိုက် scroll ပျောက် — Tab / Filter တန်းတွေ ဘေးတိုက် ပွတ်စရာ မလိုတော့ဘဲ အောက်ကို ခေါက်ကျမည်; ဆီဆိုင် Filter လည်း 360px မှာ မလျှံတော့ပါ', 'Directory မှာ လုပ်ငန်းအမည် ရှာတဲ့ ဘားတန်း scroll ဆွဲလည်း ပျောက်မသွားတော့ဘဲ အမြဲ ပေါ်နေမည်', 'ဖျက်လိုက်တဲ့ လုပ်ငန်း အရေအတွက် + စာရင်းတွေ ချက်ချင်း ပြောင်းမည် — ဖျက်ပြီး ပြန်ဝင်စရာ မလိုတော့ပါ', 'ဖျက်လိုက်ရင် အမှတ် ပြန်မနှုတ်တော့ပါ — တင်သွင်းသူနဲ့ review ရေးသူတွေ ရပြီးသား အမှတ် ဆက်ရှိမည်', 'ဖျက်ပြီးရင် အရင်ကြည့်နေတဲ့ စာရင်းဆီ တစ်ဆင့်တည်း ပြန်ရောက်မည်', 'လုပ်ငန်း အများကြီး တစ်ခါတည်း ဖျက်လို့ရပြီ', 'လိုင်းနှေးလည်း ဒေါင်းထားပြီးသား ဒေတာ အရင် ပေါ်မည် — အသစ်ရယူနေချိန် အဟောင်းကို ဆက်ပြမည်၊ ဒေတာ မရှိမှသာ အမှား ပြမည်', 'ဒေတာ ဒေါင်းနေချိန် ဘယ်လောက် ပြီးပြီလဲ % နဲ့ ပြမည်', 'ဒေတာ ကိုယ်တိုင် ပြန်ဒေါင်းလို့ရပြီ — Header က ခလုတ် နှိပ်ရုံနဲ့ အသစ် ပြန်ရယူမည်', 'မျှဝေထားတဲ့ အမျိုးအစား လင့်ခ် ဖွင့်ရင် အဲဒီ အမျိုးအစားရဲ့ စာရင်း မှန်မှန် ပေါ်မည်'] },
                { v: '9.23', date: '2026-11-06', items: ['တစ်ခုခု ပျက်ရင် အမှားစာမျက်နှာမှာ ဘာလုပ်ရမယ် ရှင်းရှင်းပြမည် — Android ဆိုရင် Cache ရှင်းပြီး ပြန်ဖွင့်ရန်၊ iPhone/iPad ဆိုရင် Shortcut ဖျက်ပြီး ပြန်ထည့်ရန်', 'Home data တင်မရရင် အဲဒီအကြံပြုချက်ကို အမှားဘန်းနားမှာပါ ပြမည်', 'Version အသစ် ရရင် ပိုမြန်မြန် အပ်ဒိတ်လုပ်မည် — Service Worker အသစ်က ချက်ချင်း စတင်အလုပ်လုပ်မည်'] },
                { v: '9.22', date: '2026-11-06', items: ['Tab နှစ်ခု ဖွင့်ထားရင် Home ပျက်နေတာ ပြင်ပြီး — လိုင်းနှေးလည်း နှစ်ခုလုံး သုံးလို့ ရပြီ', 'အကောင့် တင်တာ ကြာနေတာ ပြင်ပြီး — Login ဝင်ချိန် ချိတ်ဆက်မရရင် ချက်ချင်း သိရမည်', 'ရှာဖွေချိန် ရလဒ် အားလုံး မစုံသေးဘဲ "၀ ရလဒ်" လို့ ပြနေတာ ပြင်ပြီး — ရလဒ် အပြည့်ရမှ အရေအတွက် ပြမည်', 'ရှာပြီး ရလဒ် အရေအတွက် နဲ့ လိပ်စာ တစ်ခါတည်း အမှန် ပြမည်', 'Profile ဖွင့်ရင် ပျက်နေတာ ပြင်ပြီး — အကောင့် စာမျက်နှာ ဖွင့်လို့ ရပြီ', 'Version အသစ် ရရင် အသိပေးချက် ပေါ်မည် — ဆာဗာက ဗားရှင်းအသစ် စစ်ပြီး နှိပ်လိုက်တာနဲ့ အပ်ဒိတ်လုပ်မည်'] },
                { v: '9.21', date: '2026-11-06', items: ['Home data တင်မရရင် သူ့အလိုလို ပြန်ကြိုးစားမည် — လိုင်းနှေးလို့ ပျက်ရင်လည်း အလိုအလျောက် တစ်ကြိမ် ထပ်တင်မည်', 'Home ဖွင့်ချိန် တခြား tab နဲ့ တိုက်မိလို့ ပျက်နေရင် သူ့အလိုလို ပြန်တက်လာမည်', 'Featured လုပ်ငန်းများ "အားလုံး" နှိပ်ရင် လုပ်ငန်းတွေ တန်းပေါ်မည် — အရင် ၀ ခု ပြနေတာ ပြင်ပြီး', 'ဈေးနှုန်း စာမျက်နှာ အောက်ဆုံး စာသား floating ခလုတ်အောက် မဝင်တော့ခြင်း'] },
                { v: '9.20', date: '2026-11-05', items: ['မီနူး ဖွင့်ချိန် ပထမဆုံး အရာ Header အောက်မှာ ညှပ်မနေတော့ခြင်း — မီနူးက စာမျက်နှာ အပေါ်မှာ အပြည့်ပေါ်မည်', 'floating ခလုတ်များ (+ တင်မည်) အောက်ခြေ Nav ကို မဖုံးတော့ခြင်း', 'Chat စာရိုက်တဲ့ နေရာ အောက်ခြေ Nav အောက်မှာ မဝင်တော့ခြင်း', 'Update / Install banner တွေ floating ခလုတ်တွေကို မဖုံးတော့ခြင်း', 'မြန်မာလို ရှာတာ ရတော့မည် — Zawgyi နဲ့ သိမ်းထားတဲ့ လုပ်ငန်းအမည်တွေလည်း Unicode နဲ့ ရှာလို့ ရပြီ; အမျိုးအစား အမည်နဲ့ ရှာရင်လည်း ထိုအမျိုးအစားက လုပ်ငန်းတွေ ပေါ်မည်', 'မရှိတော့တဲ့ ဆိုင်တွေ ဖျက်လို့ရပြီ', 'Chat ပို့လိုက်တဲ့ မက်ဆေ့ ချက်ချင်း ပေါ်မည် — အရင် ၂၀ စက္ကန့်ထိ စောင့်စရာ မလိုတော့ပါ', 'စာမျက်နှာ အပြည့်အဝ စစ်ဆေးမှု — ဈေးနှုန်း စာမျက်နှာ ဖွင့်ချိန် ပျက်နေတာ၊ Featured လုပ်ငန်းများ မပေါ်တာ၊ Audit Log ကြည့်ရန် မရှိတာ၊ မြန်မာလိုသာ ခေါင်းစဉ်ရှိတဲ့ Event သိမ်းမရတာ စတဲ့ ပြဿနာများ ပြင်ပြီး (စုစုပေါင်း ၆၀ ကျော်)'] },
                { v: '9.19', date: '2026-11-05', items: ['Leaderboard မြန်လာခြင်း — SQL ပြင်ခြင်း (9.19 SQL run ရမည်; 9.18 SQL ပြန် run မလုပ်ပါနှင့်)', 'Edit လုပ်ချိန် "ပြင်ဆင်ခွင့် မရှိပါ" message လုံးဝ မပေါ်တော့ခြင်း — Profile တင်နေချိန် Loading သာ ပြမည်', 'သိမ်းပြီး လုပ်ငန်း စာမျက်နှာကို ချက်ချင်း ရောက်ခြင်း — Loading ပြန်မပေါ်တော့ပါ', 'Search ရလဒ် တစ်ခုချင်းစီ တန်းပေါ်လာခြင်း — အစောဆုံး ရလဒ် မြန်မြန် ပေါ်မည်', 'ခပ်သိမ်း / အကုန် → အားလုံး — စာသား တစ်မျိုးတည်း ဖြစ်အောင် ပြင်ခြင်း', 'Loading တွေ နေရာတကာ မပေါ်တော့ခြင်း — data ကို background မှာ ကြိုဆွဲထားမည် (သိမ်းထားတာ ရှိရင် ချက်ချင်း ပေါ်မည်)'] },
                { v: '9.18', date: '2026-11-05', items: ['ရှာဖွေမှု ပြင်ခြင်း — "upper" လို ရှာရင် လုပ်ငန်း တန်းပေါ်မည် (အကြီးအသေး မခွဲ၊ စာလုံးအစိတ်အပိုင်း တူရင် ရ; စကားလုံး နှစ်လုံး ရှာလည်း ရ)', 'Leaderboard + Notifications ပြင်ခြင်း — 9.17 SQL run မအောင်လို့ 9.18 SQL အသစ် run ရမည် (9.17 SQL ပြန် run မလုပ်ပါနှင့်)', 'WebSocket error တွေ ပျောက် — Live update မရတဲ့ နေရာမှာ တိတ်တိတ်လေး ပြန်တင်မည် (Chat က ၂၀ စက္ကန့်တစ်ကြိမ် ပြန်စစ်မည်)', 'Profile တင်တာ ပိုခိုင်မာ — လိုင်းနှေးလည်း "Profile ရယူမရပါ" error မပြတော့ပါ', 'လိုင်းမငြိမ်ချိန် Search ဖွင့်ရင် 503 မပြတော့ပါ'] },
                { v: '9.17', date: '2026-11-05', items: ['လုပ်ငန်းအမည် — မြန်မာ သို့မဟုတ် English တစ်ခု ရှိရင် ရပြီ (နှစ်ခုလုံး မလိုတော့ပါ)', 'Edit လုပ်နေရင်း App ပြောင်းသွားလည်း မသိမ်းရသေး draft ပြန်ရမည်', 'Offline cache အမှန်တကယ် သိမ်းတော့မည် — VPN ဖွင့်/ပိတ်လည်း စာမျက်နှာများ ချက်ချင်း ပေါ်မည်', 'အမှတ်မှတ်တမ်း အသစ် (Points စာမျက်နှာ) + Profile / Points / Leaderboard အမှတ် ညီတော့မည် — ဒီလ အမှတ်နဲ့ စုစုပေါင်း အမှတ် ခွဲပြ၊ Bulk Import အမှတ်လည်း ပုံမှန်အတိုင်း ရမည်', 'Leaderboard Tier / အဆင့် ရေတွက်မှု ပြင်ခြင်း — ကာလ အမှတ်နဲ့ စုစုပေါင်း အမှတ် နှစ်ခုလုံး ပြ', 'Admin / စာရင်း / အလုပ်အကိုင် / ဆီဆိုင် / ဈေးနှုန်း စစ်ဆေးချက် အများအပြား ပြင်ခြင်း (SQL run ရမည်)'] },
                { v: '9.16', date: '2026-11-04', items: ['Admin Panel မှာ Data tab အသစ် — လုပ်ငန်း / User / လာကြည့်သူ ဒေတာ ကြည့်လို့ရ + CSV ဒေါင်းလုတ်', 'လာကြည့်သူ စာရင်းအင်း Admin Panel ထဲမှာ ပါပြီ'] },
                { v: '9.15', date: '2026-11-04', items: ['SQL ဖိုင်တွေ supabase/ folder ထဲ ရွှေ့ — root folder ရှင်း'] },
                { v: '9.14', date: '2026-11-04', items: ['Update toast ပိတ်လို့ရ + နေရာ ပြင် + floating banner တစ်ကြိမ်တည်း တစ်ခု', 'အလျားလိုက် scroll ပျောက် — badge wrap + overflow-x clip', 'Header + Bottom Nav အကြည် မဟုတ်တော့ — အရောင်အပြည့်', 'Sticky header ပြင်ခြင်း (Chat tabs, Directory collapse, စာမျက်နှာ ~၁၄ ခု)', 'လာကြည့်သူ ရေတွက်မှု ပြင်ခြင်း — GRANT INSERT + stats refresh (SQL run ရမည်)', 'Chunk timeout 30 စက္ကန့် + တစ်ကြိမ် အလိုအလျောက် ပြန်တင်ခြင်း', 'Chat composer ပြင်ခြင်း', 'အောက်ခြေ နေရာ pb-32 — floating ခလုတ်တွေ စာသား မဖုံးတော့ပါ'] },
                { v: '9.13', date: '2026-11-04', items: ['လာကြည့်သူ အကျဉ်းချုပ် Hero ထဲမှာ ပေါင်းထည့် — သီးသန့် Box ဖျက် (နေရာ သက်သာ)'] },
                { v: '9.12', date: '2026-11-04', items: ['Hero မှာ လာကြည့်သူ အကျဉ်းချုပ် (နိုင်ငံ / Device / အကြည့်များဆုံးအချိန်) — Data အစစ်', 'လာကြည့်သူ Dashboard စာမျက်နှာ အသစ် (/visitors)', 'လာကြည့်သူ ရေတွက်မှု စတင် — နံပါတ်တွေ ၀ ကနေ စတက်မယ် (အတိတ်ကို ပြန်ဖြည့်မရပါ)'] },
                { v: '9.11', date: '2026-11-04', items: ['Help မှာ "မှားနေတဲ့ လုပ်ငန်းကို ပြင်နည်း" အပိုင်း အသစ် (Edit က Account + ပိုင်ရှင် လိုတာ၊ Guest က Report လုပ်လို့ရတာ)'] },
                { v: '9.10', date: '2026-11-04', items: ['Home Screen မှာ သုံးစွဲနည်း လမ်းညွှန် အသစ် (ဧည့်သည် / Account ဘာလုပ်လို့ရလဲ)', 'သုံးစွဲနည်း စာမျက်နှာ Update (မှားနေတာ ပြင် + လိုနေတဲ့ အပိုင်းတွေ ထည့်)', 'Sidebar က သုံးစွဲနည်း link ဖြုတ် (Home ကနေ သွားလို့ရ)'] },
                { v: '9.9', date: '2026-11-04', items: ['Data ကို app ရဲ့ ကိုယ်ပိုင်လိပ်စာကနေ တစ်ဆင့် ယူခြင်း — VPN မပါဘဲ Data ရခြင်း (ISP က Supabase ပိတ်ထားတာကို ကျော်ခြင်း)', 'Change Log popup ကို အပြင်ဘက် နှိပ်ပြီး ပိတ်ရင်လည်း တစ်ကြိမ်ပြီးရင် နောက်မပေါ်တော့ခြင်း'] },
                { v: '9.8', date: '2026-11-04', items: ['FuelPage ပိုနေသော } ဖြုတ်ခြင်း — build သတိပေးချက် ပျောက်ခြင်း', 'မလိုအပ်သော ဖိုင်များ တစ်ခါတည်း ရှင်းလင်းခြင်း (.bak + ဟောင်း script + ဟောင်း schema/guide)', 'နောင် fix script များ self-cleanup ပါမည်'] },
                { v: '9.7', date: '2026-11-04', items: ['Home data တင်တာ 30 စက္ကန့် + ရသလောက် အရင်ပြ', 'Data တင်မရရင် တစ်ကြိမ် အလိုအလျောက် ပြန်ကြိုးစားခြင်း', 'စာမျက်နှာ ၃၀ မှာ တင်မှု ခံနိုင်ရည် ပြင်ခြင်း', 'အမှားစာသား အမှန်အတိုင်း ပြင်ခြင်း'] },
                { v: '9.6', date: '2026-11-04', items: ['Chat အခန်း အမျိုးအစား ရွေးနိုင်ခြင်း (Group / Private)', 'ဘတ်စ်ကား ဆိုက်ရောက်ချိန် + operator ဖုန်းနံပါတ်', 'ကျန်းမာရေး ဖွင့်ချိန် + အထူးပြု', 'Chat reply/delete ခလုတ်များ 44px', 'History gallery ✕ ခလုတ် 44px', 'ဆီဆိုင် Admin form တွင် ဖုန်း / ဖွင့်ချိန် / မှတ်ချက် ရိုက်ထည့်နိုင်ခြင်း', 'ဆီ live-status + queue report ဖယ်ရှားခြင်း — ဆိုင်လမ်းညွှန်သာ ဆက်ထား', 'လျှပ်စစ် အခြေအနေ category + report ညွှန်ကြားချက် ဖယ်ရှားခြင်း — အရေးပေါ် ဆက်သွယ်ရန် ဖုန်းများ ဆက်ထား', 'Supabase migration supabase-migration-9.6.sql'] },
                { v: '9.5', date: '2026-11-04', items: ['UI/UX စစ်ဆေးချက် ၂၂၀ + လုပ်ဆောင်ချက် bug ၁၈ ခု အားလုံး ပြင်ဆင်ခြင်း', 'Guest ဖုန်းနံပါတ် အပြည့်အစုံ ခေါ်ဆိုနိုင်ခြင်း လုံခြုံရေး ပြင်ဆင်ခြင်း', 'အရေးပေါ် 🆘 ခလုတ် Home + Menu တွင် ထည့်ခြင်း', 'ခလုတ်/စာသား ဖတ်ရလွယ်အောင် ပြင်ဆင်ခြင်း (disabled/focus/16px/မှိန်သော စာသား)', 'ဝေါဟာရ မြန်မာလို တစ်မျိုးတည်း ဖြစ်အောင် ပြင်ဆင်ခြင်း', 'အလှူငွေ collected_amount — Admin + Admin ခွင့်ပြုထားသော Moderator သာ ပြင်နိုင်ခြင်း', 'My Reviews စာမျက်နှာ + 404 စာမျက်နှာ အသစ်'] },
                { v: '9.4', date: '2026-11-03', items: ['Lost & Found စာမျက်နှာတွင် ပိုနေသော `}` ဖြုတ်ခြင်း', 'push script ဗားရှင်းစာသား ဟောင်းနေခြင်း ပြင်ဆင်ခြင်း'] },
                { v: '9.3', date: '2026-11-03', items: ['"ပြင်ဆင်နေသည်..." ရပ်နေသော ပြဿနာ ပြင်ဆင်ခြင်း', 'Home/Directory ဒေတာ တင်တာ timeout + retry', 'Points အတု ပြင်ဆင်ခြင်း + Chat အမှတ် RPC', 'Report/Claim/Jobs/Fuel ပြင်ဆင်မှုများ', 'Version နံပါတ် ၂ လုံးတွဲ (9.3) သို့ ပြောင်းခြင်း'] },
                { v: '9.2', date: '2026-11-03', items: ['Version History ကို အစအဆုံး ပြန်ရေးခြင်း (ဖေဖော်ဝါရီ ၁၆ ကစ)', 'ရက်စွဲ မှားနေတာများ ပြင်ခြင်း', 'အထောက်အထား မရှိသော ပြောဆိုချက်များ ဖြုတ်ခြင်း'] },
                { v: '9.1', date: '2026-11-03', items: ['လုံခြုံရေး ပြင်ဆင်ခြင်း — ကိုယ့်ဘာသာ Admin ဖြစ်လို့မရတော့ပါ', 'Toast အသိပေးချက်များ ပေါ်လာခြင်း', 'ဧည့်သည် လုပ်ငန်းတင်နိုင်ခြင်း (Admin စစ်ပြီးမှ ပေါ်မည်)', 'အလုပ်အကိုင် / ဘတ်စ်ကား / ခရီးစဉ် / Chat / အိမ်ငှား / ကျူရှင် / မှတ်တမ်း ပြင်ဆင်ခြင်း', 'Admin Panel အကာအကွယ် + Claim စစ်ဆေးခြင်း', 'Google ဖြင့် ဝင်ရောက်ခြင်း + စကားဝှက် ပြန်ယူခြင်း', 'ဆီဆိုင် စာမျက်နှာ ပြန်ဖွင့်ခြင်း', 'Directory "ထပ်တင်ရန်" ပြင်ဆင်ခြင်း'] },
                { v: '9.0', date: '2026-10-20', items: ['Change Log popup + Version History', 'Myanmar ဘာသာပြန်ခြင်း', 'Version အသစ်တက်တိုင်း အလိုအလျောက် ပြခြင်း', 'စာလုံးအရွယ် ကြီးခြင်း'] },
                { v: '8.0', date: '2026-10-20', items: ['OSM Bulk Import စနစ်', 'ဒေတာတူညီမှု တင်းကျပ်စွာ စစ်ဆေးခြင်း', 'Batch Insert 503 Timeout ပြင်ဆင်ခြင်း'] },
                { v: '7.0', date: '2026-10-14', items: ['iOS PWA Safe-area ပြင်ဆင်ခြင်း', 'ConfirmModal + Toast စနစ်'] },
                { v: '6.0', date: '2026-10-13', items: ['Offline support + Cache အခြေအနေ', 'Saved Hub စုစည်းခြင်း', 'လုပ်ငန်းဖွင့်ချိန် + ဆင်တူလုပ်ငန်းများ', 'Points နှင့် Tiers စနစ်', 'My Submissions & RSVPs', 'React.lazy ဖြင့် Bundle ခွဲခြင်း'] },
                { v: '5.0', date: '2026-10-12', items: ['၆ လခွဲ ရပ်နားပြီးနောက် ပြန်စခြင်း', 'Search + Notifications စာမျက်နှာများ', 'Saved Places + Onboarding Guide', 'Sentry + Toast ထည့်ခြင်း'] },
                { v: '2.0', date: '2026-03-22', items: ['React + Supabase အဖြစ် ပြန်ရေးခြင်း (Total Upgrade)', 'စာမျက်နှာ ၄၀ ကျော် (Fuel, Chat, Jobs, Rent, Tutoring…)', 'BottomNav + ErrorBoundary', 'Share + QR Code', 'Weather Alert + LocationPicker'] },
                { v: '1.0', date: '2026-02-16', items: ['ပရောဂျက် စတင်ခြင်း (TGIBUS)', 'Google Sheets သုံး Cherry Directory', 'သတင်း/ပွဲ + အသိပညာ + လုပ်ငန်းရှာဖွေခြင်း', 'Chat + PWA စနစ်'] }
              ].map((rel, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="badge bg-brand-600/30 text-brand-300 font-bold border border-brand-400/30">v{rel.v}</span>
                    <span className="text-[10px] text-white/60">{rel.date}</span>
                  </div>
                  <ul className="space-y-1 pl-4">
                    {rel.items.map((item, j) => (
                      <li key={j} className="text-xs text-white/60 font-myanmar flex items-start gap-2">
                        <span className="text-brand-400 mt-0.5">•</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}