import { Star, MapPin, Bookmark, BookmarkCheck } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOptimizedUrl } from '../lib/cloudinary'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import VerifiedOwnerBadge from './VerifiedOwnerBadge'
import { useIsBookmarked, useAddBookmark, useRemoveBookmark } from '../hooks/useBookmarksDB'
import { showError } from '../lib/toast'
import { formatMyanmarDate } from '../lib/myanmarDate'

// ── Stars ────────────────────────────────────────────────────
export function StarRating({ rating = 0, size = 14 }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <Star key={n} size={size} className={n <= Math.round(rating) ? 'star-filled fill-amber-400' : 'star-empty'} />
      ))}
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────
export function Skeleton({ className = '' }) {
  return <div className={`shimmer rounded-xl ${className}`} />
}

// ── Listing Card ─────────────────────────────────────────────
export function ListingCard({ listing, compact = false }) {
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()
  // Real bookmark state from the bookmarks table (the old local useState
  // toggle was fake — it never persisted anything).
  const { data: bookmarked = false } = useIsBookmarked(listing.id)
  const addBookmark = useAddBookmark()
  const removeBookmark = useRemoveBookmark()

  const logo = listing.logo_url ? getOptimizedUrl(listing.logo_url, { width: 120 }) : null

  function toggleBookmark(e) {
    e.stopPropagation()
    if (!isLoggedIn) { showError('အကောင့်ဝင်မှ သိမ်းနိုင်မည်'); navigate('/login'); return }
    const onError = (err) => showError(err?.message || 'သိမ်းရာတွင် အမှားဖြစ်သွားသည်')
    if (bookmarked) {
      removeBookmark.mutate({ targetId: listing.id, targetType: 'listing' }, { onError })
    } else {
      addBookmark.mutate({ targetId: listing.id, targetType: 'listing' }, { onError })
    }
  }

  return (
    <div onClick={() => navigate(`/directory/${listing.id}`)} className="card-listing cursor-pointer p-4 flex gap-3 group">
      {/* Logo */}
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
        {logo
          ? <img src={logo} alt={listing.name} className="w-full h-full object-contain" loading="lazy" />
          : <span className="text-2xl">{listing.category?.icon || '🏢'}</span>}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-display font-semibold text-sm text-white truncate font-myanmar">
                {listing.name_mm || listing.name}
              </h3>
              {listing.is_verified && <VerifiedOwnerBadge small />}
            </div>
            {listing.name_mm && listing.name && listing.name_mm !== listing.name && (
              <p className="text-[10px] text-white/40 truncate">{listing.name}</p>
            )}
          </div>
          <button onClick={toggleBookmark} className="text-white/30 hover:text-gold-400 transition-colors flex-shrink-0 mt-0.5">
            {bookmarked ? <BookmarkCheck size={16} className="text-gold-400" /> : <Bookmark size={16} />}
          </button>
        </div>

        <div className="flex items-center gap-3 mt-1.5">
          {listing.rating_avg > 0 && (
            <div className="flex items-center gap-1">
              <StarRating rating={listing.rating_avg} size={11} />
              <span className="text-[10px] text-white/40">({listing.rating_count})</span>
            </div>
          )}
          <span className="badge bg-brand-700/60 text-brand-200 text-[9px]">{listing.category?.name_mm || listing.category?.name}</span>
          {listing.is_featured && <span className="badge bg-gold-500/20 text-gold-400 text-[9px]">⭐ Featured</span>}
          {listing.business_type === 'service' && <span className="badge bg-blue-500/15 text-blue-300 text-[9px]">🛠 ဝန်ဆောင်မှု</span>}
          {listing.business_type === 'home' && <span className="badge bg-green-500/15 text-green-300 text-[9px]">🏠 Home-based</span>}
        </div>

        {!compact && (
          <div className="flex items-center gap-1 mt-1.5 text-white/40">
            <MapPin size={10} />
            <span className="text-[10px] truncate">{listing.ward ? `${listing.ward}, ` : ''}{listing.township || listing.city}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Post Card ─────────────────────────────────────────────────
export function PostCard({ post }) {
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()
  const { data: saved = false } = useIsBookmarked(post.id, 'post')
  const addBookmark = useAddBookmark()
  const removeBookmark = useRemoveBookmark()
  const cover = post.cover_url ? getOptimizedUrl(post.cover_url, { width: 400 }) : null
  const typeColor = post.type === 'event' ? 'bg-green-500/20 text-green-400' : post.type === 'announcement' ? 'bg-amber-500/20 text-amber-400' : 'bg-brand-700/60 text-brand-200'
  const typeLabel = post.type === 'event' ? '📅 Event' : post.type === 'announcement' ? '📢 ကြေညာချက်' : '📰 သတင်း'

  return (
    <div onClick={() => navigate(`/news/${post.id}`)} className="card-listing cursor-pointer overflow-hidden">
      {cover && (
        <div className="h-40 overflow-hidden">
          <img src={cover} alt={post.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`badge ${typeColor}`}>{typeLabel}</span>
          {post.is_pinned && <span className="badge bg-gold-500/20 text-gold-400">📌 Pinned</span>}
        </div>
        <h3 className="font-display font-semibold text-sm text-white line-clamp-2 leading-snug font-myanmar">{post.title_mm || post.title}</h3>
        {post.excerpt && <p className="text-[11px] text-white/50 mt-1.5 line-clamp-2 font-myanmar">{post.excerpt}</p>}
        <div className="flex items-center justify-between mt-3 text-white/30 text-[10px]">
          <span>{post.author?.full_name || 'Admin'}</span>
          <span>{formatMyanmarDate(post.created_at)}</span>
          {isLoggedIn && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                const onError = (err) => showError(err?.message || 'သိမ်းရာတွင် အမှားဖြစ်သွားသည်')
                if (saved) removeBookmark.mutate({ targetId: post.id, targetType: 'post' }, { onError })
                else addBookmark.mutate({ targetId: post.id, targetType: 'post' }, { onError })
              }}
              className="flex items-center gap-1 text-brand-300 hover:text-brand-200"
              aria-label="Save"
            >
              {saved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
              {saved ? 'Saved' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Section Header ────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action, onAction }) {
  return (
    <div className="flex items-end justify-between px-4 mb-3">
      <div>
        <h2 className="font-display font-bold text-base text-white">{title}</h2>
        {subtitle && <p className="text-[11px] text-white/40 mt-0.5">{subtitle}</p>}
      </div>
      {action && (
        <button onClick={onAction} className="text-brand-300 text-xs font-semibold hover:text-brand-200 transition-colors">{action} →</button>
      )}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────
export function EmptyState({ icon = '🔍', title, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <span className="text-5xl mb-4">{icon}</span>
      <h3 className="font-display font-semibold text-white/70 mb-1">{title}</h3>
      {message && <p className="text-sm text-white/40 font-myanmar">{message}</p>}
    </div>
  )
}

// ── Image Upload ──────────────────────────────────────────────
export function ImageUploader({ onUpload, loading, label = 'ပုံတင်ရန်' }) {
  function handleChange(e) {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
  }
  return (
    <label className="flex flex-col items-center justify-center h-32 card-dark border-dashed border-white/20 cursor-pointer hover:border-brand-400/50 transition-colors rounded-2xl">
      {loading ? (
        <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <span className="text-2xl mb-1">📷</span>
          <span className="text-xs text-white/50">{label}</span>
        </>
      )}
      <input type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={loading} />
    </label>
  )
}

// ── Reaction Bar ──────────────────────────────────────────────
const EMOJIS = ['❤️', '😂', '😮', '😢', '👏', '🔥']

export function ReactionBar({ targetType, targetId }) {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [counts, setCounts] = useState({})
  const [myReactions, setMyReactions] = useState(new Set())

  // Fetch real counts + my reactions on mount — counts were always blank
  // because nothing ever loaded them.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('reactions')
        .select('emoji, user_id')
        .eq('target_type', targetType)
        .eq('target_id', targetId)
      if (cancelled || error || !data) return
      const c = {}
      const mine = new Set()
      data.forEach(r => {
        c[r.emoji] = (c[r.emoji] || 0) + 1
        if (user && r.user_id === user.id) mine.add(r.emoji)
      })
      setCounts(c)
      setMyReactions(mine)
    }
    load()
    return () => { cancelled = true }
  }, [targetType, targetId, user?.id])

  async function react(emoji) {
    if (!isLoggedIn) { showError('အကောင့်ဝင်မှ Reaction ပေးနိုင်မည်'); navigate('/login'); return }
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const uid = authUser?.id || user?.id
    if (!uid) { showError('အကောင့်ဝင်မှ Reaction ပေးနိုင်မည်'); navigate('/login'); return }
    if (myReactions.has(emoji)) {
      const { error } = await supabase.from('reactions').delete().match({ target_type: targetType, target_id: targetId, user_id: uid, emoji })
      if (error) { showError(error.message); return }
      setMyReactions(s => { const n = new Set(s); n.delete(emoji); return n })
      setCounts(c => ({ ...c, [emoji]: Math.max(0, (c[emoji] || 1) - 1) }))
    } else {
      const { error } = await supabase.from('reactions').insert({ target_type: targetType, target_id: targetId, user_id: uid, emoji })
      if (error) { showError(error.message); return }
      setMyReactions(s => new Set([...s, emoji]))
      setCounts(c => ({ ...c, [emoji]: (c[emoji] || 0) + 1 }))
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => react(emoji)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-all ${myReactions.has(emoji) ? 'bg-brand-600/60 border border-brand-400/50' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}
        >
          <span>{emoji}</span>
          {counts[emoji] > 0 && <span className="text-[10px] text-white/60">{counts[emoji]}</span>}
        </button>
      ))}
    </div>
  )
}