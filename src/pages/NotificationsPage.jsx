import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCheck, Trash2, ArrowLeft, Star, Building2, Fuel, AlertCircle, MessageCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  subscribeToNotifications,
} from '../lib/notificationService'
import { confirmDialog } from '../lib/confirmDialog'
import { showError } from '../lib/toast'
import { formatMyanmarDate } from '../lib/myanmarDate'
import { goBackOrHome } from '../lib/navigation'

// Notification type → icon + color mapping
const TYPE_CFG = {
  listing_approved:   { icon: Building2,     color: 'text-green-400',  bg: 'bg-green-500/15' },
  listing_rejected:   { icon: Building2,     color: 'text-red-400',    bg: 'bg-red-500/15' },
  new_review:         { icon: Star,          color: 'text-gold-400',   bg: 'bg-gold-500/15' },
  review_approved:    { icon: Star,          color: 'text-gold-400',   bg: 'bg-gold-500/15' },
  fuel_status_update: { icon: Fuel,          color: 'text-amber-400',  bg: 'bg-amber-500/15' },
  new_message:        { icon: MessageCircle, color: 'text-brand-300',  bg: 'bg-brand-600/15' },
  system_alert:       { icon: AlertCircle,   color: 'text-blue-400',   bg: 'bg-blue-500/15' },
}

function timeAgoShort(iso, lang) {
  if (!iso) return ''
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return lang === 'mm' ? 'ယခုလေး' : 'just now'
  if (m < 60) return `${m}${lang === 'mm' ? ' မိနစ်' : 'm'}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}${lang === 'mm' ? ' နာရီ' : 'h'}`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}${lang === 'mm' ? ' ရက်' : 'd'}`
  // NEVER toLocaleDateString('my-MM', …) — missing on many phones, falls
  // back to English (H-22). Hardcoded Myanmar month names instead.
  return lang === 'mm'
    ? formatMyanmarDate(iso)
    : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useAuth()
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'အသိပေးချက်များ' : 'Notifications' })

  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'unread'

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setLoadError('')
    try {
      const data = await getUserNotifications(user.id, 50)
      setNotifications(data || [])
    } catch (err) {
      console.warn('Load notifications error:', err)
      // F12: never render the raw Supabase English message — store a
      // marker only; the screen renders fixed Myanmar text + Retry.
      setLoadError('load_failed')
      setNotifications([])
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // Real-time subscription
  useEffect(() => {
    if (!user) return
    const sub = subscribeToNotifications(user.id, (newNotif) => {
      setNotifications(prev => [newNotif, ...prev])
    })
    return () => { if (sub) sub.unsubscribe() }
  }, [user])

  async function handleMarkRead(notif) {
    if (notif.is_read) return
    // Optimistic, but revert on failure — never show "read" when the DB disagrees.
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
    try {
      await markNotificationAsRead(notif.id)
    } catch (err) {
      console.warn('Mark notification read failed:', err)
      showError(err?.message || 'ဖတ်ပြီးအဖြစ် မှတ်မရပါ')
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: false } : n))
    }
  }

  async function handleMarkAll() {
    if (!user) return
    const prev = notifications
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    try {
      await markAllNotificationsAsRead(user.id)
    } catch (err) {
      console.warn('Mark all read failed:', err)
      showError(err?.message || 'အားလုံးဖတ်ပြီးအဖြစ် မှတ်မရပါ')
      setNotifications(prev)
    }
  }

  async function handleDelete(id) {
    if (!(await confirmDialog(lang === 'mm' ? 'ဤအသိပေးချက်ကို ဖျက်မည်လား?' : 'Delete this notification?', { danger: true }))) return
    const prev = notifications
    setNotifications(prev => prev.filter(n => n.id !== id))
    try {
      await deleteNotification(id)
    } catch (err) {
      console.warn('Delete notification failed:', err)
      showError(err?.message || 'ဖျက်မရပါ — ထပ်ကြိုးစားပါ')
      setNotifications(prev)
    }
  }

  function handleOpen(notif) {
    handleMarkRead(notif)
    // Navigate based on notification type
    const data = notif.data || {}
    if (notif.type === 'listing_approved' || notif.type === 'listing_rejected') {
      if (data.listing_id) navigate(`/directory/${data.listing_id}`)
    } else if (notif.type === 'new_review' || notif.type === 'review_approved') {
      if (data.listing_id) navigate(`/directory/${data.listing_id}`)
    } else if (notif.type === 'fuel_status_update') {
      navigate('/fuel')
    } else if (notif.type === 'new_message') {
      // F11: go straight to the conversation when the notification
      // carries a room id (passed via location state — there is no
      // /chat/:roomId route; ChatPage must read state.roomId).
      const roomId = data.room_id || data.chat_room_id || data.roomId
      if (roomId) navigate('/chat', { state: { roomId } })
      else navigate('/chat')
    } else if (notif.type === 'system_alert') {
      // F10: a system alert has no destination — marking it read (done
      // at the top of handleOpen) is the whole action; the row visibly
      // loses its unread dot and highlight.
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70dvh] px-8 text-center">
        <Bell size={48} className="text-brand-400 mb-4" />
        <h2 className="font-display font-bold text-xl text-white mb-2">
          {lang === 'mm' ? 'Login လိုအပ်သည်' : 'Login Required'}
        </h2>
        <p className="text-white/50 font-myanmar mb-6">
          {lang === 'mm' ? 'အသိပေးချက်များ ကြည့်ရန် Login ဝင်ပါ' : 'Please log in to view notifications'}
        </p>
        <button onClick={() => navigate('/login')} className="btn-primary">
          {lang === 'mm' ? 'Login ဝင်ရောက်မည်' : 'Sign In'}
        </button>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.is_read).length
  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications

  return (
    <div className="pb-8 min-h-[80dvh]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => goBackOrHome(navigate, '/')}
            className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="font-display font-bold text-xl text-white flex items-center gap-2">
              🔔 {lang === 'mm' ? 'အသိပေးချက်များ' : 'Notifications'}
            </h1>
            <p className="text-[10px] text-white/60 mt-0.5 font-myanmar">
              {lang === 'mm'
                ? `${notifications.length} ခု • ${unreadCount} ဖတ်မရသေး`
                : `${notifications.length} total • ${unreadCount} unread`}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            className="flex items-center gap-1.5 text-[10px] text-brand-300 hover:text-brand-200 transition-colors px-3 py-2 rounded-xl bg-brand-600/15 border border-brand-400/25"
          >
            <CheckCheck size={12} />
            {lang === 'mm' ? 'အားလုံးဖတ်ပြီးဟု မှတ်မည်' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Filter tabs */}
      {notifications.length > 0 && (
        <div className="px-4 mb-3">
          <div className="flex gap-2">
            {[
              { id: 'all',    mm: 'အားလုံး',      en: 'All',    count: notifications.length },
              { id: 'unread', mm: 'မဖတ်ရသေး',   en: 'Unread', count: unreadCount },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === t.id
                    ? 'bg-brand-600/60 text-brand-200 border border-brand-400/40'
                    : 'bg-white/5 text-white/50 border border-white/10 hover:text-white/80'
                }`}
              >
                {lang === 'mm' ? t.mm : t.en}
                <span className="text-[9px] opacity-60">({t.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="px-4 space-y-2">
        {loading ? (
          [1,2,3].map(n => (
            <div key={n} className="h-20 rounded-2xl bg-white/4 animate-pulse" />
          ))
        ) : loadError ? (
          <div className="flex flex-col items-center py-16 text-center px-8">
            <span className="text-5xl mb-4">⚠️</span>
            <p className="font-display font-semibold text-white/70">
              {lang === 'mm' ? 'အသိပေးချက်များ ရယူမရပါ' : 'Could not load notifications'}
            </p>
            <p className="text-xs text-white/60 mt-1 font-myanmar max-w-xs">
              {lang === 'mm' ? 'တင်မရပါ — ပြန်ကြိုးစားမည်' : 'Could not load — please try again'}
            </p>
            <button onClick={load} className="btn-primary text-sm mt-4 px-5 py-2">
              {lang === 'mm' ? 'ထပ်ကြိုးစားမည်' : 'Retry'}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="text-5xl mb-4">🔔</span>
            <p className="font-display font-semibold text-white/60">
              {filter === 'unread'
                ? (lang === 'mm' ? 'မဖတ်ရသေး အသိပေးချက် မရှိ' : 'No unread notifications')
                : (lang === 'mm' ? 'အသိပေးချက် မရှိသေး' : 'No notifications yet')}
            </p>
            <p className="text-xs text-white/60 mt-1 font-myanmar max-w-xs">
              {lang === 'mm'
                ? 'သင့်လုပ်ငန်း Approve ဖြစ်တာ၊ Review အသစ် ရတာတို့ ဤနေရာမှာ ပေါ်လာမည်'
                : 'You will see notifications here when your listing is approved or you get a new review.'}
            </p>
          </div>
        ) : (
          filtered.map(notif => (
            <NotificationRow
              key={notif.id}
              notif={notif}
              lang={lang}
              onOpen={() => handleOpen(notif)}
              onDelete={() => handleDelete(notif.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function NotificationRow({ notif, lang, onOpen, onDelete }) {
  const cfg = TYPE_CFG[notif.type] || TYPE_CFG.system_alert
  const Icon = cfg.icon

  return (
    <div
      onClick={onOpen}
      className={`relative flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
        notif.is_read
          ? 'bg-white/3 border-white/6 hover:bg-white/6'
          : 'bg-brand-600/10 border-brand-400/25 hover:bg-brand-600/15'
      }`}
    >
      {/* Unread indicator */}
      {!notif.is_read && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
      )}

      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
        <Icon size={18} className={cfg.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-display font-semibold text-white ${!notif.is_read ? 'font-bold' : ''}`}>
          {notif.title}
        </p>
        {notif.message && (
          <p className="text-xs text-white/55 mt-0.5 font-myanmar line-clamp-2">
            {notif.message}
          </p>
        )}
        <p className="text-[9px] text-white/60 mt-1">
          {timeAgoShort(notif.created_at, lang)}
        </p>
      </div>

      {/* Delete */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="w-7 h-7 rounded-lg btn-danger flex items-center justify-center flex-shrink-0 mt-1"
        aria-label="Delete"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
