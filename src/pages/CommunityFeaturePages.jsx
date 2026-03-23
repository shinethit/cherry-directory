// ── WeatherAlertPage ─────────────────────────────────────────
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { useSEO } from '../hooks/useSEO'
import { Plus, Trash2, ArrowLeft, Droplets, Eye } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// WEATHER ALERT PAGE
// ─────────────────────────────────────────────────────────────
const ALERT_TYPES = [
  { id: 'all',         mm: 'အားလုံး',          en: 'All',          icon: '🌤️' },
  { id: 'rain',        mm: 'မိုးသက်မုန်တိုင်း', en: 'Rain/Storm',   icon: '🌧️' },
  { id: 'flood',       mm: 'ရေကြီး',           en: 'Flood',        icon: '🌊' },
  { id: 'landslide',   mm: 'မြေပြိုမှု',        en: 'Landslide',    icon: '⛰️' },
  { id: 'fog',         mm: 'မြူ/တိမ်',          en: 'Fog',          icon: '🌫️' },
  { id: 'inle_level',  mm: 'Inle ရေမြင့်',      en: 'Inle Level',   icon: '🚣' },
  { id: 'road_block',  mm: 'လမ်းပိတ်',          en: 'Road Block',   icon: '🚧' },
]
const SEV_CFG = {
  info:    { mm: 'သတင်းပေး', en: 'Info',    color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20'   },
  warning: { mm: 'သတိပေး',  en: 'Warning', color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
  danger:  { mm: 'အန္တရာယ်', en: 'Danger',  color: 'text-red-400',    bg: 'bg-red-500/12 border-red-500/25'    },
}

export function WeatherAlertPage() {
  const { lang } = useLang()
  const { user, isModerator } = useAuth()
  useSEO({ title: lang === 'mm' ? 'မိုးလေဝသ' : 'Weather Alerts' })

  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setType] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'rain', severity: 'info', title_mm: '', content_mm: '', location: '', inle_level_cm: '' })
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({...f, [k]: v}))

  async function load() {
    setLoading(true)
    let q = supabase.from('weather_alerts').select('*, reporter:profiles(full_name, nickname)').eq('status', 'active').order('severity', { ascending: false }).order('posted_at', { ascending: false }).limit(30)
    if (typeFilter !== 'all') q = q.eq('type', typeFilter)
    const { data } = await q
    setAlerts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [typeFilter])

  async function submit() {
    if (!form.title_mm) return
    setSubmitting(true)
    await supabase.from('weather_alerts').insert({
      ...form,
      inle_level_cm: form.inle_level_cm ? parseFloat(form.inle_level_cm) : null,
      reporter_id: user?.id || null,
      source: user?.id ? 'community' : 'community',
    })
    setSubmitting(false)
    setShowForm(false)
    load()
  }

  async function deleteAlert(id) {
    await supabase.from('weather_alerts').delete().eq('id', id)
    load()
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
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">🌧️ {lang === 'mm' ? 'မိုးလေဝသ/ရေကြီး' : 'Weather & Flood'}</h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? 'ရေမြင့် • မိုးလေဝသ သတိပေးချက်' : 'Water levels • Weather warnings'}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"><Plus size={14} /> Report</button>
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <select value={typeFilter} onChange={e => setType(e.target.value)}
            className="select-dark">
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
               <p className="text-[9px] text-white/25">{a.reporter?.nickname ? `@${a.reporter.nickname}` : 'Community'} • {timeAgo(a.posted_at)}</p>
             </div>
           )
         })}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-[#0d0015] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0">
            <button onClick={() => setShowForm(false)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
            <h2 className="font-display font-bold text-base text-white">Report Weather/Flood</h2>
            <button onClick={submit} disabled={!form.title_mm || submitting} className="btn-primary text-xs px-4 py-2">{submitting ? '...' : 'Post'}</button>
          </div>
          <div className="px-4 py-4 space-y-4 pb-8">
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
            <div><label className="block text-xs text-white/50 mb-1.5">ခေါင်းစဉ် (မြန်မာ) *</label><input value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: ဗိုလ်ချုပ်ရပ်ကွက် ရေကြီးနေ" /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">အကြောင်းအရာ</label><textarea value={form.content_mm} onChange={e => set('content_mm', e.target.value)} className="input-dark font-myanmar resize-none h-20" /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">နေရာ</label><input value={form.location} onChange={e => set('location', e.target.value)} className="input-dark font-myanmar" /></div>
            {form.type === 'inle_level' && <div><label className="block text-xs text-white/50 mb-1.5">Inle Lake ရေမြင့် (cm)</label><input type="number" value={form.inle_level_cm} onChange={e => set('inle_level_cm', e.target.value)} className="input-dark font-mono" placeholder="e.g. 245" /></div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// DONATION PAGE
// ─────────────────────────────────────────────────────────────
const DON_CATS = [
  { id: 'all',        mm: 'အားလုံး',        en: 'All',         icon: '❤️' },
  { id: 'school',     mm: 'ကျောင်း',        en: 'School',      icon: '🏫' },
  { id: 'monastery',  mm: 'ဘုန်းကြီးကျောင်း', en: 'Monastery', icon: '⛩️' },
  { id: 'health',     mm: 'ကျန်းမာရေး',     en: 'Health',      icon: '🏥' },
  { id: 'disaster',   mm: 'သဘာဝဘေး',       en: 'Disaster',    icon: '🆘' },
  { id: 'community',  mm: 'ရပ်ကွက်',        en: 'Community',   icon: '🏘️' },
  { id: 'animal',     mm: 'တိရိစ္ဆာန်',     en: 'Animal',      icon: '🐾' },
  { id: 'other',      mm: 'အခြား',           en: 'Other',       icon: '💝' },
]

export function DonationPage() {
  const { lang } = useLang()
  const { user, profile, isLoggedIn, isModerator } = useAuth()
  useSEO({ title: lang === 'mm' ? 'လှူဒါန်းမှု' : 'Donations' })

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCat] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title_mm: '', description_mm: '', category: 'community', target_amount: '', contact_name: '', contact_phone: '', kbz_pay: '', wave_pay: '', bank_name: '', bank_account: '', bank_holder: '', is_urgent: false })
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({...f, [k]: v}))

  async function load() {
    setLoading(true)
    let q = supabase.from('donations').select('*').eq('status', 'active').order('is_urgent', { ascending: false }).order('posted_at', { ascending: false }).limit(30)
    if (catFilter !== 'all') q = q.eq('category', catFilter)
    const { data } = await q; setItems(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [catFilter])

  async function submit() {
    if (!form.title_mm || !isLoggedIn) return
    setSubmitting(true)
    await supabase.from('donations').insert({ ...form, target_amount: form.target_amount ? parseInt(form.target_amount) : null, organizer_id: user.id })
    setSubmitting(false); setShowForm(false); load()
  }

  async function deleteDonation(id) {
    if (!confirm(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?')) return
    await supabase.from('donations').delete().eq('id', id); load()
  }

  function pct(d) {
    if (!d.target_amount || !d.collected_amount) return null
    return Math.min(100, Math.round(d.collected_amount / d.target_amount * 100))
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">❤️ {lang === 'mm' ? 'လှူဒါန်းမှု' : 'Donations'}</h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? 'ကျောင်း၊ ဘုန်းကြီးကျောင်း၊ Community ငွေကြေးစုဆောင်းမှု' : 'Community fundraising campaigns'}</p>
        </div>
        {isLoggedIn && <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"><Plus size={14} /> Post</button>}
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <select value={catFilter} onChange={e => setCat(e.target.value)}
            className="select-dark">
            {DON_CATS.map(c => (
              <option key={c.id} value={c.id} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                {c.icon} {lang === 'mm' ? c.mm : c.en}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {loading ? [1,2].map(n => <div key={n} className="h-36 rounded-2xl shimmer" />) :
         items.length === 0 ? <div className="flex flex-col items-center py-12 text-center"><span className="text-4xl mb-3">❤️</span><p className="text-white/40 font-display font-semibold">{lang === 'mm' ? 'Campaign မရှိသေး' : 'No campaigns yet'}</p></div> :
         items.map(d => {
           const progress = pct(d)
           const cat = DON_CATS.find(c => c.id === d.category)
           return (
             <div key={d.id} className="card-dark rounded-2xl p-4 space-y-3">
               <div className="flex items-start justify-between gap-2">
                 <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1">
                     <span className="text-lg">{cat?.icon}</span>
                     {d.is_urgent && <span className="text-[9px] text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">⚡ Urgent</span>}
                   </div>
                   <h3 className="font-display font-semibold text-sm text-white">{lang === 'mm' ? (d.title_mm || d.title) : d.title}</h3>
                   {d.description_mm && <p className="text-xs text-white/50 mt-1 font-myanmar line-clamp-2">{d.description_mm}</p>}
                 </div>
                 {(isModerator || d.organizer_id === user?.id) && (
                   <button onClick={() => deleteDonation(d.id)} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 text-red-400 flex-shrink-0"><Trash2 size={12} /></button>
                 )}
               </div>

               {progress !== null && (
                 <div>
                   <div className="flex items-center justify-between text-xs mb-1">
                     <span className="text-white/50">{Number(d.collected_amount).toLocaleString()} / {Number(d.target_amount).toLocaleString()} Ks</span>
                     <span className="text-brand-300 font-bold">{progress}%</span>
                   </div>
                   <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                     <div className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
                   </div>
                 </div>
               )}

               <div className="flex flex-wrap gap-2 text-[10px]">
                 {d.contact_phone && <a href={`tel:${d.contact_phone}`} className="flex items-center gap-1 text-green-400 hover:text-green-300">📞 {d.contact_phone}</a>}
                 {d.kbz_pay && <div className="flex items-center gap-1 text-white/50 font-myanmar">KBZPay: <span className="font-mono text-white/70">{d.kbz_pay}</span></div>}
                 {d.wave_pay && <div className="flex items-center gap-1 text-white/50 font-myanmar">WavePay: <span className="font-mono text-white/70">{d.wave_pay}</span></div>}
                 {d.bank_account && <div className="text-white/40 font-myanmar">{d.bank_name}: {d.bank_account} ({d.bank_holder})</div>}
               </div>
             </div>
           )
         })}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-[#0d0015] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0">
            <button onClick={() => setShowForm(false)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
            <h2 className="font-display font-bold text-base text-white">{lang === 'mm' ? 'Campaign တင်မည်' : 'Create Campaign'}</h2>
            <button onClick={submit} disabled={!form.title_mm || submitting} className="btn-primary text-xs px-4 py-2">{submitting ? '...' : 'Post'}</button>
          </div>
          <div className="px-4 py-4 space-y-4 pb-8">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">အမျိုးအစား</label>
              <div className="flex gap-2 flex-wrap">
                {DON_CATS.filter(c => c.id !== 'all').map(c => (
                  <button key={c.id} onClick={() => set('category', c.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border ${form.category === c.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>{c.icon} {lang === 'mm' ? c.mm : c.en}</button>
                ))}
              </div>
            </div>
            <div><label className="block text-xs text-white/50 mb-1.5">ခေါင်းစဉ် (မြန်မာ) *</label><input value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">ဖော်ပြချက်</label><textarea value={form.description_mm} onChange={e => set('description_mm', e.target.value)} className="input-dark font-myanmar resize-none h-24" /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">ပန်းတိုင် ငွေပမာဏ (Ks)</label><input type="number" value={form.target_amount} onChange={e => set('target_amount', e.target.value)} className="input-dark font-mono" placeholder="e.g. 5000000" /></div>
            <div className="border-t border-white/8 pt-3">
              <p className="text-xs text-white/40 mb-2 font-display font-semibold uppercase tracking-wider">ငွေလွှဲ အချက်အလက်</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-[10px] text-white/40 mb-1">ဆက်သွယ်ရမည့်သူ</label><input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className="input-dark font-myanmar text-sm" /></div>
                  <div><label className="block text-[10px] text-white/40 mb-1">ဖုန်း</label><input type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className="input-dark text-sm" placeholder="09..." /></div>
                </div>
                <div><label className="block text-[10px] text-white/40 mb-1">KBZPay</label><input value={form.kbz_pay} onChange={e => set('kbz_pay', e.target.value)} className="input-dark font-mono text-sm" placeholder="09..." /></div>
                <div><label className="block text-[10px] text-white/40 mb-1">WavePay</label><input value={form.wave_pay} onChange={e => set('wave_pay', e.target.value)} className="input-dark font-mono text-sm" placeholder="09..." /></div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1"><label className="block text-[10px] text-white/40 mb-1">ဘဏ်</label><input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className="input-dark text-sm" placeholder="KBZ" /></div>
                  <div className="col-span-1"><label className="block text-[10px] text-white/40 mb-1">Account No</label><input value={form.bank_account} onChange={e => set('bank_account', e.target.value)} className="input-dark font-mono text-sm" /></div>
                  <div className="col-span-1"><label className="block text-[10px] text-white/40 mb-1">နာမည်</label><input value={form.bank_holder} onChange={e => set('bank_holder', e.target.value)} className="input-dark font-myanmar text-sm" /></div>
                </div>
              </div>
            </div>
            <button onClick={() => set('is_urgent', !form.is_urgent)} className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${form.is_urgent ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-white/50'}`}>
              ⚡ {lang === 'mm' ? 'Urgent — အမြန်လိုအပ်' : 'Mark as Urgent'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// HEALTH SERVICE PAGE (Free Clinic + Blood Donation)
// ─────────────────────────────────────────────────────────────
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

export function HealthServicePage() {
  const { lang } = useLang()
  const { user, isModerator } = useAuth()
  useSEO({ title: lang === 'mm' ? 'ကျန်းမာရေးဝန်ဆောင်မှု' : 'Health Services' })

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setType] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    type: 'free_clinic', title: '', title_mm: '', description_mm: '', organizer_mm: '',
    location_mm: '', contact_phone: '', contact_name: '', facebook: '',
    start_date: '', end_date: '', start_time: '', end_time: '',
    blood_types_needed: [], is_urgent: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({...f, [k]: v}))
  function toggleBloodType(bt) {
    setForm(f => ({...f, blood_types_needed: f.blood_types_needed.includes(bt) ? f.blood_types_needed.filter(b => b !== bt) : [...f.blood_types_needed, bt]}))
  }

  async function load() {
    setLoading(true)
    let q = supabase.from('health_services').select('*').eq('status', 'active').order('is_urgent', { ascending: false }).order('start_date', { ascending: true }).limit(30)
    if (typeFilter !== 'all') q = q.eq('type', typeFilter)
    const { data } = await q; setItems(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [typeFilter])

  async function submit() {
    if (!form.title_mm) return
    setSubmitting(true)
    await supabase.from('health_services').insert({ ...form, reporter_id: user?.id || null })
    setSubmitting(false); setShowForm(false); load()
  }

  async function deleteItem(id) {
    await supabase.from('health_services').delete().eq('id', id); load()
  }

  function formatDate(d) {
    if (!d) return ''
    return new Date(d).toLocaleDateString(lang === 'mm' ? 'my-MM' : 'en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">🏥 {lang === 'mm' ? 'ကျန်းမာရေးဝန်ဆောင်မှု' : 'Health Services'}</h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? 'အခမဲ့ဆေးခန်း • သွေးလှူ • ဆေးထိုး' : 'Free clinic • Blood drives • Vaccination'}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"><Plus size={14} /> Post</button>
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <select value={typeFilter} onChange={e => setType(e.target.value)}
            className="select-dark">
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
         items.map(item => {
           const ht = HEALTH_TYPES.find(t => t.id === item.type)
           return (
             <div key={item.id} className={`card-dark rounded-2xl p-4 space-y-2 border-l-4 ${item.type === 'blood_drive' ? 'border-l-red-500/60' : item.type === 'free_clinic' ? 'border-l-green-500/60' : 'border-l-brand-500/40'}`}>
               <div className="flex items-start justify-between gap-2">
                 <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1 flex-wrap">
                     <span className="text-base">{ht?.icon}</span>
                     <span className="text-[9px] font-bold text-brand-300 bg-brand-600/15 border border-brand-400/20 px-1.5 py-0.5 rounded-full">{lang === 'mm' ? ht?.mm : ht?.en}</span>
                     {item.is_urgent && <span className="text-[9px] text-red-400 font-bold">⚡ Urgent</span>}
                     {item.is_verified && <span className="text-[9px] text-gold-400">✓ Verified</span>}
                   </div>
                   <h3 className="font-display font-semibold text-sm text-white">{lang === 'mm' ? (item.title_mm || item.title) : item.title}</h3>
                   {item.organizer_mm && <p className="text-[10px] text-brand-300 font-myanmar">{item.organizer_mm}</p>}
                 </div>
                 {isModerator && <button onClick={() => deleteItem(item.id)} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 text-red-400 flex-shrink-0"><Trash2 size={12} /></button>}
               </div>

               {item.description_mm && <p className="text-xs text-white/50 font-myanmar leading-relaxed">{item.description_mm}</p>}

               {/* Blood types */}
               {item.blood_types_needed?.length > 0 && (
                 <div className="flex gap-1.5 flex-wrap">
                   <span className="text-[9px] text-red-400/70 font-myanmar">🩸 လိုအပ်သော သွေးအုပ်စု:</span>
                   {item.blood_types_needed.map(bt => (
                     <span key={bt} className="text-[9px] font-bold text-red-300 bg-red-500/15 border border-red-500/20 px-1.5 py-0.5 rounded-full">{bt}</span>
                   ))}
                 </div>
               )}

               <div className="flex items-center gap-3 flex-wrap text-[10px] text-white/40">
                 {item.location_mm && <span className="font-myanmar">📍 {item.location_mm}</span>}
                 {item.start_date && <span>📅 {formatDate(item.start_date)}{item.end_date && item.end_date !== item.start_date ? ` – ${formatDate(item.end_date)}` : ''}</span>}
                 {item.start_time && <span>🕐 {item.start_time}{item.end_time ? `–${item.end_time}` : ''}</span>}
               </div>

               <div className="flex gap-2">
                 {item.contact_phone && <a href={`tel:${item.contact_phone}`} className="text-[10px] text-green-400 flex items-center gap-1">📞 {item.contact_phone}</a>}
                 {item.facebook && <a href={item.facebook} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400">FB Page →</a>}
               </div>
             </div>
           )
         })}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-[#0d0015] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0">
            <button onClick={() => setShowForm(false)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
            <h2 className="font-display font-bold text-base text-white">{lang === 'mm' ? 'ဝန်ဆောင်မှု တင်မည်' : 'Post Health Service'}</h2>
            <button onClick={submit} disabled={!form.title_mm || submitting} className="btn-primary text-xs px-4 py-2">{submitting ? '...' : lang === 'mm' ? 'တင်မည်' : 'Post'}</button>
          </div>
          <div className="px-4 py-4 space-y-4 pb-8">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">အမျိုးအစား</label>
              <div className="flex gap-2 flex-wrap">
                {HEALTH_TYPES.filter(t => t.id !== 'all').map(t => (
                  <button key={t.id} onClick={() => set('type', t.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border ${form.type === t.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>{t.icon} {t.mm}</button>
                ))}
              </div>
            </div>
            <div><label className="block text-xs text-white/50 mb-1.5">ခေါင်းစဉ် (မြန်မာ) *</label><input value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" placeholder={form.type === 'blood_drive' ? 'ဥပမာ: သွေးလှူဒါန်းပွဲ — မြေနီတောင်ဆေးရုံ' : 'ဥပမာ: အခမဲ့ဆေးခန်း — ဆရာဝန် ၅ ဦး'} /></div>
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
            <button onClick={() => set('is_urgent', !form.is_urgent)} className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${form.is_urgent ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-white/50'}`}>
              ⚡ {lang === 'mm' ? 'Urgent — သွေးလိုအပ်/အခြေအနေ ဆိုးရွားနေ' : 'Mark as Urgent'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// BUS SCHEDULE PAGE
// ─────────────────────────────────────────────────────────────
const BUS_ROUTES_DEF = [
  { id: 'all', mm: 'အားလုံး', en: 'All', icon: '🚌' },
  { id: 'local', mm: 'မြို့တွင်း', en: 'Local', icon: '🏙️' },
  { id: 'long_distance', mm: 'အဝေး', en: 'Long Distance', icon: '🛣️' },
]

export function BusSchedulePage() {
  const { lang } = useLang()
  const { user, isModerator } = useAuth()
  useSEO({ title: lang === 'mm' ? 'ကားထွက်ချိန်' : 'Bus Schedule' })

  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setType] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ route_mm: '', departure_time: '', arrival_time: '', price: '', contact_phone: '', notes_mm: '', type: 'long_distance' })
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({...f, [k]: v}))

  async function load() {
    setLoading(true)
    let q = supabase.from('bus_departures').select('*').order('departure_time', { ascending: true })
    if (typeFilter !== 'all') q = q.eq('type', typeFilter)
    const { data } = await q
    setSchedules(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [typeFilter])

  async function submit() {
    if (!form.route_mm || !form.departure_time) return
    setSubmitting(true)
    await supabase.from('bus_departures').insert({ ...form, price: form.price ? parseInt(form.price) : null, reporter_id: user?.id || null })
    setSubmitting(false); setShowForm(false); load()
  }

  async function deleteSchedule(id) {
    await supabase.from('bus_departures').delete().eq('id', id); load()
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">🚌 {lang === 'mm' ? 'ကားထွက်ချိန်' : 'Bus Schedule'}</h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? 'ကားထွက်ချိန် Community Report' : 'Community reported bus schedules'}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"><Plus size={14} /> {lang === 'mm' ? 'ထည့်မည်' : 'Add'}</button>
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <select value={typeFilter} onChange={e => setType(e.target.value)} className="select-dark">
            {BUS_ROUTES_DEF.map(t => (
              <option key={t.id} value={t.id} style={{ backgroundColor: '#1a0030' }}>{t.icon} {lang === 'mm' ? t.mm : t.en}</option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      <div className="px-4 space-y-2">
        {loading ? [1,2,3].map(n => <div key={n} className="h-20 rounded-2xl shimmer" />) :
         schedules.length === 0 ? (
           <div className="flex flex-col items-center py-12 text-center">
             <span className="text-4xl mb-3">🚌</span>
             <p className="text-white/40 font-display font-semibold">{lang === 'mm' ? 'ကားထွက်ချိန် မရှိသေး' : 'No schedules yet'}</p>
             <p className="text-xs text-white/25 mt-1 font-myanmar">{lang === 'mm' ? 'ပထမဆုံး ထည့်သွင်းပေးပါ' : 'Be the first to add one'}</p>
           </div>
         ) :
         schedules.map(s => (
           <div key={s.id} className="card-dark rounded-2xl p-4">
             <div className="flex items-start justify-between gap-2">
               <div className="flex-1">
                 <p className="font-display font-semibold text-sm text-white font-myanmar">{s.route_mm}</p>
                 <div className="flex items-center gap-3 mt-1 flex-wrap">
                   {s.departure_time && <span className="text-xs text-brand-300">🕐 {s.departure_time}</span>}
                   {s.arrival_time && <span className="text-xs text-white/50">→ {s.arrival_time}</span>}
                   {s.price && <span className="text-xs text-gold-400 font-mono">{Number(s.price).toLocaleString()} Ks</span>}
                 </div>
                 {s.notes_mm && <p className="text-xs text-white/40 mt-1 font-myanmar">{s.notes_mm}</p>}
                 {s.contact_phone && <a href={`tel:${s.contact_phone}`} className="text-xs text-green-400 mt-1 block">📞 {s.contact_phone}</a>}
               </div>
               {isModerator && <button onClick={() => deleteSchedule(s.id)} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400"><Trash2 size={12} /></button>}
             </div>
           </div>
         ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-[#0d0015] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0">
            <button onClick={() => setShowForm(false)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
            <h2 className="font-display font-bold text-base text-white">{lang === 'mm' ? 'ကားထွက်ချိန် ထည့်မည်' : 'Add Bus Schedule'}</h2>
            <button onClick={submit} disabled={!form.route_mm || !form.departure_time || submitting} className="btn-primary text-xs px-4 py-2">{submitting ? '...' : lang === 'mm' ? 'သိမ်းမည်' : 'Save'}</button>
          </div>
          <div className="px-4 py-4 space-y-4 pb-8">
            <div><label className="block text-xs text-white/50 mb-1.5">လမ်းကြောင်း (မြန်မာ) *</label><input value={form.route_mm} onChange={e => set('route_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: တောင်ကြီး → ရန်ကုန်" /></div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">အမျိုးအစား</label>
              <div className="flex gap-2">
                {BUS_ROUTES_DEF.filter(t => t.id !== 'all').map(t => (
                  <button key={t.id} onClick={() => set('type', t.id)} className={`flex-1 py-2 rounded-xl text-xs font-bold border ${form.type === t.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>{t.icon} {lang === 'mm' ? t.mm : t.en}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] text-white/40 mb-1">ထွက်ချိန် *</label><input type="time" value={form.departure_time} onChange={e => set('departure_time', e.target.value)} className="input-dark" /></div>
              <div><label className="block text-[10px] text-white/40 mb-1">ရောက်ချိန်</label><input type="time" value={form.arrival_time} onChange={e => set('arrival_time', e.target.value)} className="input-dark" /></div>
            </div>
            <div><label className="block text-xs text-white/50 mb-1.5">ဈေးနှုန်း (Ks)</label><input type="number" value={form.price} onChange={e => set('price', e.target.value)} className="input-dark font-mono" placeholder="e.g. 15000" /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">ဆက်သွယ်ရန် ဖုန်း</label><input type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className="input-dark" placeholder="09..." /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">မှတ်ချက်</label><input value={form.notes_mm} onChange={e => set('notes_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: နေ့တိုင်း မနက် ၆နာရီ" /></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TOURS PAGE
// ─────────────────────────────────────────────────────────────
const TOUR_TYPES = [
  { id: 'all',      mm: 'အားလုံး',      en: 'All',        icon: '🏔️' },
  { id: 'trekking', mm: 'Trekking',     en: 'Trekking',   icon: '🥾' },
  { id: 'boat',     mm: 'လှေ/ရေ',       en: 'Boat Tour',  icon: '⛵' },
  { id: 'cultural', mm: 'ယဉ်ကျေးမှု',   en: 'Cultural',   icon: '🏛️' },
  { id: 'day_trip', mm: 'Day Trip',     en: 'Day Trip',   icon: '🌄' },
  { id: 'other',    mm: 'အခြား',        en: 'Other',      icon: '📍' },
]

export function ToursPage() {
  const { lang } = useLang()
  const { user, isModerator } = useAuth()
  useSEO({ title: lang === 'mm' ? 'Tour Guide' : 'Tour Guide' })

  const [tours, setTours] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setType] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title_mm: '', description_mm: '', type: 'trekking', price_from: '', price_to: '', duration_mm: '', contact_name: '', contact_phone: '', facebook: '', languages: '' })
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({...f, [k]: v}))

  async function load() {
    setLoading(true)
    let q = supabase.from('tour_guides').select('*').eq('is_active', true).order('created_at', { ascending: false })
    if (typeFilter !== 'all') q = q.eq('type', typeFilter)
    const { data } = await q
    setTours(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [typeFilter])

  async function submit() {
    if (!form.title_mm) return
    setSubmitting(true)
    await supabase.from('tour_guides').insert({ ...form, price_from: form.price_from ? parseInt(form.price_from) : null, price_to: form.price_to ? parseInt(form.price_to) : null, reporter_id: user?.id || null })
    setSubmitting(false); setShowForm(false); load()
  }

  async function deleteTour(id) {
    await supabase.from('tour_guides').delete().eq('id', id); load()
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">🏔️ {lang === 'mm' ? 'Tour Guide / Trekking' : 'Tour Guide / Trekking'}</h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? 'Trekking / Boat Trip Guide တွေ' : 'Local trekking & boat tour guides'}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"><Plus size={14} /> {lang === 'mm' ? 'ထည့်မည်' : 'Add'}</button>
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <select value={typeFilter} onChange={e => setType(e.target.value)} className="select-dark">
            {TOUR_TYPES.map(t => (
              <option key={t.id} value={t.id} style={{ backgroundColor: '#1a0030' }}>{t.icon} {lang === 'mm' ? t.mm : t.en}</option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {loading ? [1,2,3].map(n => <div key={n} className="h-28 rounded-2xl shimmer" />) :
         tours.length === 0 ? (
           <div className="flex flex-col items-center py-12 text-center">
             <span className="text-4xl mb-3">🏔️</span>
             <p className="text-white/40 font-display font-semibold">{lang === 'mm' ? 'Tour Guide မရှိသေး' : 'No guides yet'}</p>
           </div>
         ) :
         tours.map(t => {
           const tt = TOUR_TYPES.find(x => x.id === t.type)
           return (
             <div key={t.id} className="card-dark rounded-2xl p-4 space-y-2">
               <div className="flex items-start justify-between gap-2">
                 <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1">
                     <span>{tt?.icon}</span>
                     <span className="text-[9px] text-brand-300 bg-brand-600/15 border border-brand-400/20 px-1.5 py-0.5 rounded-full font-bold">{lang === 'mm' ? tt?.mm : tt?.en}</span>
                   </div>
                   <h3 className="font-display font-semibold text-sm text-white font-myanmar">{t.title_mm}</h3>
                   {t.description_mm && <p className="text-xs text-white/50 mt-1 font-myanmar line-clamp-2">{t.description_mm}</p>}
                   <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[10px]">
                     {(t.price_from || t.price_to) && <span className="text-gold-400 font-mono">{t.price_from ? Number(t.price_from).toLocaleString() : '?'}{t.price_to ? ` – ${Number(t.price_to).toLocaleString()}` : '+'} Ks</span>}
                     {t.duration_mm && <span className="text-white/40 font-myanmar">⏱ {t.duration_mm}</span>}
                     {t.languages && <span className="text-white/40">🌐 {t.languages}</span>}
                   </div>
                 </div>
                 {isModerator && <button onClick={() => deleteTour(t.id)} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 flex-shrink-0"><Trash2 size={12} /></button>}
               </div>
               <div className="flex gap-3">
                 {t.contact_phone && <a href={`tel:${t.contact_phone}`} className="text-xs text-green-400">📞 {t.contact_phone}</a>}
                 {t.facebook && <a href={t.facebook} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400">FB →</a>}
               </div>
             </div>
           )
         })}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-[#0d0015] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0">
            <button onClick={() => setShowForm(false)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
            <h2 className="font-display font-bold text-base text-white">{lang === 'mm' ? 'Tour Guide ထည့်မည်' : 'Add Tour Guide'}</h2>
            <button onClick={submit} disabled={!form.title_mm || submitting} className="btn-primary text-xs px-4 py-2">{submitting ? '...' : lang === 'mm' ? 'သိမ်းမည်' : 'Save'}</button>
          </div>
          <div className="px-4 py-4 space-y-4 pb-8">
            <div><label className="block text-xs text-white/50 mb-1.5">ခေါင်းစဉ် *</label><input value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: Kalaw Trekking 3 Days 2 Nights" /></div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">အမျိုးအစား</label>
              <div className="flex gap-2 flex-wrap">
                {TOUR_TYPES.filter(t => t.id !== 'all').map(t => (
                  <button key={t.id} onClick={() => set('type', t.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border ${form.type === t.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>{t.icon} {lang === 'mm' ? t.mm : t.en}</button>
                ))}
              </div>
            </div>
            <div><label className="block text-xs text-white/50 mb-1.5">ဖော်ပြချက်</label><textarea value={form.description_mm} onChange={e => set('description_mm', e.target.value)} className="input-dark font-myanmar resize-none h-20" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] text-white/40 mb-1">ဈေး စတင် (Ks)</label><input type="number" value={form.price_from} onChange={e => set('price_from', e.target.value)} className="input-dark font-mono" /></div>
              <div><label className="block text-[10px] text-white/40 mb-1">ဈေး အများဆုံး (Ks)</label><input type="number" value={form.price_to} onChange={e => set('price_to', e.target.value)} className="input-dark font-mono" /></div>
            </div>
            <div><label className="block text-xs text-white/50 mb-1.5">ကြာချိန်</label><input value={form.duration_mm} onChange={e => set('duration_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: ၃ ရက် ၂ ညနေ" /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">ဘာသာစကား</label><input value={form.languages} onChange={e => set('languages', e.target.value)} className="input-dark" placeholder="Myanmar, English" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] text-white/40 mb-1">Guide အမည်</label><input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className="input-dark font-myanmar text-sm" /></div>
              <div><label className="block text-[10px] text-white/40 mb-1">ဖုန်း</label><input type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className="input-dark text-sm" placeholder="09..." /></div>
            </div>
            <div><label className="block text-xs text-white/50 mb-1.5">Facebook</label><input value={form.facebook} onChange={e => set('facebook', e.target.value)} className="input-dark" placeholder="https://facebook.com/..." /></div>
          </div>
        </div>
      )}
    </div>
  )
}
