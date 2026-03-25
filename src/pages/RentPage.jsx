import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Phone, MapPin, Home, Users, CheckCircle, XCircle, Clock, ArrowLeft, Trash2, Edit2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { uploadImage } from '../lib/cloudinary'
import { ImageUploader } from '../components/UI'

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

const STATUSES = {
  available:   { mm: 'ငှားလို့ရ',    en: 'Available',   color: 'text-green-400', bg: 'bg-green-500/15', icon: '✅' },
  pending:     { mm: 'စောင့်ဆိုင်းဆဲ', en: 'Pending',     color: 'text-amber-400', bg: 'bg-amber-500/15', icon: '⏳' },
  rented:      { mm: 'ငှားပြီး',     en: 'Rented',      color: 'text-red-400',   bg: 'bg-red-500/15',   icon: '❌' },
}

function timeAgo(iso, lang) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 60) return `${m}${lang === 'mm' ? 'မိနစ်' : 'm'}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}${lang === 'mm' ? 'နာရီ' : 'h'}`
  return `${Math.floor(h/24)}${lang === 'mm' ? 'ရက်' : 'd'}`
}

function RentCard({ post, lang, isLoggedIn, userId, onEdit, onDelete, onStatusChange }) {
  const navigate = useNavigate()
  const type = RENT_TYPES.find(t => t.id === post.property_type) || RENT_TYPES[0]
  const postType = POST_TYPES.find(t => t.id === post.post_type) || POST_TYPES[1]
  const status = STATUSES[post.status] || STATUSES.available
  const isOwner = isLoggedIn && (post.user_id === userId)

  const handleContact = () => {
    if (post.phone) {
      window.location.href = `tel:${post.phone}`
    } else if (post.user_id) {
      navigate(`/profile/${post.user_id}`)
    }
  }

  return (
    <div className={`card-dark rounded-2xl p-4 space-y-3 border-l-4 ${status.color === 'text-green-400' ? 'border-l-green-500/60' : status.color === 'text-amber-400' ? 'border-l-amber-500/60' : 'border-l-red-500/60'}`}>
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
            <div className="flex items-center gap-1 mt-1 text-white/40">
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
                <span className="text-white/40 font-mono">အပေ {Number(post.price_deposit).toLocaleString()} Ks</span>
              )}
            </div>
          )}
          {post.description_mm && (
            <p className="text-[10px] text-white/50 mt-1 font-myanmar line-clamp-2">{post.description_mm}</p>
          )}
        </div>

        {/* Status badge */}
        <div className={`text-right flex-shrink-0 ${status.bg} px-2 py-1 rounded-lg`}>
          <span className={`text-[9px] font-bold ${status.color}`}>{status.icon} {lang === 'mm' ? status.mm : status.en}</span>
        </div>
      </div>

      {/* Contact & Actions */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          {post.phone && (
            <button onClick={handleContact} className="flex items-center gap-1 text-[10px] text-green-400 hover:text-green-300">
              <Phone size={10} /> {post.phone}
            </button>
          )}
          <span className="text-[9px] text-white/30">{timeAgo(post.created_at, lang)}</span>
        </div>
        
        {isOwner && (
          <div className="flex gap-1">
            <button onClick={() => onStatusChange(post)} className="w-6 h-6 rounded-lg bg-white/8 flex items-center justify-center hover:bg-white/12" title="Status ပြောင်း">
              <Clock size={11} className="text-white/40" />
            </button>
            <button onClick={() => onEdit(post)} className="w-6 h-6 rounded-lg bg-white/8 flex items-center justify-center hover:bg-white/12">
              <Edit2 size={11} className="text-white/40" />
            </button>
            <button onClick={() => onDelete(post.id)} className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20">
              <Trash2 size={11} className="text-red-400" />
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
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70">
      <div className="w-full max-w-lg bg-[#140020] border border-white/10 rounded-t-3xl p-6 pb-24 text-center">
        <p className="text-white font-myanmar mb-4">တင်ရန် Login လိုအပ်သည်</p>
        <button onClick={() => navigate('/login')} className="btn-primary w-full">Login ဝင်မည်</button>
        <button onClick={onClose} className="btn-ghost w-full mt-2">Cancel</button>
      </div>
    </div>
  )

  async function handleImageUpload(file) {
    setImgLoading(true)
    const url = await uploadImage(file, 'rentals')
    setImages(prev => [...prev, url])
    setImgLoading(false)
  }

  async function submit() {
    if (!form.title_mm && !form.title) return
    setSubmitting(true)
    const payload = {
      ...form,
      price_monthly: form.price_monthly ? parseInt(form.price_monthly) : null,
      price_deposit: form.price_deposit ? parseInt(form.price_deposit) : null,
      images,
      user_id: user.id,
      poster_name: profile?.full_name || profile?.nickname,
    }
    
    if (editPost) {
      await supabase.from('rentals').update(payload).eq('id', editPost.id)
    } else {
      await supabase.from('rentals').insert(payload)
    }
    setSubmitting(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0015] overflow-y-auto">
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
                className={`flex-1 py-2.5 rounded-xl text-sm font-display font-bold border transition-all ${form.post_type === t.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>
                {t.icon} {lang === 'mm' ? t.mm : t.en}
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

        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ခေါင်းစဉ် (မြန်မာ)' : 'Title (Myanmar)'} *</label><input autoFocus value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: အိမ်အခန်း ငှားမည်" /></div>
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
                <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-white/10" />
                <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[10px]">✕</button>
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

  const updateStatus = async () => {
    await supabase.from('rentals').update({ status }).eq('id', post.id)
    onUpdate()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#140020] rounded-2xl p-5 w-64 border border-white/10" onClick={e => e.stopPropagation()}>
        <p className="text-white text-sm font-display font-bold mb-3">Status ပြောင်းမည်</p>
        <div className="space-y-2">
          {Object.entries(STATUSES).map(([key, val]) => (
            <button key={key} onClick={() => setStatus(key)} className={`w-full py-2 rounded-xl text-xs font-bold ${status === key ? val.bg + ' ' + val.color : 'bg-white/5 text-white/50'}`}>
              {val.icon} {lang === 'mm' ? val.mm : val.en}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={updateStatus} className="flex-1 btn-primary text-xs py-2">သိမ်းမည်</button>
          <button onClick={onClose} className="flex-1 btn-ghost text-xs py-2">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function RentPage() {
  const { lang } = useLang()
  const { user, isModerator, isLoggedIn } = useAuth()
  useSEO({ title: lang === 'mm' ? 'အိမ်/အခန်း ငှားရမ်းခြင်း' : 'Rentals' })

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [postTypeFilter, setPostTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)

  async function load() {
    setLoading(true)
    try {
      let q = supabase.from('rentals').select('*').order('is_urgent', { ascending: false }).order('created_at', { ascending: false })
      if (propertyFilter !== 'all') q = q.eq('property_type', propertyFilter)
      if (postTypeFilter !== 'all') q = q.eq('post_type', postTypeFilter)
      if (statusFilter !== 'all') q = q.eq('status', statusFilter)
      const { data } = await q
      setPosts(data || [])
    } catch (e) { console.warn(e) }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('rentals-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rentals' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rentals' }, load)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rentals' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [propertyFilter, postTypeFilter, statusFilter])

  async function deletePost(id) {
    if (!confirm(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?')) return
    await supabase.from('rentals').delete().eq('id', id)
    load()
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">🏠 {lang === 'mm' ? 'အိမ်/အခန်း ငှားရမ်းခြင်း' : 'Rentals'}</h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? 'အိမ်ရှင်/အိမ်ငှား ချိတ်ဆက်ရေး' : 'Connect landlords & tenants'}</p>
        </div>
        <button onClick={() => { setEditTarget(null); setShowForm(true) }} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5"><Plus size={14} /> {lang === 'mm' ? 'တင်မည်' : 'Post'}</button>
      </div>

      {/* Filters */}
      <div className="px-4 space-y-2 mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)} className="select-dark text-xs">
              {RENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {lang === 'mm' ? t.mm : t.en}</option>)}
            </select>
          </div>
          <div className="relative flex-1">
            <select value={postTypeFilter} onChange={e => setPostTypeFilter(e.target.value)} className="select-dark text-xs">
              {POST_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {lang === 'mm' ? t.mm : t.en}</option>)}
            </select>
          </div>
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="select-dark text-xs">
            <option value="all">📋 {lang === 'mm' ? 'အားလုံး' : 'All Status'}</option>
            {Object.entries(STATUSES).map(([key, val]) => (
              <option key={key} value={key}>{val.icon} {lang === 'mm' ? val.mm : val.en}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-4 space-y-2 pb-24">
        {loading ? [1,2,3].map(n => <div key={n} className="h-32 rounded-2xl shimmer" />) :
         posts.length === 0 ? (
           <div className="flex flex-col items-center py-14 text-center">
             <span className="text-4xl mb-3">🏠</span>
             <p className="text-white/40 font-display font-semibold">{lang === 'mm' ? 'အိမ်/အခန်း စာရင်း မရှိသေး' : 'No listings yet'}</p>
           </div>
         ) :
         posts.map(p => (
           <RentCard
             key={p.id}
             post={p}
             lang={lang}
             isLoggedIn={isLoggedIn}
             userId={user?.id}
             onEdit={(post) => { setEditTarget(post); setShowForm(true) }}
             onDelete={deletePost}
             onStatusChange={(post) => setStatusTarget(post)}
           />
         ))}
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
