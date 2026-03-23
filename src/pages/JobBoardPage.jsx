import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Phone, MapPin, ArrowLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../hooks/useAppConfig'
import { useSEO } from '../hooks/useSEO'

const JOB_CATS = [
  { id: 'all',          mm: 'အားလုံး',        en: 'All',          icon: '💼' },
  { id: 'restaurant',   mm: 'စားသောက်ဆိုင်',  en: 'Restaurant',   icon: '🍜' },
  { id: 'retail',       mm: 'ရောင်းဝယ်ရေး',   en: 'Retail',       icon: '🛍️' },
  { id: 'driver',       mm: 'ယာဉ်မောင်း',      en: 'Driver',       icon: '🚗' },
  { id: 'office',       mm: 'ရုံးလုပ်ငန်း',    en: 'Office',       icon: '🏢' },
  { id: 'construction', mm: 'ဆောက်လုပ်ရေး',   en: 'Construction', icon: '🏗️' },
  { id: 'other',        mm: 'အခြား',           en: 'Other',        icon: '📋' },
]
const JOB_TYPES = [
  { id: 'fulltime',   mm: 'ပုံသေဝန်ထမ်း', en: 'Full-time'  },
  { id: 'parttime',   mm: 'အချိန်ပိုင်း',  en: 'Part-time'  },
  { id: 'freelance',  mm: 'Freelance',    en: 'Freelance'  },
  { id: 'temporary',  mm: 'ယာယီ',         en: 'Temporary'  },
]

function timeAgo(iso, lang) {
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000)
  if (d === 0) return lang === 'mm' ? 'ယနေ့' : 'Today'
  if (d === 1) return lang === 'mm' ? 'မနေ့က' : 'Yesterday'
  return `${d}${lang === 'mm' ? ' ရက်က' : 'd ago'}`
}

function JobCard({ job, lang }) {
  const navigate = useNavigate()
  const cat  = JOB_CATS.find(c => c.id === job.category)
  const type = JOB_TYPES.find(t => t.id === job.type)
  const salaryStr = job.salary_min
    ? `${Number(job.salary_min).toLocaleString()}${job.salary_max ? '–' + Number(job.salary_max).toLocaleString() : '+'} Ks/${lang === 'mm' ? (job.salary_unit === 'day' ? 'ရက်' : job.salary_unit === 'week' ? 'ပတ်' : 'လ') : job.salary_unit}`
    : (lang === 'mm' ? 'သဘောတူညီ' : 'Negotiable')

  return (
    <div className="card-listing cursor-pointer p-4 space-y-2" onClick={() => navigate(`/jobs/${job.id}`)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {job.is_urgent && <span className="text-[8px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 rounded-full">⚡ Urgent</span>}
            <span className="text-[9px] text-white/40 bg-white/6 px-1.5 py-0.5 rounded-full">{cat?.icon} {lang === 'mm' ? cat?.mm : cat?.en}</span>
            <span className="text-[9px] text-brand-300 bg-brand-600/15 border border-brand-400/20 px-1.5 py-0.5 rounded-full">{lang === 'mm' ? type?.mm : type?.en}</span>
          </div>
          <h3 className="font-display font-semibold text-sm text-white">{lang === 'mm' ? (job.title_mm || job.title) : job.title}</h3>
          {(job.company_mm || job.company) && (
            <p className="text-xs text-white/50 font-myanmar">{lang === 'mm' ? (job.company_mm || job.company) : job.company}</p>
          )}
        </div>
        <ChevronRight size={16} className="text-white/20 flex-shrink-0 mt-1" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold text-green-400">{salaryStr}</span>
        {job.location_mm || job.location ? (
          <span className="flex items-center gap-1 text-[10px] text-white/40">
            <MapPin size={10} />
            {lang === 'mm' ? (job.location_mm || job.location) : job.location}
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/30">{timeAgo(job.posted_at, lang)}</span>
        {job.contact_phone && (
          <a href={`tel:${job.contact_phone}`} onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] text-green-400 hover:text-green-300">
            <Phone size={11} /> {job.contact_phone}
          </a>
        )}
      </div>
    </div>
  )
}

function PostJobForm({ onClose, onSuccess, lang }) {
  const { user, profile, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '', title_mm: '', company_mm: '', description_mm: '', requirements_mm: '',
    type: 'fulltime', category: 'other', salary_min: '', salary_max: '',
    salary_unit: 'month', location_mm: '', contact_name: '', contact_phone: '',
    contact_fb: '', is_urgent: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (!isLoggedIn) return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70">
      <div className="w-full max-w-lg bg-[#140020] border border-white/10 rounded-t-3xl p-6 text-center">
        <p className="text-white font-myanmar mb-4">အလုပ်ကြော်ငြာ တင်ရန် Login လိုအပ်သည်</p>
        <button onClick={() => navigate('/login')} className="btn-primary w-full">Login ဝင်မည်</button>
        <button onClick={onClose} className="btn-ghost w-full mt-2">Cancel</button>
      </div>
    </div>
  )

  async function submit() {
    if (!form.title_mm && !form.title) return
    setSubmitting(true)
    await supabase.from('jobs').insert({
      ...form,
      salary_min: form.salary_min ? parseInt(form.salary_min) : null,
      salary_max: form.salary_max ? parseInt(form.salary_max) : null,
      poster_id:  user.id,
    })
    setSubmitting(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0015] overflow-y-auto pb-24">
      <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
        <h2 className="font-display font-bold text-base text-white">အလုပ်ကြော်ငြာ တင်မည်</h2>
        <button onClick={submit} disabled={submitting || (!form.title && !form.title_mm)} className="btn-primary text-xs px-4 py-2">
          {submitting ? '...' : 'Post'}
        </button>
      </div>
      <div className="px-4 py-4 space-y-4 pb-24">
        <div><label className="block text-xs text-white/50 mb-1.5">ရာထူး/အလုပ် (မြန်မာ) *</label><input value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: ကော်ဖီဆိုင် Cashier လိုသည်" /></div>
        <div><label className="block text-xs text-white/50 mb-1.5">ကုမ္ပဏီ/လုပ်ငန်းအမည်</label><input value={form.company_mm} onChange={e => set('company_mm', e.target.value)} className="input-dark font-myanmar" /></div>
        <div>
          <label className="block text-xs text-white/50 mb-1.5">အမျိုးအစား</label>
          <div className="flex gap-2 flex-wrap">
            {JOB_CATS.filter(c => c.id !== 'all').map(c => (
              <button key={c.id} onClick={() => set('category', c.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border ${form.category === c.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>
                {c.icon} {lang === 'mm' ? c.mm : c.en}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1.5">အလုပ်ပုံစံ</label>
          <div className="flex gap-2 flex-wrap">
            {JOB_TYPES.map(t => (
              <button key={t.id} onClick={() => set('type', t.id)}
                className={`px-3 py-1.5 rounded-full text-xs border ${form.type === t.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>
                {lang === 'mm' ? t.mm : t.en}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1"><label className="block text-xs text-white/50 mb-1.5">လစာ Min</label><input type="number" value={form.salary_min} onChange={e => set('salary_min', e.target.value)} className="input-dark" placeholder="150000" /></div>
          <div className="col-span-1"><label className="block text-xs text-white/50 mb-1.5">Max</label><input type="number" value={form.salary_max} onChange={e => set('salary_max', e.target.value)} className="input-dark" /></div>
          <div className="col-span-1"><label className="block text-xs text-white/50 mb-1.5">Unit</label>
            <select value={form.salary_unit} onChange={e => set('salary_unit', e.target.value)} className="select-dark text-xs">
              <option value="day">ရက်</option><option value="week">ပတ်</option><option value="month">လ</option>
            </select>
          </div>
        </div>
        <div><label className="block text-xs text-white/50 mb-1.5">တည်နေရာ</label><input value={form.location_mm} onChange={e => set('location_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ရပ်ကွက်/မြို့" /></div>
        <div><label className="block text-xs text-white/50 mb-1.5">လိုအပ်ချက်</label><textarea value={form.requirements_mm} onChange={e => set('requirements_mm', e.target.value)} className="input-dark font-myanmar resize-none h-20" placeholder="ဥပမာ: မတ္တာ ၁၈+ / အတွေ့အကြုံ မလိုဘူး..." /></div>
        <div><label className="block text-xs text-white/50 mb-1.5">ဖော်ပြချက်</label><textarea value={form.description_mm} onChange={e => set('description_mm', e.target.value)} className="input-dark font-myanmar resize-none h-20" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs text-white/50 mb-1.5">ဆက်သွယ်ရမည့်သူ</label><input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className="input-dark font-myanmar" /></div>
          <div><label className="block text-xs text-white/50 mb-1.5">ဖုန်း</label><input type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className="input-dark" placeholder="09..." /></div>
        </div>
        <button onClick={() => set('is_urgent', !form.is_urgent)} className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${form.is_urgent ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/10 text-white/50'}`}>
          ⚡ {lang === 'mm' ? 'Urgent — အမြန်လိုသည်' : 'Mark as Urgent'}
        </button>
      </div>
    </div>
  )
}

export default function JobBoardPage() {
  const { lang } = useLang()
  const config = useAppConfig()
  const { isLoggedIn } = useAuth()
  useSEO({ title: lang === 'mm' ? 'အလုပ်ကြော်ငြာ' : 'Job Board' })

  const [jobs, setJobs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [catFilter, setCatFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)

  async function load() {
    setLoading(true)
    try {
    let q = supabase.from('jobs').select('*').eq('status', 'active').order('is_urgent', { ascending: false }).order('posted_at', { ascending: false }).limit(50)
    if (catFilter !== 'all') q = q.eq('category', catFilter)
    const { data } = await q
    setJobs(data || [])
    } catch (e) { console.warn(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [catFilter])

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">💼 {lang === 'mm' ? 'အလုပ်ကြော်ငြာ' : 'Job Board'}</h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? `${config.app_city || ''} Local Jobs` : `Local jobs`}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0">
          <Plus size={14} /> Post Job
        </button>
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="select-dark"
          >
            {JOB_CATS.map(c => (
              <option key={c.id} value={c.id} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                {c.icon} {lang === 'mm' ? c.mm : c.en}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      <div className="px-4 space-y-2">
        {loading ? [1,2,3].map(n => <div key={n} className="h-24 rounded-2xl shimmer" />) :
         jobs.length === 0 ? <div className="flex flex-col items-center py-14 text-center"><span className="text-4xl mb-3">💼</span><p className="text-white/40 font-display font-semibold">{lang === 'mm' ? 'အလုပ်ကြော်ငြာ မရှိသေး' : 'No jobs posted yet'}</p></div> :
         jobs.map(j => <JobCard key={j.id} job={j} lang={lang} />)}
      </div>

      {showForm && <PostJobForm lang={lang} onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); load() }} />}
    </div>
  )
}
