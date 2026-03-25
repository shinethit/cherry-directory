import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Phone, MapPin, ArrowLeft, Trash2, Edit2, Clock, Briefcase, Users, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../hooks/useAppConfig'
import { useSEO } from '../hooks/useSEO'
import { uploadImage } from '../lib/cloudinary'
import { ImageUploader } from '../components/UI'

const JOB_CATS = [
  { id: 'all',          mm: 'အားလုံး',        en: 'All',          icon: '💼' },
  { id: 'restaurant',   mm: 'စားသောက်ဆိုင်',  en: 'Restaurant',   icon: '🍜' },
  { id: 'retail',       mm: 'ရောင်းဝယ်ရေး',   en: 'Retail',       icon: '🛍️' },
  { id: 'driver',       mm: 'ယာဉ်မောင်း',      en: 'Driver',       icon: '🚗' },
  { id: 'office',       mm: 'ရုံးလုပ်ငန်း',    en: 'Office',       icon: '🏢' },
  { id: 'construction', mm: 'ဆောက်လုပ်ရေး',   en: 'Construction', icon: '🏗️' },
  { id: 'education',    mm: 'ပညာရေး',         en: 'Education',    icon: '📚' },
  { id: 'healthcare',   mm: 'ကျန်းမာရေး',      en: 'Healthcare',  icon: '🏥' },
  { id: 'it',           mm: 'နည်းပညာ',        en: 'IT',           icon: '💻' },
  { id: 'other',        mm: 'အခြား',           en: 'Other',        icon: '📋' },
]

const JOB_TYPES = [
  { id: 'fulltime',   mm: 'ပုံသေဝန်ထမ်း', en: 'Full-time'  },
  { id: 'parttime',   mm: 'အချိန်ပိုင်း',  en: 'Part-time'  },
  { id: 'freelance',  mm: 'Freelance',    en: 'Freelance'  },
  { id: 'temporary',  mm: 'ယာယီ',         en: 'Temporary'  },
  { id: 'internship', mm: 'အလုပ်သင်ကာလ', en: 'Internship' },
]

const POST_TYPES = [
  { id: 'all',     mm: 'အားလုံး',    en: 'All' },
  { id: 'employer',mm: 'အလုပ်ရှင်',  en: 'Employer',  icon: '👔' },
  { id: 'jobseeker',mm: 'အလုပ်ရှာ', en: 'Job Seeker', icon: '🔍' },
]

const STATUSES = {
  available:   { mm: 'လျှောက်လို့ရ',  en: 'Open',       color: 'text-green-400', bg: 'bg-green-500/15', icon: '✅' },
  pending:     { mm: 'စောင့်ဆိုင်းဆဲ', en: 'Pending',     color: 'text-amber-400', bg: 'bg-amber-500/15', icon: '⏳' },
  filled:      { mm: 'ပြည့်သွားပြီ',  en: 'Filled',      color: 'text-red-400',   bg: 'bg-red-500/15',   icon: '❌' },
}

function timeAgo(iso, lang) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 60) return `${m}${lang === 'mm' ? 'မိနစ်' : 'm'}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}${lang === 'mm' ? 'နာရီ' : 'h'}`
  return `${Math.floor(h/24)}${lang === 'mm' ? 'ရက်' : 'd'}`
}

function JobCard({ job, lang, isLoggedIn, userId, onEdit, onDelete, onStatusChange }) {
  const navigate = useNavigate()
  const cat = JOB_CATS.find(c => c.id === job.category) || JOB_CATS[0]
  const type = JOB_TYPES.find(t => t.id === job.type) || JOB_TYPES[0]
  const postType = POST_TYPES.find(t => t.id === job.post_type) || POST_TYPES[1]
  const status = STATUSES[job.status] || STATUSES.available
  const isOwner = isLoggedIn && (job.user_id === userId)

  const salaryStr = job.salary_min
    ? `${Number(job.salary_min).toLocaleString()}${job.salary_max ? '–' + Number(job.salary_max).toLocaleString() : '+'} Ks/${lang === 'mm' ? (job.salary_unit === 'day' ? 'ရက်' : job.salary_unit === 'week' ? 'ပတ်' : 'လ') : job.salary_unit}`
    : (lang === 'mm' ? 'သဘောတူညီ' : 'Negotiable')

  const handleContact = () => {
    if (job.phone) {
      window.location.href = `tel:${job.phone}`
    } else if (job.user_id) {
      navigate(`/profile/${job.user_id}`)
    }
  }

  return (
    <div className={`card-dark rounded-2xl p-4 space-y-2 border-l-4 ${status.color === 'text-green-400' ? 'border-l-green-500/60' : 'border-l-amber-500/60'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {job.is_urgent && <span className="text-[8px] font-bold text-red-400 bg-red-500/15 border border-red-500/25 px-1.5 py-0.5 rounded-full">⚡ Urgent</span>}
            <span className="text-[9px] text-white/40 bg-white/6 px-1.5 py-0.5 rounded-full">{cat?.icon} {lang === 'mm' ? cat?.mm : cat?.en}</span>
            <span className="text-[9px] text-brand-300 bg-brand-600/15 border border-brand-400/20 px-1.5 py-0.5 rounded-full">{lang === 'mm' ? type?.mm : type?.en}</span>
            <span className="text-[9px] text-white/40 bg-white/6 px-1.5 py-0.5 rounded-full">
              {postType.icon} {lang === 'mm' ? postType.mm : postType.en}
            </span>
          </div>
          <h3 className="font-display font-semibold text-sm text-white">{lang === 'mm' ? (job.title_mm || job.title) : job.title}</h3>
          {(job.company_mm || job.company) && (
            <p className="text-xs text-white/50 font-myanmar">{lang === 'mm' ? (job.company_mm || job.company) : job.company}</p>
          )}
          {job.location_mm && (
            <div className="flex items-center gap-1 mt-1 text-white/40">
              <MapPin size={10} />
              <span className="text-[10px] truncate font-myanmar">{job.location_mm}</span>
            </div>
          )}
        </div>

        <div className={`text-right flex-shrink-0 ${status.bg} px-2 py-1 rounded-lg`}>
          <span className={`text-[9px] font-bold ${status.color}`}>{status.icon} {lang === 'mm' ? status.mm : status.en}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold text-green-400">{salaryStr}</span>
      </div>

      {job.requirements_mm && (
        <p className="text-[10px] text-white/40 font-myanmar line-clamp-1">📋 {job.requirements_mm}</p>
      )}

      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-2">
          {job.phone && (
            <button onClick={handleContact} className="flex items-center gap-1 text-[10px] text-green-400 hover:text-green-300">
              <Phone size={10} /> {job.phone}
            </button>
          )}
          <span className="text-[10px] text-white/30">{timeAgo(job.posted_at, lang)}</span>
        </div>
        
        {isOwner && (
          <div className="flex gap-1">
            <button onClick={() => onStatusChange(job)} className="w-6 h-6 rounded-lg bg-white/8 flex items-center justify-center" title="Status ပြောင်း">
              <Clock size={11} className="text-white/40" />
            </button>
            <button onClick={() => onEdit(job)} className="w-6 h-6 rounded-lg bg-white/8 flex items-center justify-center">
              <Edit2 size={11} className="text-white/40" />
            </button>
            <button onClick={() => onDelete(job.id)} className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Trash2 size={11} className="text-red-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function JobForm({ onClose, onSuccess, lang, editPost }) {
  const { user, profile, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '', title_mm: '', company_mm: '', description_mm: '', requirements_mm: '',
    type: 'fulltime', category: 'other', post_type: 'employer',
    salary_min: '', salary_max: '', salary_unit: 'month',
    location_mm: '', contact_name: '', contact_phone: '', contact_fb: '',
    is_urgent: false, status: 'available',
  })
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (editPost) {
      setForm({
        title: editPost.title || '',
        title_mm: editPost.title_mm || '',
        company_mm: editPost.company_mm || '',
        description_mm: editPost.description_mm || '',
        requirements_mm: editPost.requirements_mm || '',
        type: editPost.type || 'fulltime',
        category: editPost.category || 'other',
        post_type: editPost.post_type || 'employer',
        salary_min: editPost.salary_min || '',
        salary_max: editPost.salary_max || '',
        salary_unit: editPost.salary_unit || 'month',
        location_mm: editPost.location_mm || '',
        contact_name: editPost.contact_name || '',
        contact_phone: editPost.contact_phone || '',
        contact_fb: editPost.contact_fb || '',
        is_urgent: editPost.is_urgent || false,
        status: editPost.status || 'available',
      })
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

  async function submit() {
    if (!form.title_mm && !form.title) return
    setSubmitting(true)
    const payload = {
      ...form,
      salary_min: form.salary_min ? parseInt(form.salary_min) : null,
      salary_max: form.salary_max ? parseInt(form.salary_max) : null,
      user_id: user.id,
      poster_name: profile?.full_name || profile?.nickname,
      posted_at: new Date().toISOString(),
    }
    
    if (editPost) {
      await supabase.from('jobs').update(payload).eq('id', editPost.id)
    } else {
      await supabase.from('jobs').insert(payload)
    }
    setSubmitting(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0015] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
        <h2 className="font-display font-bold text-base text-white">{editPost ? (lang === 'mm' ? 'ပြင်ဆင်မည်' : 'Edit') : (lang === 'mm' ? 'အလုပ်ကြော်ငြာ တင်မည်' : 'Post Job')}</h2>
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

        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ခေါင်းစဉ် (မြန်မာ)' : 'Title (Myanmar)'} *</label><input autoFocus value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: ကော်ဖီဆိုင် Cashier လိုသည် / စာရေးအလုပ်ရှာသည်" /></div>
        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ကုမ္ပဏီ/လုပ်ငန်းအမည်' : 'Company Name'}</label><input value={form.company_mm} onChange={e => set('company_mm', e.target.value)} className="input-dark font-myanmar" /></div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'အမျိုးအစား' : 'Category'}</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className="select-dark">
              {JOB_CATS.filter(c => c.id !== 'all').map(c => (
                <option key={c.id} value={c.id}>{c.icon} {lang === 'mm' ? c.mm : c.en}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'အလုပ်ပုံစံ' : 'Job Type'}</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} className="select-dark">
              {JOB_TYPES.map(t => (
                <option key={t.id} value={t.id}>{lang === 'mm' ? t.mm : t.en}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div><label className="block text-xs text-white/50 mb-1.5">လစာ Min</label><input type="number" value={form.salary_min} onChange={e => set('salary_min', e.target.value)} className="input-dark" placeholder="150000" /></div>
          <div><label className="block text-xs text-white/50 mb-1.5">Max</label><input type="number" value={form.salary_max} onChange={e => set('salary_max', e.target.value)} className="input-dark" /></div>
          <div><label className="block text-xs text-white/50 mb-1.5">Unit</label>
            <select value={form.salary_unit} onChange={e => set('salary_unit', e.target.value)} className="select-dark text-xs">
              <option value="day">ရက်</option><option value="week">ပတ်</option><option value="month">လ</option>
            </select>
          </div>
        </div>

        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'တည်နေရာ' : 'Location'}</label><input value={form.location_mm} onChange={e => set('location_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ရပ်ကွက်/မြို့ / အွန်လိုင်း" /></div>
        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'လိုအပ်ချက်' : 'Requirements'}</label><textarea value={form.requirements_mm} onChange={e => set('requirements_mm', e.target.value)} className="input-dark font-myanmar resize-none h-20" placeholder="ဥပမာ: မတ္တာ ၁၈+ / အတွေ့အကြုံ လိုသူ/မလိုဘူး..." /></div>
        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဖော်ပြချက်' : 'Description'}</label><textarea value={form.description_mm} onChange={e => set('description_mm', e.target.value)} className="input-dark font-myanmar resize-none h-20" /></div>
        
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဆက်သွယ်ရမည့်သူ' : 'Contact Name'}</label><input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className="input-dark font-myanmar" /></div>
          <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဖုန်း' : 'Phone'}</label><input type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className="input-dark" placeholder="09..." /></div>
        </div>

        <button onClick={() => set('is_urgent', !form.is_urgent)} className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${form.is_urgent ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/10 text-white/50'}`}>
          ⚡ {lang === 'mm' ? 'Urgent — အမြန်လိုသည်' : 'Mark as Urgent'}
        </button>
      </div>
    </div>
  )
}

function StatusModal({ post, onClose, onUpdate, lang }) {
  const [status, setStatus] = useState(post.status)

  const updateStatus = async () => {
    await supabase.from('jobs').update({ status }).eq('id', post.id)
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

export default function JobBoardPage() {
  const { lang } = useLang()
  const config = useAppConfig()
  const { user, isLoggedIn } = useAuth()
  useSEO({ title: lang === 'mm' ? 'အလုပ်ကြော်ငြာ' : 'Job Board' })

  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState('all')
  const [postTypeFilter, setPostTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)

  async function load() {
    setLoading(true)
    try {
      let q = supabase
        .from('jobs')
        .select('*')
        .eq('status', 'active')  // Only show active by default? No, we want to show all based on filter
        .order('is_urgent', { ascending: false })
        .order('posted_at', { ascending: false })
        .limit(50)
      
      // Remove the default active filter since we have statusFilter now
      q = supabase
        .from('jobs')
        .select('*')
        .order('is_urgent', { ascending: false })
        .order('posted_at', { ascending: false })
        .limit(50)
      
      if (catFilter !== 'all') q = q.eq('category', catFilter)
      if (postTypeFilter !== 'all') q = q.eq('post_type', postTypeFilter)
      if (statusFilter !== 'all') q = q.eq('status', statusFilter)
      
      const { data } = await q
      setJobs(data || [])
    } catch (e) { console.warn(e) }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('jobs-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' }, load)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'jobs' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [catFilter, postTypeFilter, statusFilter])

  async function deleteJob(id) {
    if (!confirm(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?')) return
    await supabase.from('jobs').delete().eq('id', id)
    load()
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">💼 {lang === 'mm' ? 'အလုပ်ကြော်ငြာ' : 'Job Board'}</h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? `${config.app_city || ''} အလုပ်ရှင် / အလုပ်ရှာ` : `Employers & Job Seekers`}</p>
        </div>
        <button onClick={() => { setEditTarget(null); setShowForm(true) }} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0">
          <Plus size={14} /> Post
        </button>
      </div>

      {/* Filters */}
      <div className="px-4 space-y-2 mb-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="select-dark text-xs">
              {JOB_CATS.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {lang === 'mm' ? c.mm : c.en}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <select value={postTypeFilter} onChange={e => setPostTypeFilter(e.target.value)} className="select-dark text-xs">
              {POST_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.icon} {lang === 'mm' ? t.mm : t.en}</option>
              ))}
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

      <div className="px-4 space-y-2">
        {loading ? [1,2,3].map(n => <div key={n} className="h-28 rounded-2xl shimmer" />) :
         jobs.length === 0 ? (
           <div className="flex flex-col items-center py-14 text-center">
             <span className="text-4xl mb-3">💼</span>
             <p className="text-white/40 font-display font-semibold">{lang === 'mm' ? 'ကြော်ငြာ မရှိသေး' : 'No jobs posted yet'}</p>
           </div>
         ) :
         jobs.map(j => (
           <JobCard
             key={j.id}
             job={j}
             lang={lang}
             isLoggedIn={isLoggedIn}
             userId={user?.id}
             onEdit={(job) => { setEditTarget(job); setShowForm(true) }}
             onDelete={deleteJob}
             onStatusChange={(job) => setStatusTarget(job)}
           />
         ))}
      </div>

      {showForm && (
        <JobForm
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
