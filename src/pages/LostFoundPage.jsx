import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Phone, MapPin, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { uploadImage } from '../lib/cloudinary'
import { getOptimizedUrl } from '../lib/cloudinary'
import { ImageUploader } from '../components/UI'

const CATS = [
  { id: 'all',    mm: 'အားလုံး',   en: 'All',     icon: '🔍' },
  { id: 'person', mm: 'လူ',        en: 'Person',  icon: '🧑' },
  { id: 'child',  mm: 'ကလေး',     en: 'Child',   icon: '👦' },
  { id: 'animal', mm: 'တိရိစ္ဆာန်', en: 'Animal', icon: '🐾' },
  { id: 'item',   mm: 'ပစ္စည်း',   en: 'Item',    icon: '📦' },
]
const TYPES = [
  { id: 'all',   mm: 'အားလုံး',   en: 'All'   },
  { id: 'lost',  mm: 'ပျောက်ဆုံး', en: 'Lost'  },
  { id: 'found', mm: 'တွေ့ရှိ',   en: 'Found' },
]

function timeAgo(iso, lang) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 60) return `${m}${lang === 'mm' ? ' မိနစ်က' : 'm ago'}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}${lang === 'mm' ? ' နာရီက' : 'h ago'}`
  return `${Math.floor(h/24)}${lang === 'mm' ? ' ရက်က' : 'd ago'}`
}

function PostCard({ post, lang }) {
  const navigate = useNavigate()
  const isLost   = post.type === 'lost'
  const cover    = post.images?.[0] ? getOptimizedUrl(post.images[0], { width: 300 }) : null
  const cat      = CATS.find(c => c.id === post.category)

  return (
    <div className={`card-listing cursor-pointer overflow-hidden border-l-4 ${
      isLost ? 'border-l-red-500/60' : 'border-l-green-500/60'
    }`} onClick={() => navigate(`/lost-found/${post.id}`)}>
      <div className="flex gap-3 p-4">
        {cover ? (
          <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-white/5">
            <img src={cover} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0 text-3xl">
            {cat?.icon}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
              isLost
                ? 'bg-red-500/15 text-red-400 border-red-500/25'
                : 'bg-green-500/15 text-green-400 border-green-500/25'
            }`}>
              {isLost ? (lang === 'mm' ? 'ပျောက်ဆုံး' : 'LOST') : (lang === 'mm' ? 'တွေ့ရှိ' : 'FOUND')}
            </span>
            <span className="text-[9px] text-white/40 bg-white/6 px-1.5 py-0.5 rounded-full">{cat?.icon} {lang === 'mm' ? cat?.mm : cat?.en}</span>
            {post.is_urgent && <span className="text-[9px] text-amber-400 font-bold">⚠️ Urgent</span>}
          </div>
          <h3 className="text-sm font-display font-semibold text-white line-clamp-1">
            {lang === 'mm' ? (post.title_mm || post.title) : post.title}
          </h3>
          {post.location_mm || post.location ? (
            <div className="flex items-center gap-1 mt-1 text-white/40">
              <MapPin size={10} />
              <span className="text-[10px] truncate font-myanmar">{lang === 'mm' ? (post.location_mm || post.location) : post.location}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-white/30">{timeAgo(post.reported_at, lang)}</span>
            {post.status === 'resolved' && (
              <span className="flex items-center gap-1 text-[9px] text-green-400">
                <CheckCircle size={10} /> {lang === 'mm' ? 'ဖြေရှင်းပြီး' : 'Resolved'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PostForm({ onClose, onSuccess, lang }) {
  const { user, profile } = useAuth()
  const [form, setForm] = useState({
    type: 'lost', category: 'item', title: '', title_mm: '',
    description_mm: '', location_mm: '', contact_phone: '', contact_name: '',
    is_urgent: false, reward: '', poster_name: '',
  })
  const [images, setImages] = useState([])
  const [imgLoading, setImgLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleImg(file) {
    if (images.length >= 3) return
    setImgLoading(true)
    const url = await uploadImage(file, 'lost-found')
    setImages(prev => [...prev, url])
    setImgLoading(false)
  }

  async function submit() {
    if (!form.title && !form.title_mm) return
    setSubmitting(true)
    await supabase.from('lost_found').insert({
      ...form,
      images,
      poster_id:   user?.id || null,
      poster_name: user ? (profile?.full_name || profile?.nickname) : form.poster_name,
    })
    setSubmitting(false)
    onSuccess()
  }

  const setField = (k, v) => set(k, v)

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0d0015] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0 z-10">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h2 className="font-display font-bold text-base text-white">
          {lang === 'mm' ? 'ပျောက်ဆုံး/တွေ့ရှိ Post တင်မည်' : 'Post Lost/Found'}
        </h2>
        <button onClick={submit} disabled={submitting || (!form.title && !form.title_mm)} className="btn-primary text-xs px-4 py-2">
          {submitting ? '...' : lang === 'mm' ? 'တင်မည်' : 'Post'}
        </button>
      </div>

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Type */}
        <div className="flex gap-2">
          {[{v:'lost',mm:'ပျောက်ဆုံး',en:'Lost',color:'red'},{v:'found',mm:'တွေ့ရှိ',en:'Found',color:'green'}].map(t => (
            <button key={t.v} onClick={() => setField('type', t.v)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-display font-bold border transition-all ${form.type === t.v ? (t.color === 'red' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-green-500/20 border-green-500/40 text-green-400') : 'bg-white/5 border-white/10 text-white/40'}`}>
              {lang === 'mm' ? t.mm : t.en}
            </button>
          ))}
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'အမျိုးအစား' : 'Category'}</label>
          <div className="flex gap-2 flex-wrap">
            {CATS.filter(c => c.id !== 'all').map(c => (
              <button key={c.id} onClick={() => setField('category', c.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border transition-colors ${form.category === c.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>
                {c.icon} {lang === 'mm' ? c.mm : c.en}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ခေါင်းစဉ် (မြန်မာ)' : 'Title (Myanmar)'} *</label>
          <input value={form.title_mm} onChange={e => setField('title_mm', e.target.value)} className="input-dark font-myanmar" placeholder={lang === 'mm' ? 'ဥပမာ: မဲ့နက်ကြောင်ပျောက် ဒေါ်မေမြ...' : 'e.g. Lost black cat near...'} />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဖော်ပြချက်' : 'Description'}</label>
          <textarea value={form.description_mm} onChange={e => setField('description_mm', e.target.value)} className="input-dark font-myanmar resize-none h-20" placeholder={lang === 'mm' ? 'အသေးစိတ်ဖော်ပြချက်...' : 'Detailed description...'} />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ပျောက်ဆုံး/တွေ့ရှိ နေရာ' : 'Location'}</label>
          <input value={form.location_mm} onChange={e => setField('location_mm', e.target.value)} className="input-dark font-myanmar" placeholder={lang === 'mm' ? 'ရပ်ကွက်၊ လမ်း...' : 'Ward, street...'} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဆက်သွယ်ရမည့်သူ' : 'Contact Name'}</label>
            <input value={form.contact_name} onChange={e => setField('contact_name', e.target.value)} className="input-dark font-myanmar" placeholder={lang === 'mm' ? 'နာမည်...' : 'Name...'} />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဖုန်းနံပါတ်' : 'Phone'}</label>
            <input type="tel" value={form.contact_phone} onChange={e => setField('contact_phone', e.target.value)} className="input-dark" placeholder="09xxxxxxxxx" />
          </div>
        </div>

        {!user && (
          <div>
            <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'သင်၏ နာမည် (Guest)' : 'Your Name (Guest)'}</label>
            <input value={form.poster_name} onChange={e => setField('poster_name', e.target.value)} className="input-dark font-myanmar" />
          </div>
        )}

        {/* Reward */}
        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဆုကြေး (optional)' : 'Reward (optional)'}</label>
          <input value={form.reward} onChange={e => setField('reward', e.target.value)} className="input-dark font-myanmar" placeholder={lang === 'mm' ? 'ဥပမာ: ကျပ် ၅၀,၀၀၀ ဆုကြေးပေးမည်' : 'e.g. 50,000 Ks reward'} />
        </div>

        {/* Photos (max 3) */}
        <div>
          <label className="block text-xs text-white/50 mb-1.5">
            {lang === 'mm' ? 'ပုံ (max 3)' : 'Photos (max 3)'} — {images.length}/3
          </label>
          <div className="flex gap-2 flex-wrap">
            {images.map((url, i) => (
              <div key={i} className="relative w-20 h-20">
                <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-white/10" />
                <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center">✕</button>
              </div>
            ))}
            {images.length < 3 && <ImageUploader onUpload={handleImg} loading={imgLoading} label="ပုံ" />}
          </div>
        </div>

        {/* Urgent toggle */}
        <button onClick={() => setField('is_urgent', !form.is_urgent)}
          className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm transition-colors ${form.is_urgent ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/10 text-white/50'}`}>
          <AlertTriangle size={16} />
          {lang === 'mm' ? 'Urgent — အရေးပေါ်' : 'Mark as Urgent'}
        </button>
      </div>
    </div>
  )
}

export default function LostFoundPage() {
  const { lang } = useLang()
  const { isLoggedIn } = useAuth()
  useSEO({ title: lang === 'mm' ? 'ပျောက်ဆုံးပစ္စည်း' : 'Lost & Found' })

  const [posts, setPosts]     = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [catFilter, setCatFilter]   = useState('all')
  const [showForm, setShowForm]     = useState(false)

  async function load() {
    setLoading(true)
    let q = supabase.from('lost_found').select('*').eq('status', 'active').order('is_urgent', { ascending: false }).order('reported_at', { ascending: false }).limit(50)
    if (typeFilter !== 'all') q = q.eq('type', typeFilter)
    if (catFilter !== 'all')  q = q.eq('category', catFilter)
    const { data } = await q
    setPosts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [typeFilter, catFilter])

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('lost-found-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lost_found' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">
            🔍 {lang === 'mm' ? 'ပျောက်ဆုံးပစ္စည်း' : 'Lost & Found'}
          </h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">
            {lang === 'mm' ? 'ပျောက်ဆုံးသူ/ပစ္စည်း ရှာဖွေပေးရန် Community' : 'Community help finding missing people & items'}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0">
          <Plus size={14} /> Post
        </button>
      </div>

      {/* Type + Category filter row */}
      <div className="flex gap-2 px-4 mb-4">
        <div className="relative flex-1">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="select-dark"
          >
            {TYPES.map(t => (
              <option key={t.id} value={t.id} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                {lang === 'mm' ? t.mm : t.en}
              </option>
            ))}
          </select>
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div className="relative flex-1">
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="select-dark"
          >
            {CATS.map(c => (
              <option key={c.id} value={c.id} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                {c.icon} {lang === 'mm' ? c.mm : c.en}
              </option>
            ))}
          </select>
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      <div className="px-4 space-y-2">
        {loading
          ? [1,2,3].map(n => <div key={n} className="h-24 rounded-2xl shimmer" />)
          : posts.length === 0
          ? <div className="flex flex-col items-center py-14 text-center"><span className="text-4xl mb-3">🔍</span><p className="text-white/40 font-display font-semibold">{lang === 'mm' ? 'Post မရှိသေး' : 'No posts yet'}</p></div>
          : posts.map(p => <PostCard key={p.id} post={p} lang={lang} />)
        }
      </div>

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
