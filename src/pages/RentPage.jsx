import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Phone, MapPin, Home, Users, CheckCircle, XCircle, Clock, ArrowLeft, Trash2, Edit2, Search } from 'lucide-react'
import { escapePostgrestOr } from '../hooks/useListings'
import { supabase, realtimeEnabled } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../contexts/AppConfigContext'
import { useSEO } from '../hooks/useSEO'
import { uploadImage, getOptimizedUrl } from '../lib/cloudinary'
import { ImageUploader } from '../components/UI'
import { confirmDialog } from '../lib/confirmDialog'
import { showError } from '../lib/toast'
import { maskPhone, toTelHref } from '../lib/phoneMask'

const RENT_TYPES = [
  { id: 'all',      mm: 'အားလုံး',        en: 'All',         icon: '🏠' },
  { id: 'room',     mm: 'အခန်း',          en: 'Room',        icon: '🚪' },
  { id: 'apartment',mm: 'တိုက်ခန်း',       en: 'Apartment',   icon: '🏢' },
  { id: 'house',    mm: 'အိမ်',            en: 'House',       icon: '🏡' },
  { id: 'land',     mm: 'မြေ',             en: 'Land',        icon: '🌾' },
  { id: 'shop',     mm: 'ဆိုင်/လုပ်ငန်း',   en: 'Shop',       icon: '🏪' },
]

const POST_TYPES = [
  { id: 'all',    mm: 'အားလုံး',    en: 'All' },
  { id: 'owner',  mm: 'အိမ်ရှင်',    en: 'Owner/Landlord',  icon: '👑' },
  { id: 'tenant', mm: 'အိမ်ငှား',    en: 'Tenant/Renter',  icon: '👤' },
]

// Home deep links use ?type=available|seeker; accept the raw values too.
function normalizePostType(v) {
  if (v === 'available' || v === 'owner') return 'owner'
  if (v === 'seeker' || v === 'tenant') return 'tenant'
  return 'all'
}

const STATUSES = {
  available:   { mm: 'ငှားလို့ရ',    en: 'Available',   color: 'text-green-400', bg: 'bg-green-500/15', icon: '✅' },
  pending:     { mm: 'စောင့်ဆိုင်းဆဲ', en: 'Pending',     color: 'text-amber-400', bg: 'bg-amber-500/15', icon: '⏳' },
  rented:      { mm: 'ငှားပြီး',     en: 'Rented',      color: 'text-red-400',   bg: 'bg-red-500/15',   icon: '❌' },
}

function timeAgo(iso, lang) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  // N20 (v9.17): a future/clock-skew timestamp must not read "-5မိနစ်".
  if (m < 1) return lang === 'mm' ? 'ယခု' : 'just now'
  if (m < 60) return `${m}${lang === 'mm' ? 'မိနစ်' : 'm'}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}${lang === 'mm' ? 'နာရီ' : 'h'}`
  return `${Math.floor(h/24)}${lang === 'mm' ? 'ရက်' : 'd'}`
}

function RentCard({ post, lang, isLoggedIn, userId, isModerator, onEdit, onDelete, onStatusChange }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const type = RENT_TYPES.find(t => t.id === post.property_type) || RENT_TYPES[0]
  const postType = POST_TYPES.find(t => t.id === post.post_type) || POST_TYPES[1]
  const status = STATUSES[post.status] || STATUSES.available
  const isOwner = isLoggedIn && (post.user_id === userId)

  const handleContact = () => {
    if (!isLoggedIn) return
    if (post.phone) {
      window.location.href = toTelHref(post.phone, isLoggedIn)
    } else if (post.user_id) {
      navigate(`/profile/${post.user_id}`)
    }
  }

  return (
    <div className={`card-dark rounded-2xl p-4 space-y-3 border-l-4 ${status.color === 'text-green-400' ? 'border-l-green-500/60' : status.color === 'text-amber-400' ? 'border-l-amber-500/60' : 'border-l-red-500/60'}`}>
      {post.images?.length > 0 && (
        <div className="rounded-xl overflow-hidden -mx-0">
          <img
            src={getOptimizedUrl(post.images[0], { width: 800 })}
            alt={post.title_mm || post.title}
            loading="lazy"
            onError={e => { e.currentTarget.style.display = 'none' }}
            className="w-full h-36 object-cover"
          />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-lg">{type.icon}</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-300 border border-brand-400/20">
              {lang === 'mm' ? type.mm : type.en}
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/50">
              {postType.icon} {lang === 'mm' ? postType.mm : postType.en}
            </span>
            {post.is_urgent && <span className="text-[9px] text-red-400 font-bold">⚡ Urgent</span>}
          </div>
          <h3 className="font-display font-semibold text-sm text-white">{post.title_mm || post.title}</h3>
          {post.location_mm && (
            <div className="flex items-center gap-1 mt-1 text-white/60">
              <MapPin size={10} />
              <span className="text-[10px] font-myanmar">{post.location_mm}</span>
            </div>
          )}
          {(post.price_monthly || post.price_deposit) && (
            <div className="flex gap-2 mt-1.5 text-xs">
              {post.price_monthly && (
                <span className="text-gold-400 font-mono">{Number(post.price_monthly).toLocaleString()} Ks/လ</span>
              )}
              {post.price_deposit && (
                <span className="text-white/60 font-mono">အပေ {Number(post.price_deposit).toLocaleString()} Ks</span>
              )}
            </div>
          )}
          {post.description_mm && (
            <p className="text-[10px] text-white/50 mt-1 font-myanmar line-clamp-2 break-words">{post.description_mm}</p>
          )}
          {expanded && (
            <div className="space-y-2 pt-1 border-t border-white/6">
              {(post.description || (post.description_mm && post.description_mm !== post.description)) && post.description && (
                <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap break-words">{post.description}</p>
              )}
              {post.images?.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                  {post.images.slice(1).map((img, i) => (
                    <img key={i} src={getOptimizedUrl(img, { width: 160 })} alt={post.title_mm || post.title || 'ပုံ'} loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} className="w-16 h-16 rounded-lg object-cover border border-white/10 flex-shrink-0" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status badge */}
        <div className={`text-right flex-shrink-0 ${status.bg} px-2 py-1 rounded-lg`}>
          <span className={`text-[9px] font-bold ${status.color}`}>{status.icon} {lang === 'mm' ? status.mm : status.en}</span>
        </div>
      </div>

      {/* Contact & Actions */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2 items-center flex-wrap">
          {post.phone && (
            isLoggedIn ? (
              <button onClick={handleContact} className="flex items-center gap-1.5 min-h-11 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/25 text-green-400 hover:bg-green-500/20 text-sm font-bold">
                <Phone size={14} /> {lang === 'mm' ? 'ဖုန်းခေါ်မည်' : 'Call'} {post.contact_name ? `${post.contact_name} · ` : ''}{post.phone}
              </button>
            ) : (
              <button onClick={() => navigate('/login')} className="flex items-center gap-1.5 min-h-11 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/25 text-green-400 hover:bg-green-500/20 text-sm font-bold">
                <Phone size={14} /> {post.contact_name ? `${post.contact_name} · ` : ''}{maskPhone(post.phone, false)} · {lang === 'mm' ? 'ဖုန်းခေါ်ရန် Login ဝင်ပါ' : 'Login to call'}
              </button>
            )
          )}
          {!post.phone && post.contact_name && (
            <span className="text-[10px] text-white/60 font-myanmar">{post.contact_name}</span>
          )}
          <span className="text-[9px] text-white/60">{timeAgo(post.created_at, lang)}</span>
          <button onClick={() => setExpanded(e => !e)} className="text-[10px] text-brand-300 hover:text-brand-200">
            {expanded ? (lang === 'mm' ? '▲ ချုံ့မည်' : '▲ Less') : (lang === 'mm' ? '▼ အသေးစိတ်' : '▼ Details')}
          </button>
        </div>

        {(isOwner || isModerator) && (
          <div className="flex gap-1">
            {isOwner && (
              <>
                <button onClick={() => onStatusChange(post)} className="w-9 h-9 rounded-lg bg-white/8 flex items-center justify-center hover:bg-white/12" title="Status ပြောင်း">
                  <Clock size={11} className="text-white/40" />
                </button>
                <button onClick={() => onEdit(post)} className="w-9 h-9 rounded-lg bg-white/8 flex items-center justify-center hover:bg-white/12">
                  <Edit2 size={11} className="text-white/40" />
                </button>
              </>
            )}
            <button onClick={() => onDelete(post.id)} className="w-9 h-9 rounded-lg btn-danger flex items-center justify-center">
              <Trash2 size={11} className="text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function RentForm({ onClose, onSuccess, lang, editPost }) {
  const { user, profile, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '', title_mm: '', description_mm: '', location_mm: '',
    property_type: 'room', post_type: 'owner',
    price_monthly: '', price_deposit: '', phone: '', contact_name: '',
    is_urgent: false, status: 'available',
  })
  const [images, setImages] = useState([])
  const [imgLoading, setImgLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (editPost) {
      setForm({
        title: editPost.title || '',
        title_mm: editPost.title_mm || '',
        description_mm: editPost.description_mm || '',
        location_mm: editPost.location_mm || '',
        property_type: editPost.property_type || 'room',
        post_type: editPost.post_type || 'owner',
        price_monthly: editPost.price_monthly || '',
        price_deposit: editPost.price_deposit || '',
        phone: editPost.phone || '',
        contact_name: editPost.contact_name || '',
        is_urgent: editPost.is_urgent || false,
        status: editPost.status || 'available',
      })
      setImages(editPost.images || [])
    }
  }, [editPost])

  if (!isLoggedIn) return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 pt-safe">
      <div className="w-full max-w-lg bg-[#1a0030] border border-white/10 rounded-t-3xl p-6 pb-24 text-center">
        <p className="text-white font-myanmar mb-4">တင်ရန် Login လိုအပ်သည်</p>
        <button onClick={() => navigate('/login')} className="btn-primary w-full">Login ဝင်မည်</button>
        <button onClick={onClose} className="btn-ghost w-full mt-2">Cancel</button>
      </div>
    </div>
  )

  async function handleImageUpload(file) {
    setImgLoading(true)
    try {
      const url = await uploadImage(file, 'rentals')
      setImages(prev => [...prev, url])
    } catch (err) {
      showError(lang === 'mm' ? 'ပုံတင်ရာတွင် အမှားရှိသည်' : 'Image upload failed')
    } finally {
      setImgLoading(false)
    }
  }

  async function submit() {
    if (!form.title_mm && !form.title) return
    // S27 (v9.17): at least one way to reach the poster is required.
    if (!form.phone?.trim() && !form.contact_name?.trim()) { showError('ဆက်သွယ်ရန် (ဖုန်း / နာမည်) တစ်ခုခု ထည့်ပါ'); return }
    setSubmitting(true)

    const payload = {
      ...form,
      price_monthly: form.price_monthly ? parseInt(form.price_monthly) : null,
      price_deposit: form.price_deposit ? parseInt(form.price_deposit) : null,
      images,
      user_id: user?.id,
      poster_name: profile?.full_name || profile?.nickname,
    }


    try {
      if (editPost) {
        const { error } = await supabase.from('rentals').update(payload).eq('id', editPost.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('rentals').insert(payload).select()
        if (error) throw error
      }
      setSubmitting(false)
      onSuccess()
    } catch (err) {
      console.error('[RentForm] Submit error:', err)
      showError(lang === 'mm' ? 'တင်ရာတွင် အမှားရှိသည် — ထပ်ကြိုးစားပါ' : 'Submit failed — please try again')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0015] overflow-y-auto pt-safe">
      <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
        <h2 className="font-display font-bold text-base text-white">{editPost ? (lang === 'mm' ? 'ပြင်ဆင်မည်' : 'Edit') : (lang === 'mm' ? 'အိမ်/အခန်း တင်မည်' : 'Post Rental')}</h2>
        <button onClick={submit} disabled={submitting || (!form.title_mm && !form.title)} className="btn-primary text-xs px-4 py-2">{submitting ? '...' : (lang === 'mm' ? 'တင်မည်' : 'Post')}</button>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">
        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'တင်သူအမျိုးအစား' : 'Post Type'}</label>
          <div className="flex gap-2">
            {POST_TYPES.filter(t => t.id !== 'all').map(t => (
              <button key={t.id} onClick={() => set('post_type', t.id)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-display font-bold border transition-all ${form.post_type === t.id ? 'bg-brand-600/60 border-2 border-brand-400 text-brand-200 ring-2 ring-brand-400/30' : 'bg-white/5 border-white/10 text-white/50'}`}>
                {form.post_type === t.id ? '✓ ' : ''}{t.icon} {lang === 'mm' ? t.mm : t.en}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'အိမ်အမျိုးအစား' : 'Property Type'}</label>
          <div className="flex gap-2 flex-wrap">
            {RENT_TYPES.filter(t => t.id !== 'all').map(t => (
              <button key={t.id} onClick={() => set('property_type', t.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border ${form.property_type === t.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>
                {t.icon} {lang === 'mm' ? t.mm : t.en}
              </button>
            ))}
          </div>
        </div>

        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ခေါင်းစဉ် (မြန်မာ)' : 'Title (Myanmar)'} *</label><input value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: အိမ်အခန်း ငှားမည်" /></div>
        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဖော်ပြချက်' : 'Description'}</label><textarea value={form.description_mm} onChange={e => set('description_mm', e.target.value)} className="input-dark font-myanmar resize-none h-20" placeholder="အိမ်အခန်း အကျယ်အဝန်း၊ ပါဝင်ပစ္စည်း၊ သတ်မှတ်ချက်များ..." /></div>
        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'နေရာ' : 'Location'}</label><input value={form.location_mm} onChange={e => set('location_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ရပ်ကွက်၊ လမ်း..." /></div>
        
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'လစဉ်ငှားရမ်းခ (Ks)' : 'Monthly Rent (Ks)'}</label><input type="number" value={form.price_monthly} onChange={e => set('price_monthly', e.target.value)} className="input-dark font-mono" placeholder="e.g. 300000" /></div>
          <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'အပေး/အာမခံ (Ks)' : 'Deposit (Ks)'}</label><input type="number" value={form.price_deposit} onChange={e => set('price_deposit', e.target.value)} className="input-dark font-mono" placeholder="e.g. 500000" /></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဆက်သွယ်ရမည့်သူ' : 'Contact Name'}</label><input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className="input-dark font-myanmar" /></div>
          <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဖုန်းနံပါတ်' : 'Phone'}</label><input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className="input-dark" placeholder="09xxxxxxxxx" /></div>
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ပုံများ' : 'Photos'} (max 5)</label>
          <div className="flex gap-2 flex-wrap">
            {images.map((url, i) => (
              <div key={i} className="relative w-16 h-16">
                <img src={url} alt={form.title_mm || 'ပုံ'} className="w-full h-full object-cover rounded-xl border border-white/10" />
                <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 btn-danger rounded-full text-white text-[10px]">✕</button>
              </div>
            ))}
            {images.length < 5 && <ImageUploader onUpload={handleImageUpload} loading={imgLoading} label="+" />}
          </div>
        </div>

        <button onClick={() => set('is_urgent', !form.is_urgent)} className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${form.is_urgent ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-white/50'}`}>
          ⚡ {lang === 'mm' ? 'Urgent — အမြန်ငှားလိုသည်' : 'Mark as Urgent'}
        </button>
      </div>
    </div>
  )
}

function StatusModal({ post, onClose, onUpdate, lang }) {
  const [status, setStatus] = useState(post.status)
  const [saving, setSaving] = useState(false) // N22 (v9.17): block double-taps

  const updateStatus = async () => {
    if (saving) return
    setSaving(true)
    const { error } = await supabase.from('rentals').update({ status }).eq('id', post.id)
    setSaving(false)
    if (error) { console.error('Rent status error:', error); showError(lang === 'mm' ? 'Status ပြောင်းမရပါ' : 'Status update failed'); return }
    onUpdate()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 pt-safe" onClick={onClose}>
      <div className="bg-[#1a0030] rounded-2xl p-5 w-64 border border-white/10" onClick={e => e.stopPropagation()}>
        <p className="text-white text-sm font-display font-bold mb-3">Status ပြောင်းမည်</p>
        <div className="space-y-2">
          {Object.entries(STATUSES).map(([key, val]) => (
            <button key={key} onClick={() => setStatus(key)} className={`w-full py-2 rounded-xl text-xs font-bold ${status === key ? val.bg + ' ' + val.color : 'bg-white/5 text-white/50'}`}>
              {val.icon} {lang === 'mm' ? val.mm : val.en}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={updateStatus} disabled={saving} className="flex-1 btn-primary text-xs py-2 disabled:opacity-50">{saving ? '...' : 'သိမ်းမည်'}</button>
          <button onClick={onClose} className="flex-1 btn-ghost text-xs py-2">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function RentPage() {
  const { lang } = useLang()
  const { user, isModerator, isLoggedIn } = useAuth()
  const config = useAppConfig()
  useSEO({ title: lang === 'mm' ? 'အိမ်/အခန်း ငှားရမ်းခြင်း' : 'Rentals' })

  const [searchParams] = useSearchParams()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [postTypeFilter, setPostTypeFilter] = useState(() => normalizePostType(searchParams.get('type')))
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)
  // S29 (v9.17): search box, debounced; honours ?q= from SearchPage.
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('q') || '')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const PAGE_SIZE = 50

  async function load(background = false) {
    // S18/S23 (v9.17): realtime reloads run in the background — no
    // skeleton flash while the user is reading the list.
    if (!background) setLoading(true)
    setLoadError(false)
    try {
      const limit = (page + 1) * PAGE_SIZE
      let q = supabase.from('rentals').select('*').order('is_urgent', { ascending: false }).order('created_at', { ascending: false }).range(0, limit - 1)
      if (propertyFilter !== 'all') q = q.eq('property_type', propertyFilter)
      if (postTypeFilter !== 'all') q = q.eq('post_type', postTypeFilter)
      if (statusFilter !== 'all') q = q.eq('status', statusFilter)
      const term = debouncedSearch.trim()
      if (term) {
        const t = escapePostgrestOr(term)
        q = q.or(`title.ilike.%${t}%,title_mm.ilike.%${t}%,location_mm.ilike.%${t}%,description_mm.ilike.%${t}%`)
      }
      // 30 s timeout (was none): a hung query left the list on skeletons forever.
      const { data, error } = await withTimeout(q, 30000, 'Rentals')
      if (error) throw error
      // S25 (v9.17): the guarded filter below now activates — migration
      // 9.17 adds expires_at (+30d) to rentals, so expired rows hide.
      const now = Date.now()
      setPosts((data || []).filter(p => !p.expires_at || new Date(p.expires_at).getTime() >= now))
      setHasMore((data || []).length === limit)
    } catch (e) { console.warn(e); setLoadError(true) }
    if (!background) setLoading(false)
  }

  // Debounce the search box — each keystroke is a server query now.
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    load()
    // v9.18: realtime is off on the proxied origin (see supabase.js) —
    // load() above already fetched the data; skip the channel.
    if (!realtimeEnabled) return
    const channel = supabase
      .channel('rentals-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rentals' }, () => load(true))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rentals' }, () => load(true))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rentals' }, () => load(true))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [propertyFilter, postTypeFilter, statusFilter, page, debouncedSearch])

  async function deletePost(id) {
    if (!(await confirmDialog(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?', { danger: true }))) return
    const { error } = await supabase.from('rentals').delete().eq('id', id)
    if (error) { console.error('Rent delete error:', error); showError(lang === 'mm' ? 'ဖျက်ရာတွင် အမှားရှိသည်' : 'Delete failed'); return }
    load()
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">🏠 {lang === 'mm' ? 'အိမ်/အခန်း ငှားရမ်းခြင်း' : 'Rentals'}</h1>
          <p className="text-xs text-white/60 mt-0.5 font-myanmar">{lang === 'mm' ? 'အိမ်ရှင်/အိမ်ငှား ချိတ်ဆက်ရေး' : 'Connect landlords & tenants'}</p>
        </div>
        <button onClick={() => { setEditTarget(null); setShowForm(true) }} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5"><Plus size={14} /> {lang === 'mm' ? 'တင်မည်' : 'Post'}</button>
      </div>

      {/* Filters */}
      <div className="px-4 space-y-2 mb-4">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <Search size={16} className="text-white/40 flex-shrink-0" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'mm' ? 'အိမ်/အခန်း ရှာရန်...' : 'Search rentals...'} className="bg-transparent border-none outline-none text-sm text-white w-full font-myanmar placeholder:text-white/30" />
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select value={propertyFilter} onChange={e => { setPropertyFilter(e.target.value); setPage(0) }} className="select-dark">
              {RENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {lang === 'mm' ? t.mm : t.en}</option>)}
            </select>
          </div>
          <div className="relative flex-1">
            <select value={postTypeFilter} onChange={e => { setPostTypeFilter(e.target.value); setPage(0) }} className="select-dark">
              {POST_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {lang === 'mm' ? t.mm : t.en}</option>)}
            </select>
          </div>
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0) }} className="select-dark">
            <option value="all">📋 {lang === 'mm' ? 'အားလုံး' : 'All Status'}</option>
            {Object.entries(STATUSES).map(([key, val]) => (
              <option key={key} value={key}>{val.icon} {lang === 'mm' ? val.mm : val.en}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-4 space-y-2 pb-24">
        {loading ? [1,2,3].map(n => <div key={n} className="h-32 rounded-2xl shimmer" />) :
         loadError ? (
           <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
             <p className="text-sm text-red-400 font-myanmar">Data တင်ရာတွင် အမှားဖြစ်သွားသည်</p>
             <button onClick={() => load()} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button>
           </div>
         ) :
         posts.length === 0 ? (
           <div className="flex flex-col items-center py-14 text-center">
             <span className="text-4xl mb-3">🏠</span>
             <p className="text-white/60 font-display font-semibold">{lang === 'mm' ? 'အိမ်/အခန်း စာရင်း မရှိသေး' : 'No listings yet'}</p>
           </div>
         ) :
         posts.map(p => (
           <RentCard
             key={p.id}
             post={p}
             lang={lang}
             isLoggedIn={isLoggedIn}
             userId={user?.id}
             isModerator={isModerator}
             onEdit={(post) => { setEditTarget(post); setShowForm(true) }}
             onDelete={deletePost}
             onStatusChange={(post) => setStatusTarget(post)}
           />
         ))}
        {hasMore && !loading && !loadError && (
          <button onClick={() => setPage(p => p + 1)} className="w-full py-3 rounded-2xl bg-white/6 border border-white/10 text-sm text-white/70 hover:bg-white/10">
            {lang === 'mm' ? 'နောက်ထပ် ပြမည်' : 'Load more'}
          </button>
        )}
      </div>

      {showForm && (
        <RentForm
          lang={lang}
          editPost={editTarget}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
          onSuccess={() => { setShowForm(false); setEditTarget(null); load() }}
        />
      )}

      {statusTarget && (
        <StatusModal
          post={statusTarget}
          lang={lang}
          onClose={() => setStatusTarget(null)}
          onUpdate={() => { load(); setStatusTarget(null) }}
        />
      )}
    </div>
  )
}