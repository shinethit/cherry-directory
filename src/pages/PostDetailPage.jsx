import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Eye, CheckCircle, Star, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { ReactionBar, Skeleton } from '../components/UI'
import { getOptimizedUrl } from '../lib/cloudinary'
import { useAuth } from '../contexts/AuthContext'
import ShareButton from '../components/ShareButton'
import { getCountdown } from '../lib/countdown'
import { goBackOrHome } from '../lib/navigation'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import 'yet-another-react-lightbox/plugins/thumbnails.css'
import { confirmDialog } from '../lib/confirmDialog'
import { showError } from '../lib/toast'
import { formatMyanmarDate, formatMyanmarDateTime } from '../lib/myanmarDate'

// Inline RSVP — a normal sync component (React 19 async components are not
// relied on here).
function RsvpSection({ postId }) {
  const { isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [counts, setCounts] = useState({ going: 0, interested: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [{ data: all }, { data: mine }] = await Promise.all([
          supabase.from('event_rsvps').select('status').eq('post_id', postId),
          user ? supabase.from('event_rsvps').select('status').eq('post_id', postId).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
        ])
        const c = { going: 0, interested: 0 }
        ;(all || []).forEach(r => { if (r.status in c) c[r.status]++ })
        setCounts(c)
        setStatus(mine?.status || null)
      } catch (e) { console.warn(e) }
    }
    load()
  }, [postId, user])

  async function rsvp(newStatus) {
    if (!isLoggedIn) { showError('အကောင့်ဝင်မှ RSVP လုပ်နိုင်မည်'); navigate('/login'); return }
    setLoading(true)
    if (status === newStatus) {
      const { error } = await supabase.from('event_rsvps').delete().match({ post_id: postId, user_id: user.id })
      if (error) { showError(error.message); setLoading(false); return }
      setCounts(c => ({ ...c, [newStatus]: Math.max(0, c[newStatus] - 1) }))
      setStatus(null)
    } else {
      const { error } = await supabase.from('event_rsvps').upsert(
        { post_id: postId, user_id: user.id, status: newStatus },
        { onConflict: 'post_id,user_id' }
      )
      if (error) { showError(error.message); setLoading(false); return }
      if (status) setCounts(c => ({ ...c, [status]: Math.max(0, c[status] - 1) }))
      setCounts(c => ({ ...c, [newStatus]: c[newStatus] + 1 }))
      setStatus(newStatus)
    }
    setLoading(false)
  }

  return (
    <div className="card-dark p-4 rounded-2xl space-y-3">
      <p className="text-xs text-white/60 font-display font-semibold uppercase tracking-wider">
        တက်ရောက်မည်လား?
      </p>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => rsvp('going')}
          disabled={loading}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
            status === 'going'
              ? 'bg-green-500/25 border-green-500/50 text-green-400'
              : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20'
          }`}
        >
          <CheckCircle size={14} />
          သွားမည် {counts.going > 0 && <span className="text-xs opacity-70">({counts.going})</span>}
        </button>
        <button
          onClick={() => rsvp('interested')}
          disabled={loading}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
            status === 'interested'
              ? 'bg-amber-500/25 border-amber-500/50 text-amber-400'
              : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20'
          }`}
        >
          <Star size={13} />
          ဖြစ်နိုင်သည် {counts.interested > 0 && <span className="text-xs opacity-70">({counts.interested})</span>}
        </button>
      </div>
      {!isLoggedIn && (
        <p className="text-[10px] text-white/60 font-myanmar">RSVP လုပ်ရန် Login လိုအပ်သည်</p>
      )}
    </div>
  )
}

export default function PostDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isSuperAdmin, isAdmin, isModerator } = useAuth()
  const [post, setPost] = useState(null)

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    setLoadError(false)
    // 30 s timeout (was none): a hung query left the page on skeletons
    // forever with no retry — the .catch below only runs once it settles.
    withTimeout(supabase.from('posts').select('*, author:profiles(full_name, avatar_url), category:categories(name, name_mm, icon)').eq('id', id).single(), 30000, 'Post').then(({ data, error }) => {
      if (error && error.code !== 'PGRST116') { setLoadError(true); setLoading(false); return }
      if (!data) { setNotFound(true); setLoading(false); return }
      setPost(data)
      supabase.from('posts').update({ view_count: (data.view_count || 0) + 1 }).eq('id', id)
      setLoading(false)
    }).catch(() => { setLoadError(true); setLoading(false) })
  }, [id])

  async function handleDelete() {
    if (!(await confirmDialog('ဤပို့စ်ကို ဖျက်မှာ သေချာလား?', { danger: true }))) return
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) showError(error.message)
    else navigate('/news')
  }

  function openLightbox(startIndex = 0) {
    const images = []
    if (post?.cover_url) images.push(post.cover_url)
    if (post?.images?.length) images.push(...post.images)
    setLightboxImages(images.map(src => ({ src })))
    setLightboxIndex(startIndex)
    setLightboxOpen(true)
  }

  if (loading) return <div className="p-4 space-y-3"><Skeleton className="h-64" /><Skeleton className="h-48" /></div>

  if (notFound) return (
    <div className="p-4 py-16 text-center space-y-3">
      <p className="text-5xl">😶</p>
      <p className="font-display font-semibold text-white/70">မတွေ့ပါ</p>
      <p className="text-xs text-white/60 font-myanmar">ဤပို့စ် မရှိတော့ပါ (ဖျက်လိုက်ပြီ ဖြစ်နိုင်သည်)</p>
      <button onClick={() => navigate('/news')} className="btn-primary text-sm px-5 py-2.5">နောက်သို့</button>
    </div>
  )

  if (loadError) return (
    <div className="p-4 py-16 text-center space-y-3">
      <p className="text-sm text-red-400 font-myanmar">Data တင်ရာတွင် အမှားဖြစ်သွားသည်</p>
      <button onClick={() => window.location.reload()} className="btn-primary text-sm px-5 py-2.5">ပြန်ကြိုးစားမည်</button>
    </div>
  )

  if (!post) return null

  const cover = post.cover_url ? getOptimizedUrl(post.cover_url, { width: 800 }) : null
  const totalImages = (post.cover_url ? 1 : 0) + (post.images?.filter(Boolean).length || 0)
  const eventCountdown = post.type === 'event' ? getCountdown(post.event_start) : null
  const typeColor = post.type === 'event' ? 'bg-green-500/20 text-green-400 border-green-500/30' : post.type === 'announcement' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-brand-700/60 text-brand-200 border-brand-500/30'
  const canEdit = isSuperAdmin || isAdmin || isModerator || (post && post.author_id && post.author_id === user?.id)

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => goBackOrHome(navigate, '/news')} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="flex gap-2">
          <ShareButton
            url={typeof window !== "undefined" ? window.location.href : ""}
            title={post.title_mm || post.title}
            description={post.content_mm || post.content}
          />
          {canEdit && (
            <>
              <button
                onClick={() => navigate(post.type === 'event' ? `/events/edit/${id}` : `/news/edit/${id}`)}
                className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center hover:bg-blue-500/30"
                title="Edit"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={handleDelete}
                className="w-8 h-8 rounded-lg btn-danger flex items-center justify-center"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cover with lightbox */}
      {cover && (
        <div className="mx-4 rounded-2xl overflow-hidden mb-4 h-52 cursor-pointer relative" onClick={() => openLightbox(0)}>
          <img src={cover} alt={post.title} className="w-full h-full object-cover hover:scale-105 transition duration-300" />
          {totalImages > 1 && (
            <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">1 / {totalImages}</span>
          )}
        </div>
      )}

      <div className="px-4 space-y-4">
        <div>
          <h1 className="font-display font-bold text-xl text-white leading-tight">{post.title_mm || post.title}</h1>
          {post.title_mm && post.title && <p className="text-sm text-white/50 mt-1">{post.title}</p>}
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-white/60">
          <span className="flex items-center gap-1"><Calendar size={12} /> {formatMyanmarDate(post.created_at, { year: true })}</span>
          {post.author?.full_name && <span>✍️ {post.author.full_name}</span>}
          {post.view_count > 0 && <span className="flex items-center gap-1"><Eye size={12} /> {post.view_count}</span>}
        </div>

        {/* Event specific info */}
        {post.type === 'event' && (post.event_start || post.event_location) && (
          <div className="card-dark p-4 rounded-2xl space-y-2">
            {eventCountdown && (
              <div className="flex items-center gap-2">
                <span className={'text-xs font-bold ' + eventCountdown.cls}>{eventCountdown.label}</span>
                {eventCountdown.urgent && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
              </div>
            )}
            {post.event_start && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-green-400" />
                <span className="text-white/70">{formatMyanmarDateTime(post.event_start)}</span>
                {post.event_end && <span className="text-white/60">— {formatMyanmarDateTime(post.event_end)}</span>}
              </div>
            )}
            {post.event_location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={14} className="text-brand-300" />
                <span className="text-white/70 font-myanmar">{post.event_location}</span>
              </div>
            )}
          </div>
        )}

        {/* RSVP — events only */}
        {post.type === 'event' && new Date(post.event_end || post.event_start) >= new Date() && (
          <RsvpSection postId={id} />
        )}

        {/* Content */}
        <div className="prose prose-invert max-w-none">
          <p className="text-sm text-white/75 font-myanmar leading-relaxed whitespace-pre-wrap break-words">{post.content_mm || post.content}</p>
        </div>

        {/* Additional images with lightbox */}
        {post.images?.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {post.images.filter(Boolean).map((img, i) => (
              <div key={i} className="aspect-video rounded-xl overflow-hidden cursor-pointer relative" onClick={() => openLightbox(i + (post.cover_url ? 1 : 0))}>
                <img src={getOptimizedUrl(img, { width: 400 })} alt={post.title_mm || post.title} className="w-full h-full object-cover hover:scale-105 transition" />
                <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">{i + (post.cover_url ? 2 : 1)} / {totalImages}</span>
              </div>
            ))}
          </div>
        )}

        {/* Reactions */}
        <div>
          <p className="text-xs text-white/60 mb-2 font-display font-semibold uppercase tracking-wider">Reactions</p>
          <ReactionBar targetType="post" targetId={id} />
        </div>
      </div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxImages}
        index={lightboxIndex}
        plugins={[Zoom, Thumbnails]}
        zoom={{ maxZoomPixelRatio: 3 }}
      />
    </div>
  )
}