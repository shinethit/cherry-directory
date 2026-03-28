import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'        // ← added
import { Plus, X, Pin, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { PostCard, Skeleton, EmptyState, ImageUploader } from '../components/UI'
import { uploadImage, getOptimizedUrl } from '../lib/cloudinary'
import { useSEO } from '../hooks/useSEO'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import 'yet-another-react-lightbox/plugins/thumbnails.css'

const TYPES = [
  { value: '',             label: 'အားလုံး',        labelEn: 'All'           },
  { value: 'news',         label: '📰 သတင်း',       labelEn: '📰 News'       },
  { value: 'event',        label: '📅 Event',        labelEn: '📅 Event'      },
  { value: 'announcement', label: '📢 ကြေညာချက်',  labelEn: '📢 Announcement'},
]

// ── Post Form (Admin/Mod only) – unchanged ────────────────────────────────
function PostForm({ onClose, onSuccess, lang }) {
  const { user, profile, isModerator } = useAuth()
  const [form, setForm] = useState({
    title: '', title_mm: '', content: '', content_mm: '',
    type: 'announcement', is_pinned: false,
    event_start: '', event_location: '',
  })
  const [coverUrl, setCoverUrl] = useState('')
  const [images, setImages] = useState([])        // Gallery images (max 5)
  const [coverLoading, setCoverLoading] = useState(false)
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleCover(file) {
    setCoverLoading(true)
    const url = await uploadImage(file, 'news/covers')
    setCoverUrl(url)
    setCoverLoading(false)
  }

  async function handleGalleryUpload(file) {
    if (images.length >= 5) {
      setError(lang === 'mm' ? 'အများဆုံး ၅ ပုံသာ တင်နိုင်ပါသည်' : 'Maximum 5 images allowed')
      return
    }
    setGalleryLoading(true)
    const url = await uploadImage(file, 'news/gallery')
    setImages(prev => [...prev, url])
    setGalleryLoading(false)
  }

  function removeGalleryImage(index) {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  async function submit() {
    if (!form.title_mm && !form.title) {
      setError(lang === 'mm' ? 'ခေါင်းစဉ် ထည့်ပါ' : 'Title is required')
      return
    }
    setSaving(true)
    const payload = {
      title:       form.title || form.title_mm,
      title_mm:    form.title_mm || null,
      content:     form.content || null,
      content_mm:  form.content_mm || null,
      type:        form.type,
      status:      'published',
      is_pinned:   form.is_pinned,
      cover_url:   coverUrl || null,
      images:      images,
      event_start: form.event_start || null,
      event_location: form.event_location || null,
      author_id:   user?.id,
    }
    const { error: err } = await supabase.from('posts').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0015] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors">
            <X size={18} className="text-white" />
          </button>
          <div>
            <h2 className="font-display font-bold text-base text-white">
              {lang === 'mm' ? 'Post တင်မည်' : 'Create Post'}
            </h2>
            <p className="text-[10px] text-white/40">Admin / Moderator</p>
          </div>
        </div>
        <button
          onClick={submit}
          disabled={saving || (!form.title_mm && !form.title)}
          className="btn-primary text-xs px-4 py-2 disabled:opacity-50"
        >
          {saving ? '...' : lang === 'mm' ? 'ထုတ်ဝေမည်' : 'Publish'}
        </button>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">
        <div>
          <label className="block text-xs text-white/50 mb-2">အမျိုးအစား</label>
          <div className="flex gap-2 flex-wrap">
            {TYPES.filter(t => t.value).map(t => (
              <button
                key={t.value}
                onClick={() => set('type', t.value)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  form.type === t.value
                    ? 'bg-brand-600/60 border-brand-400/50 text-brand-200'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
                }`}
              >
                {lang === 'mm' ? t.label : t.labelEn}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-2">Cover ပုံ (optional)</label>
          {coverUrl ? (
            <div className="relative h-36">
              <img src={coverUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
              <button
                onClick={() => setCoverUrl('')}
                className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-lg flex items-center justify-center text-white hover:bg-red-500/70 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <ImageUploader onUpload={handleCover} loading={coverLoading} label="Cover တင်ရန်" />
          )}
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-2">ဓာတ်ပုံများ (optional, max 5)</label>
          <div className="grid grid-cols-3 gap-2">
            {images.map((url, i) => (
              <div key={i} className="relative aspect-square">
                <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-white/10" />
                <button
                  onClick={() => removeGalleryImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px]"
                >
                  ✕
                </button>
              </div>
            ))}
            {images.length < 5 && (
              <ImageUploader onUpload={handleGalleryUpload} loading={galleryLoading} label="+ ပုံထပ်ထည့်" />
            )}
          </div>
          <p className="text-[9px] text-white/25 mt-1.5">အများဆုံး ၅ ပုံ</p>
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">
            ခေါင်းစဉ် (မြန်မာ) <span className="text-brand-400">*</span>
          </label>
          <input autoFocus
            value={form.title_mm}
            onChange={e => set('title_mm', e.target.value)}
            className="input-dark font-myanmar"
            placeholder="ဥပမာ: မှတ်တမ်း..."
          />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">Title (English) — optional</label>
          <input
            value={form.title}
            onChange={e => set('title', e.target.value)}
            className="input-dark"
            placeholder="Optional English title"
          />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">အကြောင်းအရာ (မြန်မာ)</label>
          <textarea
            value={form.content_mm}
            onChange={e => set('content_mm', e.target.value)}
            className="input-dark font-myanmar resize-none h-32"
            placeholder="Post အကြောင်းအရာ..."
          />
        </div>

        {form.type === 'event' && (
          <div className="space-y-3 border-t border-white/8 pt-3">
            <p className="text-[10px] text-white/40 uppercase tracking-wider font-display">Event Details</p>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">ရက်စွဲ / အချိန်</label>
              <input
                type="datetime-local"
                value={form.event_start}
                onChange={e => set('event_start', e.target.value)}
                className="input-dark"
              />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">တည်နေရာ</label>
              <input
                value={form.event_location}
                onChange={e => set('event_location', e.target.value)}
                className="input-dark font-myanmar"
                placeholder="ကျင်းပမည့် နေရာ..."
              />
            </div>
          </div>
        )}

        <button
          onClick={() => set('is_pinned', !form.is_pinned)}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border w-full text-sm transition-colors ${
            form.is_pinned
              ? 'bg-gold-500/15 border-gold-500/30 text-gold-400'
              : 'bg-white/5 border-white/10 text-white/50'
          }`}
        >
          <Pin size={15} />
          {lang === 'mm' ? 'အထက်တင် (Pinned)' : 'Pin to top'}
        </button>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 font-myanmar">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function NewsPage() {
  const navigate = useNavigate()                       // ← added
  const { lang }        = useLang()
  const { isModerator, isAdmin, isSuperAdmin } = useAuth()
  const canEdit = isSuperAdmin || isAdmin || isModerator
  useSEO({ title: lang === 'mm' ? 'သတင်းနှင့် ဖြစ်ရပ်များ' : 'News & Events' })

  const [posts, setPosts]   = useState([])
  const [pinned, setPinned] = useState([])
  const [loading, setLoading] = useState(true)
  const [type, setType]     = useState('')
  const [showForm, setShowForm] = useState(false)

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  async function load() {
    setLoading(true)
    try {
      let postsQuery = supabase
        .from('posts')
        .select('*, author:profiles(full_name), category:categories(name, name_mm, icon)')
        .eq('status', 'published')
        .eq('is_pinned', false)
        .order('created_at', { ascending: false })
        .limit(30)

      if (type) postsQuery = postsQuery.eq('type', type)

      const [{ data: pinnedData }, { data: postsData }] = await Promise.all([
        supabase
          .from('posts')
          .select('*, author:profiles(full_name), category:categories(name, name_mm, icon)')
          .eq('status', 'published')
          .eq('is_pinned', true)
          .order('created_at', { ascending: false })
          .limit(3),
        postsQuery,
      ])

      setPinned(pinnedData || [])
      setPosts(postsData || [])
    } catch (e) { console.warn(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [type])

  async function handleDelete(postId) {
    if (!confirm(lang === 'mm' ? 'Post ကို ဖျက်မှာလား?' : 'Delete this post?')) return
    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (error) alert(error.message)
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
        {canEdit && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 btn-primary text-xs px-3 py-2"
          >
            <Plus size={14} />
            {lang === 'mm' ? 'Post တင်မည်' : 'New Post'}
          </button>
        )}
      </div>

      <div className="px-4 mb-3">
        <div className="relative">
          <select
            value={type}
            onChange={e => setType(e.target.value)}
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
                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/posts/${p.id}/edit`); }}
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
        ) : posts.length === 0 ? (
          <EmptyState
            icon="📰"
            title={lang === 'mm' ? 'Post မရှိသေးပါ' : 'No posts yet'}
            message={
              canEdit
                ? (lang === 'mm' ? '"Post တင်မည်" ကို နှိပ်ပြီး ပထမဆုံး Post ရေးပါ' : 'Click "New Post" to write the first post')
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
                    onClick={(e) => { e.stopPropagation(); navigate(`/admin/posts/${p.id}/edit`); }}
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

      {showForm && (
        <PostForm
          lang={lang}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); load() }}
        />
      )}

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