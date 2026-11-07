import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCheck, Trash2, ArrowLeft, Star, Building2, AlertCircle, MessageCircle } from 'lucide-react'
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
import { showError, showSuccess } from '../lib/toast'
import { withTimeout } from '../lib/withTimeout'
import { formatMyanmarDate } from '../lib/myanmarDate'
import { goBackOrHome } from '../lib/navigation'

// Notification type → icon + color mapping
const TYPE_CFG = {
  listing_approved:   { icon: Building2,     color: 'text-green-400',  bg: 'bg-green-500/15' },
  listing_rejected:   { icon: Building2,     color: 'text-red-400',    bg: 'bg-red-500/15' },
  new_review:         { icon: Star,          color: 'text-gold-400',   bg: 'bg-gold-500/15' },
  review_approved:    { icon: Star,          color: 'text-gold-400',   bg: 'bg-gold-500/15' },
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
  const [pageSize, setPageSize] = useState(50)
  const [hasMore, setHasMore] = useState(false)
  // v9.29 (bulk delete): ids selected on this page + bulk state.
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(null) // { i, total } while bulkDeleting

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setLoadError('')
    try {
      // 30 s timeout (was none): a hung query left the list on skeletons forever.
      // S32 (v9.17): fetch one extra row — Load more shows only if it exists.
      const data = await withTimeout(getUserNotifications(user.id, pageSize + 1), 30000, 'Notifications')
      const rows = data || []
      setNotifications(rows.slice(0, pageSize))
      setHasMore(rows.length > pageSize)
    } catch (err) {
      console.warn('Load notifications error:', err)
      // F12: never render the raw Supabase English message — store a
      // marker only; the screen renders fixed Myanmar text + Retry.
      setLoadError('load_failed')
      setNotifications([])
    }
    setLoading(false)
  }, [user, pageSize])

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

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllVisible() {
    const visible = notifications.filter(n => filter === 'unread' ? !n.is_read : true)
    setSelectedIds(prev => {
      const allSelected = visible.length > 0 && visible.every(n => prev.has(n.id))
      const next = new Set(prev)
      if (allSelected) visible.forEach(n => next.delete(n.id))
      else visible.forEach(n => next.add(n.id))
      return next
    })
  }

  // v9.29 (bulk delete): delete every selected notification in one go.
  // Sequential deletes through the existing deleteNotification helper
  // (the same single-row delete as handleDelete) — no bulk SQL path.
  // ONE confirm before the loop; failed ids stay selected for retry.
  async function handleBulkDelete() {
    if (bulkDeleting || selectedIds.size === 0) return
    const targets = notifications.filter(n => (filter === 'unread' ? !n.is_read : true) && selectedIds.has(n.id))
    if (targets.length === 0) return
    const names = targets.map(n => n.title).filter(Boolean)
    const shown = names.slice(0, 5)
    const msg = `အသိပေးချက် ${targets.length} ခု ဖျက်မလား? ပြန်မရနိုင်ပါ။\n${shown.map(n => `• ${n}`).join('\n')}${targets.length > 5 ? `\n…နောက်ထပ် ${targets.length - 5} ခု` : ''}`
    if (!(await confirmDialog(msg, {
      title: `အသိပေးချက် ${targets.length} ခု အပြီးဖျက်မည်`,
      confirmText: 'အပြီးဖျက်မည်',
      danger: true,
    }))) return
    setBulkDeleting(true)
    setBulkProgress({ i: 0, total: targets.length })
    const succeeded = []
    const failed = []
    for (let i = 0; i < targets.length; i++) {
      try {
        await deleteNotification(targets[i].id)
        succeeded.push(targets[i])
      } catch (err) {
        console.warn('Bulk delete notification failed:', targets[i].id, err)
        failed.push(targets[i])
      }
      setBulkProgress({ i: i + 1, total: targets.length })
    }
    setBulkDeleting(false)
    setBulkProgress(null)
    const succeededIds = new Set(succeeded.map(n => n.id))
    setNotifications(prev => prev.filter(n => !succeededIds.has(n.id)))
    // Clear ONLY the succeeded ids — failed ids stay selected for retry.
    setSelectedIds(prev => new Set([...prev].filter(id => !succeededIds.has(id))))
    if (failed.length === 0) {
      showSuccess(`✓ အသိပေးချက် ${succeeded.length} ခု ဖျက်ပြီးပါပြီ`)
    } else {
      const failedNames = failed.slice(0, 3).map(f => f.title || 'ဤအသိပေးချက်')
      showError(`ဖျက်မရတာ ${failed.length} ခု (${failedNames.join(', ')}) — ${succeeded.length} ခု ဖျက်ပြီးပါပြီ`)
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
        {/* v9.29: "Mark all read" is ALWAYS visible (disabled at 0
            unread) — it used to render only when unreadCount > 0, so
            with everything read it looked like the button was missing. */}
        <button
          onClick={handleMarkAll}
          disabled={unreadCount === 0}
          className="flex items-center gap-1.5 text-[10px] text-brand-300 hover:text-brand-200 transition-colors px-3 py-2 rounded-xl bg-brand-600/15 border border-brand-400/25 disabled:opacity-50"
        >
          <CheckCheck size={12} />
          {lang === 'mm' ? 'အားလုံးဖတ်ပြီးဟု မှတ်မည်' : 'Mark all read'}
        </button>
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
                onClick={() => { setFilter(t.id); setSelectedIds(new Set()) }}
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

      {/* v9.29 (bulk delete): select-all is PAGE-LEVEL — only the rows
          currently shown under the current filter. Always visible when
          there are rows; flex-wrap, no sideways scroller. The delete
          label says "အပြီးဖျက်မည် — ပြန်မရပါ" so it cannot be misread
          as deselect (9.28 lesson). */}
      {filtered.length > 0 && (
        <div className="px-4 mb-3 flex gap-2 flex-wrap items-center">
          <label className="flex items-center gap-2 text-xs text-white/70 font-myanmar cursor-pointer">
            <input
              type="checkbox"
              checked={filtered.length > 0 && filtered.every(n => selectedIds.has(n.id))}
              onChange={toggleSelectAllVisible}
              disabled={bulkDeleting}
              className="w-5 h-5"
              aria-label="စာရင်းပါ အားလုံး ရွေးမည်"
            />
            <span>စာရင်းပါ {filtered.length} ခု အားလုံး ရွေးမည်</span>
          </label>
          <span className="text-xs text-white/60 font-myanmar">{selectedIds.size} ခု ရွေးထားသည်</span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting || selectedIds.size === 0}
            className="px-4 py-2.5 btn-danger rounded-xl text-xs font-bold disabled:opacity-50"
          >
            {bulkDeleting && bulkProgress
              ? `ဖျက်နေသည်… (${bulkProgress.i}/${bulkProgress.total})`
              : `🗑️ ရွေးထားတာ အပြီးဖျက်မည် (${selectedIds.size}) — ပြန်မရပါ`}
          </button>
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
              selected={selectedIds.has(notif.id)}
              selectDisabled={bulkDeleting}
              onToggleSelect={() => toggleSelect(notif.id)}
              onOpen={() => handleOpen(notif)}
              onDelete={() => handleDelete(notif.id)}
            />
          ))
        )}
        {!loading && !loadError && hasMore && filter === 'all' && (
          <button
            onClick={() => setPageSize(s => s + 50)}
            className="btn-primary w-full text-sm px-4 py-3"
          >
            {lang === 'mm' ? 'ထပ်တင်ရန်' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  )
}

function NotificationRow({ notif, lang, selected, selectDisabled, onToggleSelect, onOpen, onDelete }) {
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
      {/* v9.29 (bulk delete): per-row checkbox — stopPropagation so
          ticking a row never opens it. */}
      <input
        type="checkbox"
        checked={!!selected}
        onChange={(e) => { e.stopPropagation(); onToggleSelect() }}
        onClick={(e) => e.stopPropagation()}
        disabled={selectDisabled}
        className="w-5 h-5 mt-2 flex-shrink-0"
        aria-label="ရွေးမည်"
      />
      {/* Unread indicator */}
      {!notif.is_read && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-brand-400 animate-pulse pointer-events-none" />
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
        className="min-w-[44px] min-h-[44px] rounded-lg btn-danger flex items-center justify-center flex-shrink-0 mt-1"
        aria-label="Delete"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
