import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Eye, CheckCircle, Star, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ReactionBar, Skeleton } from '../components/UI'
import { getOptimizedUrl } from '../lib/cloudinary'
import { useAuth } from '../contexts/AuthContext'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import 'yet-another-react-lightbox/plugins/thumbnails.css'

// Inline RSVP (unchanged)
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
    if (!isLoggedIn) { navigate('/login'); return }
    setLoading(true)
    if (status === newStatus) {
      await supabase.from('event_rsvps').delete().match({ post_id: postId, user_id: user.id })
      setCounts(c => ({ ...c, [newStatus]: Math.max(0, c[newStatus] - 1) }))
      setStatus(null)
    } else {
      if (status) setCounts(c => ({ ...c, [status]: Math.max(0, c[status] - 1) }))
      await supabase.from('event_rsvps').upsert({ post_id: postId, user_id: user.id, status: newStatus })
      setCounts(c => ({ ...c, [newStatus]: c[newStatus] + 1 }))
      setStatus(newStatus)
    }
    setLoading(false)
  }

  return (
    <div className="card-dark p-4 rounded-2xl space-y-3">
      <p className="text-xs text-white/40 font-display font-semibold uppercase tracking-wider">
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
          Going {counts.going > 0 && <span className="text-xs opacity-70">({counts.going})</span>}
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
          Interested {counts.interested > 0 && <span className="text-xs opacity-70">({counts.interested})</span>}
        </button>
      </div>
      {!isLoggedIn && (
        <p className="text-[10px] text-white/30 font-myanmar">RSVP လုပ်ရန် Login လိုအပ်သည်</p>
      )}
    </div>
  )
}

export default function PostDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isSuperAdmin, isAdmin, isModerator } = useAuth()
  const [post, setPost] = useState(null)

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  useEffect(() => {
    supabase.from('posts').select('*, author:profiles(full_name, avatar_url), category:categories(name, name_mm, icon)').eq('id', id).single().then(({ data }) => {
      setPost(data)
      if (data) supabase.from('posts').update({ view_count: (data.view_count || 0) + 1 }).eq('id', id)
    })
  }, [id])

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this post?')) return
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) alert(error.message)
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

  if (!post) return <div className="p-4 space-y-3"><Skeleton className="h-64" /><Skeleton className="h-48" /></div>

  const cover = post.cover_url ? getOptimizedUrl(post.cover_url, { width: 800 }) : null
  const typeColor = post.type === 'event' ? 'bg-green-500/20 text-green-400 border-green-500/30' : post.type === 'announcement' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-brand-700/60 text-brand-200 border-brand-500/30'
  const canEdit = isSuperAdmin || isAdmin || isModerator

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <button
                onClick={() => navigate(`/admin/posts/${id}/edit`)}
                className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center hover:bg-blue-500/30"
                title="Edit"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={handleDelete}
                className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/30"
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
        <div className="mx-4 rounded-2xl overflow-hidden mb-4 h-52 cursor-pointer" onClick={() => openLightbox(0)}>
          <img src={cover} alt={post.title} className="w-full h-full object-cover hover:scale-105 transition duration-300" />
        </div>
      )}

      <div className="px-4 space-y-4">
        <div>
          <h1 className="font-display font-bold text-xl text-white leading-tight">{post.title_mm || post.title}</h1>
          {post.title_mm && post.title && <p className="text-sm text-white/50 mt-1">{post.title}</p>}
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-white/40">
          <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(post.created_at).toLocaleDateString('my-MM', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          {post.author?.full_name && <span>✍️ {post.author.full_name}</span>}
          {post.view_count > 0 && <span className="flex items-center gap-1"><Eye size={12} /> {post.view_count}</span>}
        </div>

        {/* Event specific info */}
        {post.type === 'event' && (post.event_start || post.event_location) && (
          <div className="card-dark p-4 rounded-2xl space-y-2">
            {post.event_start && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-green-400" />
                <span className="text-white/70">{new Date(post.event_start).toLocaleString('my-MM')}</span>
                {post.event_end && <span className="text-white/40">— {new Date(post.event_end).toLocaleString('my-MM')}</span>}
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
          <p className="text-sm text-white/75 font-myanmar leading-relaxed whitespace-pre-wrap">{post.content_mm || post.content}</p>
        </div>

        {/* Additional images with lightbox */}
        {post.images?.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {post.images.filter(Boolean).map((img, i) => (
              <div key={i} className="aspect-video rounded-xl overflow-hidden cursor-pointer" onClick={() => openLightbox(i + (post.cover_url ? 1 : 0))}>
                <img src={getOptimizedUrl(img, { width: 400 })} alt="" className="w-full h-full object-cover hover:scale-105 transition" />
              </div>
            ))}
          </div>
        )}

        {/* Reactions */}
        <div>
          <p className="text-xs text-white/40 mb-2 font-display font-semibold uppercase tracking-wider">Reactions</p>
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