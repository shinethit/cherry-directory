import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Phone, BookOpen, Users, Clock, Calendar, ArrowLeft, Trash2, Edit2, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../contexts/AppConfigContext'
import { useSEO } from '../hooks/useSEO'
import { uploadImage } from '../lib/cloudinary'
import { ImageUploader } from '../components/UI'

const SUBJECTS = [
  { id: 'all',       mm: 'အားလုံး',          en: 'All' },
  { id: 'math',      mm: 'သင်္ချာ',           en: 'Mathematics',    icon: '📐' },
  { id: 'physics',   mm: 'ရူပဗေဒ',           en: 'Physics',        icon: '⚛️' },
  { id: 'chemistry', mm: 'ဓာတုဗေဒ',          en: 'Chemistry',      icon: '🧪' },
  { id: 'biology',   mm: 'ဇီဝဗေဒ',           en: 'Biology',        icon: '🔬' },
  { id: 'english',   mm: 'အင်္ဂလိပ်',         en: 'English',        icon: '🇬🇧' },
  { id: 'myanmar',   mm: 'မြန်မာ',            en: 'Myanmar',        icon: '🇲🇲' },
  { id: 'history',   mm: 'သမိုင်း',            en: 'History',        icon: '📜' },
  { id: 'geography', mm: 'ပထဝီ',              en: 'Geography',      icon: '🌍' },
  { id: 'computer',  mm: 'ကွန်ပျူတာ',        en: 'Computer',       icon: '💻' },
  { id: 'other',     mm: 'အခြား',             en: 'Other',          icon: '📚' },
]

const GRADE_LEVELS = [
  { id: 'all',       mm: 'အားလုံး',          en: 'All' },
  { id: 'primary',   mm: 'မူလတန်း (KG-5)',  en: 'Primary',        icon: '📘' },
  { id: 'middle',    mm: 'အလယ်တန်း (6-9)', en: 'Middle School',  icon: '📙' },
  { id: 'high',      mm: 'အထက်တန်း (10-12)',en: 'High School',    icon: '📕' },
  { id: 'university',mm: 'တက္ကသိုလ်',        en: 'University',     icon: '🎓' },
  { id: 'adult',     mm: 'လူကြီး',           en: 'Adult',          icon: '👨‍🎓' },
]

const POST_TYPES = [
  { id: 'all',    mm: 'အားလုံး',    en: 'All' },
  { id: 'tutor',  mm: 'ဆရာ',       en: 'Tutor',     icon: '👨‍🏫' },
  { id: 'student',mm: 'ကျောင်းသား', en: 'Student',  icon: '👨‍🎓' },
]

const STATUSES = {
  available:   { mm: 'သင်နိုင်',     en: 'Available',   color: 'text-green-400', bg: 'bg-green-500/15', icon: '✅' },
  pending:     { mm: 'စောင့်ဆိုင်းဆဲ', en: 'Pending',     color: 'text-amber-400', bg: 'bg-amber-500/15', icon: '⏳' },
  booked:      { mm: 'သင်ပြီး/သင်နေ', en: 'Booked',      color: 'text-blue-400',  bg: 'bg-blue-500/15',  icon: '📖' },
  unavailable: { mm: 'မရနိုင်',     en: 'Unavailable', color: 'text-red-400',   bg: 'bg-red-500/15',   icon: '❌' },
}

function timeAgo(iso, lang) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 60) return `${m}${lang === 'mm' ? 'မိနစ်' : 'm'}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}${lang === 'mm' ? 'နာရီ' : 'h'}`
  return `${Math.floor(h/24)}${lang === 'mm' ? 'ရက်' : 'd'}`
}

function TutoringCard({ post, lang, isLoggedIn, userId, onEdit, onDelete, onStatusChange }) {
  const navigate = useNavigate()
  const subject = SUBJECTS.find(s => s.id === post.subject) || SUBJECTS[0]
  const grade = GRADE_LEVELS.find(g => g.id === post.grade_level) || GRADE_LEVELS[0]
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
    <div className={`card-dark rounded-2xl p-4 space-y-3 border-l-4 ${status.color === 'text-green-400' ? 'border-l-green-500/60' : status.color === 'text-amber-400' ? 'border-l-amber-500/60' : 'border-l-blue-500/60'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-lg">{subject.icon}</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-300">
              {lang === 'mm' ? subject.mm : subject.en}
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/50">
              {postType.icon} {lang === 'mm' ? postType.mm : postType.en}
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-white/40">
              {grade.icon} {lang === 'mm' ? grade.mm : grade.en}
            </span>
          </div>
          <h3 className="font-display font-semibold text-sm text-white">{post.title_mm || post.title}</h3>
          {post.location_mm && (
            <div className="flex items-center gap-1 mt-1 text-white/40">
              <span className="text-[10px] font-myanmar">📍 {post.location_mm}</span>
            </div>
          )}
          {(post.price_hourly || post.price_monthly) && (
            <div className="flex gap-2 mt-1.5 text-xs">
              {post.price_hourly && (
                <span className="text-gold-400 font-mono">{Number(post.price_hourly).toLocaleString()} Ks/နာရီ</span>
              )}
              {post.price_monthly && (
                <span className="text-white/40 font-mono">{Number(post.price_monthly).toLocaleString()} Ks/လ</span>
              )}
            </div>
          )}
          {post.availability_schedule && (
            <div className="flex items-center gap-1 mt-1 text-white/30 text-[10px]">
              <Clock size={9} /> {post.availability_schedule}
            </div>
          )}
          {post.description_mm && (
            <p className="text-[10px] text-white/50 mt-1 font-myanmar line-clamp-2">{post.description_mm}</p>
          )}
        </div>

        <div className={`text-right flex-shrink-0 ${status.bg} px-2 py-1 rounded-lg`}>
          <span className={`text-[9px] font-bold ${status.color}`}>{status.icon} {lang === 'mm' ? status.mm : status.en}</span>
        </div>
      </div>

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
            <button onClick={() => onStatusChange(post)} className="w-6 h-6 rounded-lg bg-white/8 flex items-center justify-center" title="Status ပြောင်း">
              <Clock size={11} className="text-white/40" />
            </button>
            <button onClick={() => onEdit(post)} className="w-6 h-6 rounded-lg bg-white/8 flex items-center justify-center">
              <Edit2 size={11} className="text-white/40" />
            </button>
            <button onClick={() => onDelete(post.id)} className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Trash2 size={11} className="text-red-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function TutoringForm({ onClose, onSuccess, lang, editPost }) {
  const { user, profile, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '', title_mm: '', description_mm: '', location_mm: '',
    subject: 'math', grade_level: 'high', post_type: 'tutor',
    price_hourly: '', price_monthly: '', phone: '', contact_name: '',
    availability_schedule: '', is_urgent: false, status: 'available',
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
        subject: editPost.subject || 'math',
        grade_level: editPost.grade_level || 'high',
        post_type: editPost.post_type || 'tutor',
        price_hourly: editPost.price_hourly || '',
        price_monthly: editPost.price_monthly || '',
        phone: editPost.phone || '',
        contact_name: editPost.contact_name || '',
        availability_schedule: editPost.availability_schedule || '',
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
    const url = await uploadImage(file, 'tutoring')
    setImages(prev => [...prev, url])
    setImgLoading(false)
  }

  async function submit() {
    if (!form.title_mm && !form.title) return
    setSubmitting(true)

    const payload = {
      ...form,
      price_hourly: form.price_hourly ? parseInt(form.price_hourly) : null,
      price_monthly: form.price_monthly ? parseInt(form.price_monthly) : null,
      images,
      user_id: user?.id,
      poster_name: profile?.full_name || profile?.nickname,
    }

    console.log('[TutoringForm] Submitting payload:', payload)

    try {
      if (editPost) {
        const { error } = await supabase.from('tutoring').update(payload).eq('id', editPost.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('tutoring').insert(payload).select()
        console.log('[TutoringForm] Insert response:', { data, error })
        if (error) throw error
      }
      setSubmitting(false)
      onSuccess()
    } catch (err) {
      console.error('[TutoringForm] Submit error:', err)
      alert('Error: ' + err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0015] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
        <h2 className="font-display font-bold text-base text-white">{editPost ? (lang === 'mm' ? 'ပြင်ဆင်မည်' : 'Edit') : (lang === 'mm' ? 'ဆရာ/သင်တန်း တင်မည်' : 'Post Tutoring')}</h2>
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဘာသာရပ်' : 'Subject'}</label>
            <select value={form.subject} onChange={e => set('subject', e.target.value)} className="select-dark">
              {SUBJECTS.filter(s => s.id !== 'all').map(s => (
                <option key={s.id} value={s.id}>{s.icon} {lang === 'mm' ? s.mm : s.en}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'အတန်းအဆင့်' : 'Grade Level'}</label>
            <select value={form.grade_level} onChange={e => set('grade_level', e.target.value)} className="select-dark">
              {GRADE_LEVELS.filter(g => g.id !== 'all').map(g => (
                <option key={g.id} value={g.id}>{g.icon} {lang === 'mm' ? g.mm : g.en}</option>
              ))}
            </select>
          </div>
        </div>

        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ခေါင်းစဉ် (မြန်မာ)' : 'Title (Myanmar)'} *</label><input autoFocus value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: သင်္ချာစာသင်မည်" /></div>
        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဖော်ပြချက်' : 'Description'}</label><textarea value={form.description_mm} onChange={e => set('description_mm', e.target.value)} className="input-dark font-myanmar resize-none h-20" placeholder="သင်ကြားမည့်ပုံစံ၊ အတွေ့အကြုံ၊ သင်ခန်းစာ..." /></div>
        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'နေရာ' : 'Location'}</label><input value={form.location_mm} onChange={e => set('location_mm', e.target.value)} className="input-dark font-myanmar" placeholder="အွန်လိုင်း / မြို့နယ်..." /></div>
        
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'တစ်နာရီချေ (Ks)' : 'Hourly Rate (Ks)'}</label><input type="number" value={form.price_hourly} onChange={e => set('price_hourly', e.target.value)} className="input-dark font-mono" placeholder="e.g. 5000" /></div>
          <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'လစဉ်ချေ (Ks)' : 'Monthly Rate (Ks)'}</label><input type="number" value={form.price_monthly} onChange={e => set('price_monthly', e.target.value)} className="input-dark font-mono" placeholder="e.g. 50000" /></div>
        </div>

        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'သင်ကြားနိုင်သည့်အချိန်' : 'Availability'}</label><input value={form.availability_schedule} onChange={e => set('availability_schedule', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: စနေ၊ တနင်္ဂနွေ၊ ညနေ ၄-၆" /></div>

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
          ⚡ {lang === 'mm' ? 'Urgent — အမြန်လိုအပ်' : 'Mark as Urgent'}
        </button>
      </div>
    </div>
  )
}

function StatusModal({ post, onClose, onUpdate, lang }) {
  const [status, setStatus] = useState(post.status)

  const updateStatus = async () => {
    await supabase.from('tutoring').update({ status }).eq('id', post.id)
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

export default function TutoringPage() {
  const { lang } = useLang()
  const { user, isModerator, isLoggedIn } = useAuth()
  const config = useAppConfig()
  useSEO({ title: lang === 'mm' ? 'ဆရာ/ကျောင်းသား ချိတ်ဆက်ရေး' : 'Tutoring' })

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [postTypeFilter, setPostTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)

  async function load() {
    setLoading(true)
    try {
      let q = supabase.from('tutoring').select('*').order('is_urgent', { ascending: false }).order('created_at', { ascending: false })
      if (subjectFilter !== 'all') q = q.eq('subject', subjectFilter)
      if (gradeFilter !== 'all') q = q.eq('grade_level', gradeFilter)
      if (postTypeFilter !== 'all') q = q.eq('post_type', postTypeFilter)
      if (statusFilter !== 'all') q = q.eq('status', statusFilter)
      const { data, error } = await q
      if (error) throw error
      setPosts(data || [])
    } catch (e) { console.warn(e) }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('tutoring-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tutoring' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tutoring' }, load)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tutoring' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [subjectFilter, gradeFilter, postTypeFilter, statusFilter])

  async function deletePost(id) {
    if (!confirm(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?')) return
    await supabase.from('tutoring').delete().eq('id', id)
    load()
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">📚 {lang === 'mm' ? 'ဆရာ/ကျောင်းသား ချိတ်ဆက်ရေး' : 'Tutoring'}</h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? 'ဆရာရှာ၊ ကျောင်းသားရှာ' : 'Find tutors & students'}</p>
        </div>
        <button onClick={() => { setEditTarget(null); setShowForm(true) }} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5"><Plus size={14} /> {lang === 'mm' ? 'တင်မည်' : 'Post'}</button>
      </div>

      {/* Filters */}
      <div className="px-4 space-y-2 mb-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="select-dark text-xs">
              {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.icon} {lang === 'mm' ? s.mm : s.en}</option>)}
            </select>
          </div>
          <div className="relative">
            <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="select-dark text-xs">
              {GRADE_LEVELS.map(g => <option key={g.id} value={g.id}>{g.icon} {lang === 'mm' ? g.mm : g.en}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <select value={postTypeFilter} onChange={e => setPostTypeFilter(e.target.value)} className="select-dark text-xs">
              {POST_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {lang === 'mm' ? t.mm : t.en}</option>)}
            </select>
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
      </div>

      <div className="px-4 space-y-2 pb-24">
        {loading ? [1,2,3].map(n => <div key={n} className="h-36 rounded-2xl shimmer" />) :
         posts.length === 0 ? (
           <div className="flex flex-col items-center py-14 text-center">
             <span className="text-4xl mb-3">📚</span>
             <p className="text-white/40 font-display font-semibold">{lang === 'mm' ? 'စာရင်း မရှိသေး' : 'No listings yet'}</p>
           </div>
         ) :
         posts.map(p => (
           <TutoringCard
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
        <TutoringForm
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