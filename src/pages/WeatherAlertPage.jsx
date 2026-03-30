import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ArrowLeft, Droplets, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { useAppConfig } from '../contexts/AppConfigContext'
import { useSEO } from '../hooks/useSEO'
import { ImageUploader } from '../components/UI'
import { uploadImage } from '../lib/cloudinary'
import Lightbox from '../components/Lightbox'

const ALERT_TYPES = [
  { id: 'all',         mm: 'အားလုံး',           en: 'All',           icon: '🌤️' },
  { id: 'rain',        mm: 'မိုးရွာ/မိုးသက်',    en: 'Rain/Storm',    icon: '🌧️' },
  { id: 'flood',       mm: 'ရေကြီး',            en: 'Flood',         icon: '🌊' },
  { id: 'landslide',   mm: 'မြေပြို',           en: 'Landslide',     icon: '⛰️' },
  { id: 'fog',         mm: 'မြူ/မြူထူ',         en: 'Fog',           icon: '🌫️' },
  { id: 'inle_level',  mm: 'Inle ရေမြင့်',       en: 'Inle Level',    icon: '🚣' },
  { id: 'road_block',  mm: 'လမ်းပိတ်',          en: 'Road Block',    icon: '🚧' },
  { id: 'thunderstorm',mm: 'လေပြင်းမုန်တိုင်း', en: 'Thunderstorm',  icon: '⛈️' },
  { id: 'heatwave',    mm: 'အပူလှိုင်း',        en: 'Heatwave',      icon: '🔥' },
  { id: 'coldwave',    mm: 'အအေးလှိုင်း',       en: 'Coldwave',      icon: '❄️' },
  { id: 'wind',        mm: 'လေပြင်း',           en: 'Strong Wind',   icon: '💨' },
  { id: 'hail',        mm: 'မိုးသီးကြွေ',       en: 'Hail',          icon: '🧊' },
  { id: 'earthquake',  mm: 'မြေငလျင်',         en: 'Earthquake',    icon: '🌋' },
  { id: 'drought',     mm: 'မိုးခေါင်',          en: 'Drought',       icon: '🏜️' },
  { id: 'air_quality', mm: 'လေထုညစ်ညမ်း',      en: 'Air Quality',   icon: '😷' },
]

const SEV_CFG = {
  info:    { mm: 'သတင်းပေး', en: 'Info',    color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20'   },
  warning: { mm: 'သတိပေး',  en: 'Warning', color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
  danger:  { mm: 'အန္တရာယ်', en: 'Danger',  color: 'text-red-400',    bg: 'bg-red-500/12 border-red-500/25'    },
}

export default function WeatherAlertPage() {
  const navigate = useNavigate()
  const { lang } = useLang()
  const { user, isModerator, isLoggedIn } = useAuth()
  const config = useAppConfig()
  useSEO({ title: lang === 'mm' ? 'မိုးလေဝသနှင့် ရေကြီးသတိပေးချက်' : 'Weather & Flood Alerts' })

  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setType] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'rain', severity: 'info', title_mm: '', content_mm: '', location: '', inle_level_cm: '', images: [] })
  const [imageLoading, setImageLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const set = (k, v) => setForm(f => ({...f, [k]: v}))

  async function load() {
    setLoading(true)
    try {
      let q = supabase.from('weather_alerts').select('*, reporter:profiles(full_name, nickname)').eq('status', 'active').order('severity', { ascending: false }).order('posted_at', { ascending: false }).limit(30)
      if (typeFilter !== 'all') q = q.eq('type', typeFilter)
      const { data } = await q
      setAlerts(data || [])
    } catch (e) { console.warn(e) }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('weather-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'weather_alerts' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'weather_alerts' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [typeFilter])

  async function handleImageUpload(file) {
    if (form.images.length >= 5) {
      alert(lang === 'mm' ? 'အများဆုံး ၅ ပုံသာ တင်နိုင်ပါသည်' : 'Max 5 images')
      return
    }
    setImageLoading(true)
    const url = await uploadImage(file, 'weather')
    setForm(prev => ({ ...prev, images: [...prev.images, url] }))
    setImageLoading(false)
  }

  function removeImage(idx) {
    setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }))
  }

  async function submit() {
    if (!form.title_mm) return
    setSubmitting(true)
    await supabase.from('weather_alerts').insert({
      ...form,
      inle_level_cm: form.inle_level_cm ? parseFloat(form.inle_level_cm) : null,
      images: form.images,
      reporter_id: user?.id || null,
    })
    setSubmitting(false)
    setShowForm(false)
    setForm({ type: 'rain', severity: 'info', title_mm: '', content_mm: '', location: '', inle_level_cm: '', images: [] })
    load()
  }

  async function deleteAlert(id) {
    if (!confirm(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?')) return
    await supabase.from('weather_alerts').delete().eq('id', id)
    load()
  }

  function openLightbox(images, index = 0) {
    setLightboxImages(images)
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  function timeAgo(iso) {
    const m = Math.floor((Date.now() - new Date(iso)) / 60000)
    if (m < 60) return `${m}${lang === 'mm' ? 'မိနစ်' : 'm'}`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}${lang === 'mm' ? 'နာရီ' : 'h'}`
    return `${Math.floor(h/24)}${lang === 'mm' ? 'ရက်' : 'd'}`
  }

  return (
    <div className="pb-8">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display font-bold text-lg text-white">🌧️ {lang === 'mm' ? 'မိုးလေဝသ/ရေကြီး သတိပေး' : 'Weather & Flood Alerts'}</h1>
      </div>

      <div className="px-4 pt-2 pb-3 flex items-start justify-between">
        <p className="text-xs text-white/40 font-myanmar">{lang === 'mm' ? `${config.app_city || ''} ရေမြင့် • မိုးလေဝသ သတိပေးချက်` : 'Water levels • Weather warnings'}</p>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"><Plus size={14} /> Report</button>
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <select value={typeFilter} onChange={e => setType(e.target.value)} className="select-dark">
            {ALERT_TYPES.map(t => (
              <option key={t.id} value={t.id} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                {t.icon} {lang === 'mm' ? t.mm : t.en}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      <div className="px-4 space-y-2">
        {loading ? [1,2,3].map(n => <div key={n} className="h-20 rounded-2xl shimmer" />) :
         alerts.length === 0 ? (
           <div className="flex flex-col items-center py-12 text-center">
             <span className="text-4xl mb-3">☀️</span>
             <p className="text-white/40 font-display font-semibold">{lang === 'mm' ? 'သတိပေးချက် မရှိပါ' : 'No active alerts'}</p>
             <p className="text-xs text-white/25 mt-1 font-myanmar">{lang === 'mm' ? 'ယခုဆို ကောင်းကင်သာနေသည်' : 'All clear for now'}</p>
           </div>
         ) :
         alerts.map(a => {
           const sev  = SEV_CFG[a.severity]
           const type = ALERT_TYPES.find(t => t.id === a.type)
           return (
             <div key={a.id} className={`p-4 rounded-2xl border ${sev.bg} space-y-2`}>
               <div className="flex items-start justify-between gap-2">
                 <div className="flex items-center gap-2 flex-wrap">
                   <span className="text-xl">{type?.icon}</span>
                   <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${sev.bg} ${sev.color}`}>{lang === 'mm' ? sev.mm : sev.en}</span>
                   {a.location && <span className="text-[9px] text-white/40 font-myanmar">📍 {a.location}</span>}
                 </div>
                 {isModerator && <button onClick={() => deleteAlert(a.id)} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 text-red-400"><Trash2 size={12} /></button>}
               </div>
               <h3 className="font-display font-semibold text-sm text-white">{lang === 'mm' ? (a.title_mm || a.title) : a.title}</h3>
               {a.content_mm && <p className="text-xs text-white/60 font-myanmar leading-relaxed">{a.content_mm}</p>}
               {a.inle_level_cm && (
                 <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 rounded-xl">
                   <Droplets size={14} className="text-blue-400" />
                   <span className="text-xs text-blue-300 font-myanmar">Inle Lake ရေမြင့်: <span className="font-bold font-mono">{a.inle_level_cm} cm</span></span>
                 </div>
               )}
               {a.images && a.images.length > 0 && (
                 <div className="flex gap-1 mt-2 overflow-x-auto">
                   {a.images.map((img, idx) => (
                     <img key={idx} src={img} alt="" className="w-16 h-16 object-cover rounded-lg border border-white/20 cursor-pointer hover:opacity-80" onClick={() => openLightbox(a.images, idx)} />
                   ))}
                 </div>
               )}
               <p className="text-[9px] text-white/25">{a.reporter?.nickname ? `@${a.reporter.nickname}` : 'Community'} • {timeAgo(a.posted_at)}</p>
             </div>
           )
         })}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-[#0d0015] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0">
            <button onClick={() => setShowForm(false)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
            <h2 className="font-display font-bold text-base text-white">{lang === 'mm' ? 'သတိပေးချက် အသစ်' : 'New Alert'}</h2>
            <button onClick={submit} disabled={!form.title_mm || submitting} className="btn-primary text-xs px-4 py-2">{submitting ? '...' : 'Post'}</button>
          </div>
          <div className="px-4 py-4 space-y-4 pb-24">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">အမျိုးအစား</label>
              <div className="flex gap-2 flex-wrap">
                {ALERT_TYPES.filter(t => t.id !== 'all').map(t => (
                  <button key={t.id} onClick={() => set('type', t.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border ${form.type === t.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>{t.icon} {t.mm}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">အဆင့်</label>
              <div className="flex gap-2">
                {Object.entries(SEV_CFG).map(([k, v]) => (
                  <button key={k} onClick={() => set('severity', k)} className={`flex-1 py-2 rounded-xl text-xs font-bold border ${form.severity === k ? v.bg + ' ' + v.color : 'bg-white/5 border-white/10 text-white/40'}`}>{lang === 'mm' ? v.mm : v.en}</button>
                ))}
              </div>
            </div>
            <div><label className="block text-xs text-white/50 mb-1.5">ခေါင်းစဉ် (မြန်မာ) *</label><input autoFocus value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: ဗိုလ်ချုပ်ရပ်ကွက် ရေကြီးနေ" /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">အကြောင်းအရာ</label><textarea value={form.content_mm} onChange={e => set('content_mm', e.target.value)} className="input-dark font-myanmar resize-none h-20" /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">နေရာ</label><input value={form.location} onChange={e => set('location', e.target.value)} className="input-dark font-myanmar" /></div>
            {form.type === 'inle_level' && <div><label className="block text-xs text-white/50 mb-1.5">Inle Lake ရေမြင့် (cm)</label><input type="number" value={form.inle_level_cm} onChange={e => set('inle_level_cm', e.target.value)} className="input-dark font-mono" placeholder="e.g. 245" /></div>}
            <div>
              <label className="block text-xs text-white/50 mb-1.5">ဓာတ်ပုံများ (အများဆုံး ၅ ပုံ)</label>
              <div className="flex gap-2 flex-wrap">
                {form.images.map((url, i) => (
                  <div key={i} className="relative w-16 h-16">
                    <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-white/10" />
                    <button onClick={() => removeImage(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[10px]">✕</button>
                  </div>
                ))}
                {form.images.length < 5 && <ImageUploader onUpload={handleImageUpload} loading={imageLoading} label="+" />}
              </div>
            </div>
          </div>
        </div>
      )}

      {lightboxOpen && (
        <Lightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}