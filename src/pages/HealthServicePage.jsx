import { useState, useEffect } from 'react'
import { Plus, Trash2, ArrowLeft, Phone, MapPin, Calendar, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../contexts/AppConfigContext'
import { useSEO } from '../hooks/useSEO'
import { uploadImage } from '../lib/cloudinary'
import { ImageUploader } from '../components/UI'

const HEALTH_TYPES = [
  { id: 'all',         mm: 'အားလုံး',       en: 'All',            icon: '🏥' },
  { id: 'free_clinic', mm: 'အခမဲ့ဆေးခန်း',  en: 'Free Clinic',    icon: '💊' },
  { id: 'blood_drive', mm: 'သွေးလှူ',        en: 'Blood Drive',    icon: '🩸' },
  { id: 'vaccination', mm: 'ဆေးထိုး',        en: 'Vaccination',    icon: '💉' },
  { id: 'dental',      mm: 'သွားကြိတ်',      en: 'Dental',         icon: '🦷' },
  { id: 'eye',         mm: 'မျက်စိ',          en: 'Eye',            icon: '👁️' },
  { id: 'other',       mm: 'အခြား',           en: 'Other',          icon: '❤️' },
]
const BLOOD_TYPES = ['A+','A-','B+','B-','O+','O-','AB+','AB-']

function HealthCard({ service, lang, isModerator, onDelete }) {
  const type = HEALTH_TYPES.find(t => t.id === service.type) || HEALTH_TYPES[0]

  return (
    <div className={`card-dark rounded-2xl p-4 space-y-2 border-l-4 ${
      service.type === 'blood_drive' ? 'border-l-red-500/60' : service.type === 'free_clinic' ? 'border-l-green-500/60' : 'border-l-brand-500/40'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-base">{type?.icon}</span>
            <span className="text-[9px] font-bold text-brand-300 bg-brand-600/15 border border-brand-400/20 px-1.5 py-0.5 rounded-full">
              {lang === 'mm' ? type?.mm : type?.en}
            </span>
            {service.is_urgent && <span className="text-[9px] text-red-400 font-bold">⚡ Urgent</span>}
            {service.is_verified && <span className="text-[9px] text-gold-400">✓ Verified</span>}
          </div>
          <h3 className="font-display font-semibold text-sm text-white">{lang === 'mm' ? (service.title_mm || service.title) : service.title}</h3>
          {service.organizer_mm && <p className="text-[10px] text-brand-300 font-myanmar">{service.organizer_mm}</p>}
          {service.description_mm && <p className="text-xs text-white/50 mt-1 font-myanmar line-clamp-2">{service.description_mm}</p>}
        </div>
        {isModerator && (
          <button onClick={() => onDelete(service.id)} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 text-red-400 flex-shrink-0">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {service.blood_types_needed?.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <span className="text-[9px] text-red-400/70 font-myanmar">🩸 လိုအပ်သော သွေးအုပ်စု:</span>
          {service.blood_types_needed.map(bt => (
            <span key={bt} className="text-[9px] font-bold text-red-300 bg-red-500/15 border border-red-500/20 px-1.5 py-0.5 rounded-full">{bt}</span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap text-[10px] text-white/40">
        {service.location_mm && <span className="font-myanmar">📍 {service.location_mm}</span>}
        {service.start_date && <span>📅 {new Date(service.start_date).toLocaleDateString()}{service.end_date && service.end_date !== service.start_date ? ` – ${new Date(service.end_date).toLocaleDateString()}` : ''}</span>}
        {service.start_time && <span>🕐 {service.start_time}{service.end_time ? `–${service.end_time}` : ''}</span>}
      </div>

      <div className="flex gap-2">
        {service.contact_phone && <a href={`tel:${service.contact_phone}`} className="text-[10px] text-green-400 flex items-center gap-1">📞 {service.contact_phone}</a>}
        {service.facebook && <a href={service.facebook} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400">FB Page →</a>}
      </div>
    </div>
  )
}

function HealthForm({ onClose, onSuccess, lang }) {
  const { user, profile, isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    type: 'free_clinic', title: '', title_mm: '', description_mm: '', organizer_mm: '',
    location_mm: '', contact_phone: '', contact_name: '', facebook: '',
    start_date: '', end_date: '', start_time: '', end_time: '',
    blood_types_needed: [], is_urgent: false,
  })
  const [images, setImages] = useState([])
  const [imgLoading, setImgLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  function toggleBloodType(bt) {
    setForm(f => ({...f, blood_types_needed: f.blood_types_needed.includes(bt) ? f.blood_types_needed.filter(b => b !== bt) : [...f.blood_types_needed, bt]}))
  }

  async function handleImageUpload(file) {
    setImgLoading(true)
    const url = await uploadImage(file, 'health')
    setImages(prev => [...prev, url])
    setImgLoading(false)
  }

  async function submit() {
    if (!form.title_mm) return
    setSubmitting(true)
    await supabase.from('health_services').insert({
      ...form,
      images,
      poster_id: user?.id || null,
      posted_at: new Date().toISOString(),
    })
    setSubmitting(false)
    onSuccess()
  }

  if (!isLoggedIn) return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70">
      <div className="w-full max-w-lg bg-[#140020] border border-white/10 rounded-t-3xl p-6 pb-24 text-center">
        <p className="text-white font-myanmar mb-4">တင်ရန် Login လိုအပ်သည်</p>
        <button onClick={() => navigate('/login')} className="btn-primary w-full">Login ဝင်မည်</button>
        <button onClick={onClose} className="btn-ghost w-full mt-2">Cancel</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0015] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
        <h2 className="font-display font-bold text-base text-white">{lang === 'mm' ? 'ဝန်ဆောင်မှု တင်မည်' : 'Post Health Service'}</h2>
        <button onClick={submit} disabled={!form.title_mm || submitting} className="btn-primary text-xs px-4 py-2">{submitting ? '...' : lang === 'mm' ? 'တင်မည်' : 'Post'}</button>
      </div>
      <div className="px-4 py-4 space-y-4 pb-24">
        <div>
          <label className="block text-xs text-white/50 mb-1.5">အမျိုးအစား</label>
          <div className="flex gap-2 flex-wrap">
            {HEALTH_TYPES.filter(t => t.id !== 'all').map(t => (
              <button key={t.id} onClick={() => set('type', t.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border ${form.type === t.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>
                {t.icon} {t.mm}
              </button>
            ))}
          </div>
        </div>

        <div><label className="block text-xs text-white/50 mb-1.5">ခေါင်းစဉ် (မြန်မာ) *</label><input autoFocus value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" /></div>
        <div><label className="block text-xs text-white/50 mb-1.5">အဖွဲ့အစည်း/ဆေးရုံ</label><input value={form.organizer_mm} onChange={e => set('organizer_mm', e.target.value)} className="input-dark font-myanmar" /></div>
        <div><label className="block text-xs text-white/50 mb-1.5">ဖော်ပြချက်</label><textarea value={form.description_mm} onChange={e => set('description_mm', e.target.value)} className="input-dark font-myanmar resize-none h-20" /></div>
        {form.type === 'blood_drive' && (
          <div><label className="block text-xs text-white/50 mb-1.5">🩸 လိုအပ်သော သွေးအုပ်စု</label>
            <div className="flex gap-2 flex-wrap">
              {BLOOD_TYPES.map(bt => (
                <button key={bt} onClick={() => toggleBloodType(bt)} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${form.blood_types_needed.includes(bt) ? 'bg-red-500/25 border-red-500/40 text-red-400' : 'bg-white/5 border-white/10 text-white/40'}`}>{bt}</button>
              ))}
            </div>
          </div>
        )}
        <div><label className="block text-xs text-white/50 mb-1.5">နေရာ</label><input value={form.location_mm} onChange={e => set('location_mm', e.target.value)} className="input-dark font-myanmar" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-[10px] text-white/40 mb-1">Start Date</label><input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="input-dark" /></div>
          <div><label className="block text-[10px] text-white/40 mb-1">End Date</label><input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className="input-dark" /></div>
          <div><label className="block text-[10px] text-white/40 mb-1">Start Time</label><input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className="input-dark" /></div>
          <div><label className="block text-[10px] text-white/40 mb-1">End Time</label><input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} className="input-dark" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-[10px] text-white/40 mb-1">ဆက်သွယ်ရမည့်သူ</label><input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className="input-dark font-myanmar text-sm" /></div>
          <div><label className="block text-[10px] text-white/40 mb-1">ဖုန်း</label><input type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className="input-dark text-sm" placeholder="09..." /></div>
        </div>
        <div><label className="block text-xs text-white/50 mb-1.5">Facebook Page</label><input value={form.facebook} onChange={e => set('facebook', e.target.value)} className="input-dark" placeholder="https://facebook.com/..." /></div>
        <div>
          <label className="block text-xs text-white/50 mb-1.5">ပုံများ (optional)</label>
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
          ⚡ {lang === 'mm' ? 'Urgent — သွေးလိုအပ်/အခြေအနေ ဆိုးရွားနေ' : 'Mark as Urgent'}
        </button>
      </div>
    </div>
  )
}

export default function HealthServicePage() {
  const { lang } = useLang()
  const { user, isModerator, isLoggedIn } = useAuth()
  const config = useAppConfig()
  useSEO({ title: lang === 'mm' ? 'ကျန်းမာရေးဝန်ဆောင်မှု' : 'Health Services' })

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setType] = useState('all')
  const [showForm, setShowForm] = useState(false)

  async function load() {
    setLoading(true)
    try {
      let q = supabase.from('health_services').select('*').eq('status', 'active').order('is_urgent', { ascending: false }).order('posted_at', { ascending: false }).limit(30)
      if (typeFilter !== 'all') q = q.eq('type', typeFilter)
      const { data } = await q
      setItems(data || [])
    } catch (e) { console.warn(e) }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('health-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'health_services' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'health_services' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [typeFilter])

  async function deleteItem(id) {
    if (!confirm(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?')) return
    await supabase.from('health_services').delete().eq('id', id)
    load()
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">🏥 {lang === 'mm' ? 'ကျန်းမာရေးဝန်ဆောင်မှု' : 'Health Services'}</h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? `${config.app_city || ''} အခမဲ့ဆေးခန်း • သွေးလှူ • ဆေးထိုး` : 'Free clinic • Blood drives • Vaccination'}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"><Plus size={14} /> Post</button>
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <select value={typeFilter} onChange={e => setType(e.target.value)} className="select-dark">
            {HEALTH_TYPES.map(t => (
              <option key={t.id} value={t.id} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                {t.icon} {lang === 'mm' ? t.mm : t.en}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      <div className="px-4 space-y-2">
        {loading ? [1,2,3].map(n => <div key={n} className="h-24 rounded-2xl shimmer" />) :
         items.length === 0 ? (
           <div className="flex flex-col items-center py-12 text-center"><span className="text-4xl mb-3">🏥</span><p className="text-white/40 font-display font-semibold">{lang === 'mm' ? 'ဝန်ဆောင်မှု မရှိသေး' : 'No services posted'}</p></div>
         ) :
         items.map(item => (
           <HealthCard
             key={item.id}
             service={item}
             lang={lang}
             isModerator={isModerator}
             onDelete={deleteItem}
           />
         ))}
      </div>

      {showForm && (
        <HealthForm
          lang={lang}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}