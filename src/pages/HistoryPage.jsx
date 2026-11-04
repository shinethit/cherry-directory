import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Users, BookOpen, Plus, Edit2, Trash2, Clock, CheckCircle, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../contexts/AppConfigContext'
import { useSEO } from '../hooks/useSEO'
import { uploadImage } from '../lib/cloudinary'
import { ImageUploader } from '../components/UI'
import { Skeleton } from '../components/UI'
import ShareButton from '../components/ShareButton'
import { confirmDialog } from '../lib/confirmDialog'
import { showError } from '../lib/toast'
import { formatMyanmarDate } from '../lib/myanmarDate'

const HISTORY_CATS = [
  { id: 'all',        mm: 'အားလုံး',          en: 'All',         icon: '📜' },
  { id: 'history',    mm: 'သမိုင်း',           en: 'History',     icon: '🏛️' },
  { id: 'culture',    mm: 'ယဉ်ကျေးမှု',       en: 'Culture',     icon: '🎭' },
  { id: 'tradition',  mm: 'ဓလေ့ထုံးတမ်း',    en: 'Tradition',   icon: '🙏' },
  { id: 'festival',   mm: 'ပွဲတော်များ',      en: 'Festivals',   icon: '🎉' },
  { id: 'landmark',   mm: 'ထင်ရှားသောနေရာ',  en: 'Landmarks',   icon: '🏔️' },
  { id: 'people',     mm: 'ထင်ရှားသူများ',   en: 'Notable People', icon: '👤' },
  { id: 'food',       mm: 'ဒေသအစားအစာ',     en: 'Local Food',  icon: '🍜' },
  { id: 'nature',     mm: 'သဘာဝ',            en: 'Nature',      icon: '🌿' },
]

function timeAgo(iso, lang) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 60) return `${m}${lang === 'mm' ? 'မိနစ်' : 'm'}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}${lang === 'mm' ? 'နာရီ' : 'h'}`
  return `${Math.floor(h/24)}${lang === 'mm' ? 'ရက်' : 'd'}`
}

function readingTime(text, lang) {
  if (!text) return null
  const chars = text.length
  const mins = Math.max(1, Math.round(chars / 500))
  return lang === 'mm' ? `${mins} မိနစ် ဖတ်ရန်` : `${mins} min read`
}

// Image with a skeleton placeholder while it loads (no blank gap).
function GalleryImg({ src, className, alt }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="relative w-full h-full">
      {!loaded && <div className="absolute inset-0 shimmer" />}
      <img src={src} alt={alt || 'ပုံ'} loading="lazy" onLoad={() => setLoaded(true)} className={className + (loaded ? ' opacity-100' : ' opacity-0') + ' transition-opacity duration-300'} />
    </div>
  )
}

function HistoryCard({ post, lang, isModerator, onEdit, onDelete }) {
  const navigate = useNavigate()
  const cat = HISTORY_CATS.find(c => c.id === post.category) || HISTORY_CATS[0]

  return (
    <div className="card-dark rounded-2xl overflow-hidden border border-white/8 hover:border-brand-500/30 transition-all cursor-pointer" onClick={() => navigate(`/history/${post.id}`)}>
      {post.cover_url && (
        <div className="h-40 overflow-hidden">
          <GalleryImg src={post.cover_url} className="w-full h-full object-cover" alt={post.title_mm || post.title} />
        </div>
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{cat.icon}</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-300 border border-brand-400/20">
              {lang === 'mm' ? cat.mm : cat.en}
            </span>
            {post.location_mm && (
              <span className="text-[9px] text-white/60 flex items-center gap-1">
                <MapPin size={9} /> {post.location_mm}
              </span>
            )}
          </div>
          {isModerator && (
            <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
              <button onClick={() => onEdit(post)} className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center hover:bg-white/12">
                <Edit2 size={11} className="text-white/50" />
              </button>
              <button onClick={() => onDelete(post.id)} className="w-7 h-7 rounded-lg btn-danger flex items-center justify-center">
                <Trash2 size={11} className="text-white" />
              </button>
            </div>
          )}
        </div>

        <h3 className="font-display font-semibold text-base text-white">{post.title_mm || post.title}</h3>
        
        {post.excerpt_mm && (
          <p className="text-xs text-white/60 font-myanmar line-clamp-3">{post.excerpt_mm}</p>
        )}

        <div className="flex items-center gap-3 text-[10px] text-white/60 pt-1 flex-wrap">
          {post.event_date && (
            <span className="flex items-center gap-1"><Calendar size={10} /> {formatMyanmarDate(post.event_date)}</span>
          )}
          <span className="flex items-center gap-1"><Clock size={10} /> {timeAgo(post.created_at, lang)}</span>
          {post.content_mm && (
            <span className="flex items-center gap-1 text-white/60">📖 {readingTime(post.content_mm, lang)}</span>
          )}
          {post.author_name && <span>✍️ {post.author_name}</span>}
        </div>
      </div>
    </div>
  )
}

function HistoryForm({ onClose, onSuccess, lang, editPost }) {
  const { user, profile, isModerator, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '', title_mm: '', excerpt_mm: '', content_mm: '',
    category: 'history', location_mm: '', event_date: '',
    author_name: '', author_bio: '',
  })
  const [coverUrl, setCoverUrl] = useState('')
  const [images, setImages] = useState([])
  const [coverLoading, setCoverLoading] = useState(false)
  const [imgLoading, setImgLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (editPost) {
      setForm({
        title: editPost.title || '',
        title_mm: editPost.title_mm || '',
        excerpt_mm: editPost.excerpt_mm || '',
        content_mm: editPost.content_mm || '',
        category: editPost.category || 'history',
        location_mm: editPost.location_mm || '',
        event_date: editPost.event_date || '',
        author_name: editPost.author_name || '',
        author_bio: editPost.author_bio || '',
      })
      setCoverUrl(editPost.cover_url || '')
      setImages(editPost.images || [])
    }
  }, [editPost])

  if (!isModerator) return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 pt-safe">
      <div className="w-full max-w-lg bg-[#1a0030] border border-white/10 rounded-t-3xl p-6 pb-24 text-center">
        <p className="text-white font-myanmar mb-4">သမိုင်းအကြောင်း တင်ရန် Moderator သာ ခွင့်ရှိသည်</p>
        <button onClick={onClose} className="btn-primary w-full">ပိတ်မည်</button>
      </div>
    </div>
  )

  async function handleCoverUpload(file) {
    setCoverLoading(true)
    try {
      const url = await uploadImage(file, 'history/covers')
      setCoverUrl(url)
    } catch (err) {
      showError(err.message || (lang === 'mm' ? 'ပုံတင်ရာတွင် အမှားရှိသည်' : 'Image upload failed'))
    } finally {
      setCoverLoading(false)
    }
  }

  async function handleImageUpload(file) {
    setImgLoading(true)
    try {
      const url = await uploadImage(file, 'history/gallery')
      setImages(prev => [...prev, url])
    } catch (err) {
      showError(err.message || (lang === 'mm' ? 'ပုံတင်ရာတွင် အမှားရှိသည်' : 'Image upload failed'))
    } finally {
      setImgLoading(false)
    }
  }

  async function submit() {
    if (!form.title_mm && !form.title) return
    setSubmitting(true)
    const payload = {
      ...form,
      // `title` is NOT NULL in the schema; fall back to the Myanmar title.
      title: form.title || form.title_mm,
      cover_url: coverUrl || null,
      images,
      author_id: user?.id,
      author_name: form.author_name || profile?.full_name || profile?.nickname,
      status: 'published',
    }
    
    if (editPost) {
      const { error } = await supabase.from('history').update(payload).eq('id', editPost.id)
      if (error) {
        console.error('Update error:', error)
        showError(error.message)
        setSubmitting(false)
        return
      }
    } else {
      // created_at only on insert — edits must not reset the post date.
      const { error } = await supabase.from('history').insert({ ...payload, created_at: new Date().toISOString() })
      if (error) {
        console.error('Insert error:', error)
        showError(error.message)
        setSubmitting(false)
        return
      }
    }
    setSubmitting(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0015] overflow-y-auto pt-safe">
      <div className="flex items-center justify-between px-4 py-3 bg-[#140020] border-b border-white/8 sticky top-0 z-40">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
        <h2 className="font-display font-bold text-base text-white">{editPost ? (lang === 'mm' ? 'ပြင်ဆင်မည်' : 'Edit') : (lang === 'mm' ? 'သမိုင်းအကြောင်း တင်မည်' : 'Post History')}</h2>
        <button onClick={submit} disabled={submitting || (!form.title_mm && !form.title)} className="btn-primary text-xs px-4 py-2">{submitting ? '...' : (lang === 'mm' ? 'တင်မည်' : 'Post')}</button>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">
        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'အမျိုးအစား' : 'Category'}</label>
          <div className="flex gap-2 flex-wrap">
            {HISTORY_CATS.filter(c => c.id !== 'all').map(c => (
              <button key={c.id} onClick={() => set('category', c.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border ${form.category === c.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>
                {c.icon} {lang === 'mm' ? c.mm : c.en}
              </button>
            ))}
          </div>
        </div>

        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ခေါင်းစဉ် (မြန်မာ)' : 'Title (Myanmar)'} *</label><input value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: တောင်ကြီးမြို့ သမိုင်းအကျဉ်း" /></div>
        
        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'နေရာ' : 'Location'}</label><input value={form.location_mm} onChange={e => set('location_mm', e.target.value)} className="input-dark font-myanmar" placeholder="တောင်ကြီးမြို့၊ အင်းလေးကန်၊ ကလောမြို့..." /></div>
        
        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဖြစ်စဉ်နေ့စွဲ (သက်ဆိုင်ပါက)' : 'Event Date (if applicable)'}</label><input type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} className="input-dark" /></div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'အကျဉ်းချုပ်' : 'Excerpt'}</label>
          <textarea value={form.excerpt_mm} onChange={e => set('excerpt_mm', e.target.value)} className="input-dark font-myanmar resize-none h-20" placeholder="အကျဉ်းချုပ် ဖော်ပြချက်..." />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'အပြည့်အစုံ' : 'Full Content'}</label>
          <textarea value={form.content_mm} onChange={e => set('content_mm', e.target.value)} className="input-dark font-myanmar resize-none h-40" placeholder="အသေးစိတ် ဖော်ပြချက်..." />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ခေါင်းစဉ်ပုံ (Cover)' : 'Cover Image'}</label>
          {coverUrl ? (
            <div className="relative h-32">
              <img src={coverUrl} alt={form.title_mm || form.title || 'Cover'} className="w-full h-full object-cover rounded-xl" />
              <button onClick={() => setCoverUrl('')} className="absolute top-2 right-2 w-11 h-11 bg-black/60 rounded-lg flex items-center justify-center text-white text-xs">✕</button>
            </div>
          ) : (
            <ImageUploader onUpload={handleCoverUpload} loading={coverLoading} label="Cover တင်ရန်" />
          )}
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဓာတ်ပုံများ' : 'Gallery Images'}</label>
          <div className="flex gap-2 flex-wrap">
            {images.map((url, i) => (
              <div key={i} className="relative w-20 h-20">
                <GalleryImg src={url} className="w-full h-full object-cover rounded-xl" alt={form.title_mm || form.title || 'ပုံ'} />
                <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-11 h-11 btn-danger rounded-full text-white text-xs flex items-center justify-center">✕</button>
              </div>
            ))}
            {images.length < 10 && <ImageUploader onUpload={handleImageUpload} loading={imgLoading} label="+" />}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ရေးသားသူအမည်' : 'Author Name'}</label><input value={form.author_name} onChange={e => set('author_name', e.target.value)} className="input-dark font-myanmar" placeholder={profile?.full_name || 'Anonymous'} /></div>
          <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ရေးသားသူအကြောင်း' : 'Author Bio'}</label><input value={form.author_bio} onChange={e => set('author_bio', e.target.value)} className="input-dark font-myanmar" placeholder="ဒေသသမိုင်းပညာရှင်..." /></div>
        </div>
      </div>
    </div>
  )
}

// ========== HistoryDetailPage Component ==========
export function HistoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { lang } = useLang()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [related, setRelated] = useState([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError('')
      // Drafts must not be readable by direct URL.
      // 30 s timeout + try/catch (was a bare await): a hung or rejected
      // query left the page on skeletons forever with no retry.
      let postData = null
      try {
        const { data, error } = await withTimeout(supabase.from('history').select('*').eq('id', id).eq('status', 'published').single(), 30000, 'History post')
        if (cancelled) return
        if (error) {
          // Never show the raw Supabase error to the user: 'not_found'
          // for a missing post, 'load_failed' for anything else.
          setLoadError(error.code === 'PGRST116' ? 'not_found' : 'load_failed')
          setPost(null)
          setLoading(false)
          return
        }
        postData = data
        setPost(data)
        setLoading(false)
      } catch (e) {
        console.warn(e)
        if (!cancelled) {
          setLoadError('load_failed')
          setPost(null)
          setLoading(false)
        }
        return
      }

      // Fetch related posts (same category, excluding this one)
      if (postData?.category) {
        try {
          const { data: rel } = await withTimeout(supabase
            .from('history')
            .select('id, title, title_mm, category, cover_url, event_date, created_at')
            .eq('category', postData.category)
            .eq('status', 'published')
            .neq('id', id)
            .order('created_at', { ascending: false })
            .limit(4), 30000, 'History related')
          if (!cancelled) setRelated(rel || [])
        } catch (relErr) { console.warn(relErr) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, retryCount])

  if (loading) return (
    <div className="p-4">
      <Skeleton className="h-64" />
      <Skeleton className="h-32 mt-4" />
    </div>
  )

  if (loadError) return (
    <div className="p-4 py-16 text-center space-y-3">
      <p className="text-4xl">{loadError === 'not_found' ? '😶' : '⚠️'}</p>
      <p className="text-sm text-red-400 font-myanmar">
        {loadError === 'not_found'
          ? (lang === 'mm' ? 'မတွေ့ပါ' : 'Not found')
          : (lang === 'mm' ? 'Data တင်မရသေးပါ — ပြန်ကြိုးစားမည်' : 'Could not load yet — please retry')}
      </p>
      {loadError === 'load_failed' && (
        <div>
          <button onClick={() => setRetryCount(c => c + 1)} className="btn-primary text-xs px-4 py-2">{lang === 'mm' ? 'ပြန်ကြိုးစားမည်' : 'Retry'}</button>
        </div>
      )}
      <div>
        <button onClick={() => navigate('/history')} className="btn-primary text-xs px-4 py-2">{lang === 'mm' ? 'သမိုင်းစာမျက်နှာသို့ ပြန်မည်' : 'Back to History'}</button>
      </div>
    </div>
  )

  if (!post) return (
    <div className="p-4 text-center text-white/60">
      {lang === 'mm' ? 'မတွေ့ပါ' : 'Not found'}
    </div>
  )

  const cat = HISTORY_CATS.find(c => c.id === post.category) || HISTORY_CATS[0]

  return (
    <div className="pb-8">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xl flex-shrink-0">{cat.icon}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-300 flex-shrink-0">
            {lang === 'mm' ? cat.mm : cat.en}
          </span>
          {post.location_mm && (
            <span className="text-[10px] text-white/60 flex items-center gap-1 truncate">
              <MapPin size={10} /> {post.location_mm}
            </span>
          )}
        </div>
        <ShareButton
          url={window.location.href}
          title={post.title_mm || post.title}
          description={post.excerpt_mm || ''}
        />
      </div>

      {post.cover_url && (
        <div className="mx-4 rounded-2xl overflow-hidden h-56 mb-4">
          <img src={post.cover_url} alt={post.title_mm || post.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="px-4 space-y-4">
        <h1 className="font-display font-bold text-2xl text-white leading-tight">{post.title_mm || post.title}</h1>
        
        <div className="flex items-center gap-3 text-xs text-white/60 flex-wrap">
          {post.event_date && (
            <span className="flex items-center gap-1"><Calendar size={12} /> {formatMyanmarDate(post.event_date, { year: true })}</span>
          )}
          {post.author_name && <span className="flex items-center gap-1"><BookOpen size={12} /> {post.author_name}</span>}
          <span>{timeAgo(post.created_at, lang)}</span>
          {post.content_mm && (
            <span className="flex items-center gap-1 text-white/50">📖 {readingTime(post.content_mm, lang)}</span>
          )}
        </div>

        {post.excerpt_mm && (
          <div className="card-dark p-4 rounded-2xl border-l-4 border-brand-500/40">
            <p className="text-sm text-white/80 font-myanmar italic">{post.excerpt_mm}</p>
          </div>
        )}

        <div className="prose prose-invert max-w-none">
          <p className="text-sm text-white/70 font-myanmar leading-relaxed whitespace-pre-wrap">{post.content_mm}</p>
        </div>

        {post.images?.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            {post.images.map((img, i) => (
              <div key={i} className="aspect-video rounded-xl overflow-hidden">
                <GalleryImg src={img} className="w-full h-full object-cover" alt={post.title_mm || post.title} />
              </div>
            ))}
          </div>
        )}

        {post.author_bio && (
          <div className="card-dark p-4 rounded-2xl mt-4">
            <p className="text-xs text-white/60 mb-1">✍️ {lang === 'mm' ? 'ရေးသားသူအကြောင်း' : 'About the Author'}</p>
            <p className="text-xs text-white/60 font-myanmar">{post.author_bio}</p>
          </div>
        )}

        {/* Related Posts */}
        {related.length > 0 && (
          <div className="mt-6 pt-4 border-t border-white/8">
            <p className="text-xs font-display font-bold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
              📚 {lang === 'mm' ? 'ဆက်စပ် သမိုင်းကြောင်းများ' : 'Related Posts'}
            </p>
            <div className="space-y-2">
              {related.map(r => {
                const rCat = HISTORY_CATS.find(c => c.id === r.category) || HISTORY_CATS[0]
                return (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/history/${r.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8 hover:bg-white/8 hover:border-white/15 transition-colors text-left"
                  >
                    {r.cover_url ? (
                      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                        <img src={r.cover_url} alt={r.title_mm || r.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-brand-700/40 flex items-center justify-center flex-shrink-0 text-2xl">
                        {rCat.icon}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-display font-semibold text-white truncate font-myanmar">
                        {r.title_mm || r.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/60">
                        <span>{rCat.icon} {lang === 'mm' ? rCat.mm : rCat.en}</span>
                        {r.event_date && (
                          <span>· {formatMyanmarDate(r.event_date)}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-white/60 flex-shrink-0">→</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ========== Main HistoryPage Component ==========
export default function HistoryPage() {
  const { lang } = useLang()
  const { isModerator } = useAuth()
  const config = useAppConfig()
  useSEO({ title: lang === 'mm' ? 'ဒေသဆိုင်ရာ သမိုင်းကြောင်းများ' : 'Local History' })

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)

  // Debounce search 300ms so typing does not re-query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      let q = supabase
        .from('history')
        .select('*')
        .eq('status', 'published')
        .order('event_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (catFilter !== 'all') {
        q = q.eq('category', catFilter)
      }

      if (debouncedSearch.trim()) {
        const term = `%${debouncedSearch.trim()}%`
        q = q.or(`title.ilike.${term},title_mm.ilike.${term},excerpt_mm.ilike.${term},content_mm.ilike.${term}`)
      }

      // 30 s timeout (was none): a hung query left the list on skeletons forever.
      const { data, error } = await withTimeout(q, 30000, 'History')

      if (error) {
        console.error('History load error:', error)
        setLoadError(error.message)
      } else {
        setPosts(data || [])
      }
    } catch (e) {
      console.error('History load exception:', e)
      setLoadError(e.message || 'Failed to load history')
    }
    setLoading(false)
  }, [catFilter, debouncedSearch])

  useEffect(() => {
    load()
  }, [load])

  // Subscribe to realtime only once — never re-subscribe on keystroke.
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    const channel = supabase
      .channel('history-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'history'
      }, () => {
        loadRef.current()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function deletePost(id) {
    if (!(await confirmDialog(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?', { danger: true }))) return
    const { error } = await supabase.from('history').delete().eq('id', id)
    if (error) {
      console.error('Delete error:', error)
      showError(error.message)
    } else {
      load()
    }
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">📜 {lang === 'mm' ? 'ဒေသဆိုင်ရာ သမိုင်းကြောင်းများ' : 'Local History'}</h1>
          <p className="text-xs text-white/60 mt-0.5 font-myanmar">
            {lang === 'mm' ? `${config.app_city || ''} ဒေသဆိုင်ရာ သမိုင်း၊ ယဉ်ကျေးမှု၊ သိသင့်သိထိုက်ရာ` : 'History, culture, and knowledge about our region'}
          </p>
        </div>
        {isModerator && (
          <button onClick={() => { setEditTarget(null); setShowForm(true) }} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5">
            <Plus size={14} /> {lang === 'mm' ? 'တင်မည်' : 'Post'}
          </button>
        )}
      </div>

      {/* Intro — what this page is about */}
      <div className="px-4 mb-3">
        <p className="text-xs text-white/50 font-myanmar leading-relaxed bg-white/4 border border-white/8 rounded-2xl px-4 py-3">
          {lang === 'mm'
            ? `${config.app_city || 'တောင်ကြီး'}မြို့သည် ရှမ်းပြည်နယ်၏ မြို့တော်ဖြစ်ပြီး တောင်တန်းများအကြားတွင် တည်ရှိကာ သမိုင်းဝင် စေတီပုထိုးများ၊ ရိုးရာ ပွဲတော်များနှင့် ယဉ်ကျေးမှု အမွေအနှစ်များ ကြွယ်ဝသော မြို့ ဖြစ်သည်။ ဤစာမျက်နှာတွင် မြို့နှင့် ဒေသအနှံ့၏ သမိုင်းကြောင်း၊ ဓလေ့ထုံးတမ်းနှင့် ထင်ရှားသော နေရာများကို ဖတ်ရှုနိုင်ပါသည်။`
            : `${config.app_city || 'Taunggyi'}, the capital of Shan State, is a mountain city rich in historic pagodas, traditional festivals and cultural heritage. Read the history, traditions and landmarks of the city and region here.`}
        </p>
      </div>

      {/* Search bar */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'mm' ? 'သမိုင်းကြောင်း ရှာရန်...' : 'Search history...'}
            className="input-dark pl-9 pr-9 w-full font-myanmar"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="select-dark"
          >
            {HISTORY_CATS.map(c => (
              <option key={c.id} value={c.id} style={{ backgroundColor: '#1a0030' }}>
                {c.icon} {lang === 'mm' ? c.mm : c.en}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      <div className="px-4 space-y-3 pb-24">
        {loading ? (
          [1,2,3].map(n => <div key={n} className="h-48 rounded-2xl shimmer" />)
        ) : loadError ? (
          <div className="flex flex-col items-center py-14 text-center">
            <span className="text-4xl mb-3">⚠️</span>
            <p className="text-red-400 font-display font-semibold">{lang === 'mm' ? 'Data တင်မရသေးပါ — ပြန်ကြိုးစားမည်' : 'Could not load yet — please retry'}</p>
            <button onClick={load} className="btn-primary text-xs px-4 py-2 mt-3">{lang === 'mm' ? 'ပြန်ကြိုးစားမည်' : 'Retry'}</button>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <span className="text-4xl mb-3">📜</span>
            <p className="text-white/60 font-display font-semibold">{lang === 'mm' ? 'စာရင်း မရှိသေး' : 'No posts yet'}</p>
            {isModerator && <p className="text-xs text-white/60 mt-2">"တင်မည်" ကို နှိပ်ပြီး ပထမဆုံး သမိုင်းအကြောင်း ရေးပါ</p>}
          </div>
        ) : (
          posts.map(p => (
            <HistoryCard
              key={p.id}
              post={p}
              lang={lang}
              isModerator={isModerator}
              onEdit={(post) => { setEditTarget(post); setShowForm(true) }}
              onDelete={deletePost}
            />
          ))
        )}
      </div>

      {showForm && (
        <HistoryForm
          lang={lang}
          editPost={editTarget}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
          onSuccess={() => { setShowForm(false); setEditTarget(null); load() }}
        />
      )}
    </div>
  )
}