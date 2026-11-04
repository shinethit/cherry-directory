import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Menu, X, User, LogOut, Settings, Shield, Bell, Home, Bookmark, Trophy, MessageCircle, Calendar, Users, Search, Info, Siren, LayoutGrid, Upload, BarChart3 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../contexts/AppConfigContext'
import { useUnreadNotificationCount, useNotificationSubscription } from '../hooks/useNotifications'
import { safeGet, safeSet } from '../lib/safeStorage'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  // Show back button on all pages except main nav pages
  const showBack = !MAIN_NAV_PATHS.includes(location.pathname)

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
    // If there's history to go back to, use it. Otherwise go home.
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
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
      {/* Header – no extra spacer inside; uses safe area and a minimal padding */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#0a0018]/80 backdrop-blur-md border-b border-white/10'
            : 'bg-transparent'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {showBack && (
              <button
                onClick={handleBack}
                className="w-11 h-11 rounded-lg bg-white/8 flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all"
                aria-label="နောက်သို့"
                title="နောက်သို့"
              >
                <ArrowLeft size={18} className="text-white" />
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
            <div className="w-8 h-8 rounded-xl overflow-hidden bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
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
            <div className="block">
              <p className="font-display font-bold text-sm text-white leading-tight">
                {config.app_name || 'Cherry Directory'}
              </p>
              <p className="text-[9px] text-white/60 font-myanmar">{config.app_city || 'တောင်ကြီးမြို့'}</p>
            </div>
          </button>
          </div>

          <div className="flex items-center gap-2.5">
                        <button
              onClick={() => navigate('/search')}
              className="w-11 h-11 rounded-lg bg-white/8 flex items-center justify-center text-white/60 hover:text-white/90 transition-colors"
              aria-label="ရှာဖွေမည်"
              title="ရှာဖွေမည်"
            >
              <Search size={16} />
            </button>

                        <button
              onClick={() => navigate('/notifications')}
              className="relative w-11 h-11 rounded-lg bg-white/8 flex items-center justify-center text-white/60 hover:text-white/90 transition-colors"
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


            <button
              onClick={toggleLang}
              className="w-11 h-11 rounded-lg bg-white/8 flex items-center justify-center text-xs font-bold text-white/60 hover:text-white/90"
              aria-label="ဘာသာစကား ပြောင်းမည်"
              title="🌐 ဘာသာစကား ပြောင်းမည်"
            >
              {lang === 'mm' ? 'EN' : 'မြန်မာ'}
            </button>

            <button
              onClick={() => setShowChangelog(true)}
              className="w-11 h-11 rounded-lg bg-white/8 flex items-center justify-center text-white/60 hover:text-brand-300 transition-colors"
              aria-label="ဗားရှင်း မှတ်တမ်း"
              title="ဗားရှင်း မှတ်တမ်း"
            >
              <Info size={16} />
            </button>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-11 h-11 rounded-lg bg-white/8 flex items-center justify-center"
              aria-label="မီနူး"
              title="မီနူး"
            >
              {menuOpen ? <X size={20} className="text-white" /> : <Menu size={20} className="text-white" />}
            </button>
          </div>
        </div>
      </header>

      {/* Menu Modal – adjusted top padding */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md overflow-y-auto"
          style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}
          onClick={() => setMenuOpen(false)}
        >
          <div className="p-4 space-y-2" onClick={e => e.stopPropagation()}>
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