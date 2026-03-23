import { useState, useEffect } from 'react'
import { Plus, X as ImageIcon, Pin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { PostCard, Skeleton, EmptyState, ImageUploader } from '../components/UI'
import { uploadImage } from '../lib/cloudinary'
import { useSEO } from '../hooks/useSEO'

const TYPES = [
  { value: '',             label: 'အားလုံး',        labelEn: 'All'           },
  { value: 'news',         label: '📰 သတင်း',       labelEn: '📰 News'       },
  { value: 'event',        label: '📅 Event',        labelEn: '📅 Event'      },
  { value: 'announcement', label: '📢 ကြေညာချက်',  labelEn: '📢 Announcement'},
]

// ── Post Form (Admin/Mod only) ─────────────────────────────────
function PostForm({ onClose, onSuccess, lang }) {
  const { user, profile } = useAuth()
  const [form, setForm] = useState({
    title: '', title_mm: '', content: '', content_mm: '',
    type: 'announcement', is_pinned: false,
    event_start: '', event_location: '',
  })
  const [coverUrl, setCoverUrl] = useState('')
  const [coverLoading, setCoverLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleCover(file) {
    setCoverLoading(true)
    const url = await uploadImage(file, 'news/covers')
    setCoverUrl(url)
    setCoverLoading(false)
  }

  async function submit() {
    if (!form.title_mm && !form.title) {
      setError(lang === 'mm' ? 'ခေါင်းစဉ် ထည့်ပါ' : 'Title is required')
      return
    }
    setSaving(true)
    const { error: err } = await supabase.from('posts').insert({
      title:       form.title || form.title_mm,
      title_mm:    form.title_mm || null,
      content:     form.content || null,
      content_mm:  form.content_mm || null,
      type:        form.type,
      status:      'published',
      is_pinned:   form.is_pinned,
      cover_url:   coverUrl || null,
      event_start: form.event_start || null,
      event_location: form.event_location || null,
      author_id:   user?.id,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0015] overflow-y-auto">
      {/* Header */}
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
        {/* Type selector */}
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

        {/* Cover image */}
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

        {/* Title */}
        <div>
          <label className="block text-xs text-white/50 mb-1.5">
            ခေါင်းစဉ် (မြန်မာ) <span className="text-brand-400">*</span>
          </label>
          <input
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

        {/* Content */}
        <div>
          <label className="block text-xs text-white/50 mb-1.5">အကြောင်းအရာ (မြန်မာ)</label>
          <textarea
            value={form.content_mm}
            onChange={e => set('content_mm', e.target.value)}
            className="input-dark font-myanmar resize-none h-32"
            placeholder="Post အကြောင်းအရာ..."
          />
        </div>

        {/* Event fields */}
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

        {/* Pin toggle */}
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

// ── Main Page ─────────────────────────────────────────────────
export default function NewsPage() {
  const { lang }        = useLang()
  const { isModerator } = useAuth()
  useSEO({ title: lang === 'mm' ? 'သတင်းနှင့် ဖြစ်ရပ်များ' : 'News & Events' })

  const [posts, setPosts]   = useState([])
  const [pinned, setPinned] = useState([])
  const [loading, setLoading] = useState(true)
  const [type, setType]     = useState('')
  const [showForm, setShowForm] = useState(false)

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

  return (
    <div className="py-4 pb-8">

      {/* Header row */}
      <div className="flex items-center justify-between px-4 mb-3">
        <h1 className="font-display font-bold text-xl text-white">
          {lang === 'mm' ? 'သတင်းနှင့် ဖြစ်ရပ်များ' : 'News & Events'}
        </h1>
        {isModerator && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 btn-primary text-xs px-3 py-2"
          >
            <Plus size={14} />
            {lang === 'mm' ? 'Post တင်မည်' : 'New Post'}
          </button>
        )}
      </div>

      {/* Type filter */}
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

      {/* Pinned posts */}
      {!loading && pinned.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-[11px] text-gold-500/70 font-display font-semibold uppercase tracking-wider mb-2">
            📌 {lang === 'mm' ? 'Pinned' : 'Pinned'}
          </p>
          <div className="space-y-3">
            {pinned.map(p => <PostCard key={p.id} post={p} />)}
          </div>
          <div className="border-t border-white/8 mt-4" />
        </div>
      )}

      {/* Posts list */}
      <div className="px-4 space-y-3 pb-24">
        {loading ? (
          [1,2,3].map(n => <Skeleton key={n} className="h-48" />)
        ) : posts.length === 0 ? (
          <EmptyState
            icon="📰"
            title={lang === 'mm' ? 'Post မရှိသေးပါ' : 'No posts yet'}
            message={
              isModerator
                ? (lang === 'mm' ? '"Post တင်မည်" ကို နှိပ်ပြီး ပထမဆုံး Post ရေးပါ' : 'Click "New Post" to write the first post')
                : (lang === 'mm' ? 'မကြာမီ Post တွေ တွေ့ရမည်' : 'Posts will appear here soon')
            }
          />
        ) : (
          posts.map(p => <PostCard key={p.id} post={p} />)
        )}
      </div>

      {/* Post form (Admin/Mod) */}
      {showForm && (
        <PostForm
          lang={lang}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}
