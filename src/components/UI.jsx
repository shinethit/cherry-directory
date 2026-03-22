import { Star, MapPin, Phone, CheckCircle, Bookmark, BookmarkCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOptimizedUrl } from '../lib/cloudinary'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import VerifiedOwnerBadge from './VerifiedOwnerBadge'

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
  const [bookmarked, setBookmarked] = useState(false)

  const logo = listing.logo_url ? getOptimizedUrl(listing.logo_url, { width: 120 }) : null

  async function toggleBookmark(e) {
    e.stopPropagation()
    if (!isLoggedIn) { navigate('/login'); return }
    setBookmarked(b => !b)
    // TODO: upsert/delete from bookmarks table
  }

  return (
    <div onClick={() => navigate(`/directory/${listing.id}`)} className="card-listing cursor-pointer p-4 flex gap-3 group">
      {/* Logo */}
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
        {logo
          ? <img src={logo} alt={listing.name} className="w-full h-full object-contain" />
          : <span className="text-2xl">{listing.category?.icon || '🏢'}</span>}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-display font-semibold text-sm text-white truncate">{listing.name}</h3>
              {listing.is_verified && <VerifiedOwnerBadge small />}
            </div>
            {listing.name_mm && <p className="text-[11px] text-white/50 truncate font-myanmar">{listing.name_mm}</p>}
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
  const cover = post.cover_url ? getOptimizedUrl(post.cover_url, { width: 400 }) : null
  const typeColor = post.type === 'event' ? 'bg-green-500/20 text-green-400' : post.type === 'announcement' ? 'bg-amber-500/20 text-amber-400' : 'bg-brand-700/60 text-brand-200'
  const typeLabel = post.type === 'event' ? '📅 Event' : post.type === 'announcement' ? '📢 ကြေညာချက်' : '📰 သတင်း'

  return (
    <div onClick={() => navigate(`/news/${post.id}`)} className="card-listing cursor-pointer overflow-hidden">
      {cover && (
        <div className="h-40 overflow-hidden">
          <img src={cover} alt={post.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`badge ${typeColor}`}>{typeLabel}</span>
          {post.is_pinned && <span className="badge bg-gold-500/20 text-gold-400">📌 Pinned</span>}
        </div>
        <h3 className="font-display font-semibold text-sm text-white line-clamp-2 leading-snug">{post.title_mm || post.title}</h3>
        {post.excerpt && <p className="text-[11px] text-white/50 mt-1.5 line-clamp-2 font-myanmar">{post.excerpt}</p>}
        <div className="flex items-center justify-between mt-3 text-white/30 text-[10px]">
          <span>{post.author?.full_name || 'Admin'}</span>
          <span>{new Date(post.created_at).toLocaleDateString('my-MM')}</span>
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
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [counts, setCounts] = useState({})
  const [myReactions, setMyReactions] = useState(new Set())

  async function react(emoji) {
    if (!isLoggedIn) { navigate('/login'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (myReactions.has(emoji)) {
      await supabase.from('reactions').delete().match({ target_type: targetType, target_id: targetId, user_id: user.id, emoji })
      setMyReactions(s => { const n = new Set(s); n.delete(emoji); return n })
      setCounts(c => ({ ...c, [emoji]: Math.max(0, (c[emoji] || 1) - 1) }))
    } else {
      await supabase.from('reactions').insert({ target_type: targetType, target_id: targetId, user_id: user.id, emoji })
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
