import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { PostCard, Skeleton, EmptyState } from '../components/UI'
import { useSEO } from '../hooks/useSEO'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import 'yet-another-react-lightbox/plugins/thumbnails.css'
import { confirmDialog } from '../lib/confirmDialog'
import { showError } from '../lib/toast'

const TYPES = [
  { value: '',             label: 'အားလုံး',        labelEn: 'All'           },
  { value: 'news',         label: '📰 သတင်း',       labelEn: '📰 News'       },
  { value: 'event',        label: '📅 Event',        labelEn: '📅 Event'      },
  { value: 'announcement', label: '📢 ကြေညာချက်',  labelEn: '📢 Announcement'},
]

export default function NewsPage() {
  const navigate = useNavigate()
  const { lang }        = useLang()
  const { isModerator, isAdmin, isSuperAdmin } = useAuth()
  const canEdit = isSuperAdmin || isAdmin || isModerator
  useSEO({ title: lang === 'mm' ? 'သတင်းနှင့် ဖြစ်ရပ်များ' : 'News & Events' })

  const [posts, setPosts]   = useState([])
  const [pinned, setPinned] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  // Calendar "See all" links here as /news?type=event.
  const [type, setType]     = useState(searchParams.get('type') || '')

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  async function load() {
    setLoading(true)
    setLoadError(false)
    try {
      let postsQuery = supabase
        .from('posts')
        .select('*, author:profiles(full_name), category:categories(name, name_mm, icon)')
        .eq('status', 'published')
        .eq('is_pinned', false)
        .order('created_at', { ascending: false })
        .limit(30)

      if (type) postsQuery = postsQuery.eq('type', type)

      // Pinned posts must respect the type filter too.
      let pinnedQuery = supabase
        .from('posts')
        .select('*, author:profiles(full_name), category:categories(name, name_mm, icon)')
        .eq('status', 'published')
        .eq('is_pinned', true)
        .order('created_at', { ascending: false })
        .limit(3)
      if (type) pinnedQuery = pinnedQuery.eq('type', type)

      const [{ data: pinnedData, error: pinnedErr }, { data: postsData, error: postsErr }] = await Promise.all([
        pinnedQuery,
        postsQuery,
      ])
      if (pinnedErr || postsErr) throw (pinnedErr || postsErr)

      setPinned(pinnedData || [])
      setPosts(postsData || [])
    } catch (e) { console.warn(e); setLoadError(true); setPinned([]); setPosts([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [type])

  async function handleDelete(postId) {
    if (!(await confirmDialog(lang === 'mm' ? 'Post ကို ဖျက်မှာလား?' : 'Delete this post?'))) return
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (error) showError(error.message)
    else load()
  }

  function openLightbox(post, startIndex = 0) {
    const images = []
    if (post.cover_url) images.push(post.cover_url)
    if (post.images && post.images.length) images.push(...post.images)
    setLightboxImages(images.map(src => ({ src })))
    setLightboxIndex(startIndex)
    setLightboxOpen(true)
  }

  function getFirstImage(post) {
    if (post.cover_url) return post.cover_url
    if (post.images && post.images.length) return post.images[0]
    return null
  }

  return (
    <div className="py-4 pb-8">
      <div className="flex items-center justify-between px-4 mb-3">
        <h1 className="font-display font-bold text-xl text-white">
          {lang === 'mm' ? 'သတင်းနှင့် ဖြစ်ရပ်များ' : 'News & Events'}
        </h1>
        {(isAdmin || isModerator) && (
          <button
            onClick={() => navigate('/news/create')}
            className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5"
          >
            <Plus size={14} /> {lang === 'mm' ? 'သတင်းထည့်' : 'Add News'}
          </button>
        )}
      </div>

      <div className="px-4 mb-3">
        <div className="relative">
          <select
            value={type}
            onChange={e => { setType(e.target.value); if (e.target.value) setSearchParams({ type: e.target.value }, { replace: true }); else setSearchParams({}, { replace: true }) }}
            className="select-dark"
          >
            {TYPES.map(t => (
              <option key={t.value} value={t.value} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                {lang === 'mm' ? t.label : t.labelEn}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      {!loading && pinned.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-[11px] text-gold-500/70 font-display font-semibold uppercase tracking-wider mb-2">
            📌 {lang === 'mm' ? 'Pinned' : 'Pinned'}
          </p>
          <div className="space-y-3">
            {pinned.map(p => (
              <div key={p.id} className="relative">
                <div onClick={() => navigate(`/news/${p.id}`)}>
                  <PostCard post={p} />
                </div>
                {canEdit && (
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(p.type === 'event' ? `/events/edit/${p.id}` : `/news/edit/${p.id}`); }}
                      className="p-1.5 bg-black/50 rounded-lg text-white/70 hover:text-white"
                      title="Edit"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                      className="p-1.5 bg-black/50 rounded-lg text-white/70 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-white/8 mt-4" />
        </div>
      )}

      <div className="px-4 space-y-3 pb-24">
        {loading ? (
          [1,2,3].map(n => <Skeleton key={n} className="h-48" />)
        ) : loadError ? (
          <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
            <p className="text-sm text-red-400 font-myanmar">Data တင်ရာတွင် အမှားဖြစ်သွားသည်</p>
            <button onClick={load} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button>
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon="📰"
            title={lang === 'mm' ? 'Post မရှိသေးပါ' : 'No posts yet'}
            message={
              canEdit
                ? (lang === 'mm' ? '"သတင်းထည့်" ကို နှိပ်ပြီး ပထမဆုံး သတင်း ရေးပါ' : 'Click "Add News" to write the first post')
                : (lang === 'mm' ? 'မကြာမီ Post တွေ တွေ့ရမည်' : 'Posts will appear here soon')
            }
          />
        ) : (
          posts.map(p => (
            <div key={p.id} className="relative group">
              <div onClick={() => navigate(`/news/${p.id}`)} className="cursor-pointer">
                <PostCard post={p} />
              </div>
              {canEdit && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(p.type === 'event' ? `/events/edit/${p.id}` : `/news/edit/${p.id}`); }}
                    className="p-1.5 bg-black/60 rounded-lg text-white/80 hover:text-white backdrop-blur-sm"
                    title="Edit"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                    className="p-1.5 bg-black/60 rounded-lg text-white/80 hover:text-red-400 backdrop-blur-sm"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
              {getFirstImage(p) && (
                <button
                  onClick={(e) => { e.stopPropagation(); openLightbox(p, 0); }}
                  className="absolute bottom-2 left-2 p-1.5 bg-black/50 rounded-full text-white/60 hover:text-white"
                  title="View images"
                >
                  🖼️
                </button>
              )}
            </div>
          ))
        )}
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