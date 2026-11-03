import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'   // ✅ Added
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { useAppConfig } from '../contexts/AppConfigContext'
import { useSEO } from '../hooks/useSEO'
import { Plus, Trash2, ArrowLeft, Clock, Edit2, Copy, Check } from 'lucide-react'
import { ImageUploader } from '../components/UI'
import { uploadImage } from '../lib/cloudinary'
import { confirmDialog } from '../lib/confirmDialog'
import { showError } from '../lib/toast'
import { yangonToday, mmtParts, formatMyanmarDate } from '../lib/myanmarDate'
import ShareButton from '../components/ShareButton'

// Short date in Myanmar time ("Jan 5, 2026" / "ဇန်နဝါရီ 5 ရက်၊ 2026") —
// never new Date(iso).toLocaleDateString(), which shifts on non-MMT
// devices for stored +06:30 datetimes.
const EN_MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDateShort(iso, lang) {
  const p = mmtParts(iso)
  if (!p) return ''
  return lang === 'mm'
    ? formatMyanmarDate(iso, { year: true })
    : `${EN_MONTHS_S[p.m - 1]} ${p.d}, ${p.y}`
}

// ─────────────────────────────────────────────────────────────
// WEATHER ALERT PAGE (unchanged, same as before)
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

// ─────────────────────────────────────────────────────────────
// WEATHER ALERT PAGE — moved to /src/pages/WeatherAlertPage.jsx
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// DONATION PAGE (unchanged)
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

function CopyButton({ value, label, lang }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy(e) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/6 hover:bg-white/10 border border-white/10 transition-colors"
      title={copied ? (lang === 'mm' ? 'ကူးပြီး' : 'Copied') : (lang === 'mm' ? 'ကူးမည်' : 'Copy')}
    >
      {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} className="text-white/50" />}
      <span className="text-[9px] text-white/60 font-mono">{value}</span>
    </button>
  )
}

function daysLeft(deadline, lang) {
  if (!deadline) return null
  const diff = new Date(deadline).getTime() - Date.now()
  const days = Math.ceil(diff / 86400000)
  if (days < 0) return { text: lang === 'mm' ? 'ကုန်ဆုံးပြီ' : 'Ended', urgent: true }
  if (days === 0) return { text: lang === 'mm' ? 'ယနေ့ ကုန်ဆုံးမည်' : 'Ends today', urgent: true }
  if (days <= 7) return { text: lang === 'mm' ? `${days} ရက် ကျန်` : `${days} days left`, urgent: true }
  return { text: lang === 'mm' ? `${days} ရက် ကျန်` : `${days} days left`, urgent: false }
}

export function DonationPage() {
  const { lang } = useLang()
  const { user, profile, isLoggedIn, isModerator } = useAuth()
  const config = useAppConfig()
  useSEO({ title: lang === 'mm' ? 'လှူဒါန်းမှု' : 'Donations' })

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [catFilter, setCat] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title_mm: '', description_mm: '', category: 'community', target_amount: '', deadline: '', contact_name: '', contact_phone: '', kbz_pay: '', wave_pay: '', bank_name: '', bank_account: '', bank_holder: '', images: [], is_urgent: false })
  const [imgLoading, setImgLoading] = useState(false)

  async function handleImageUpload(file) {
    setImgLoading(true)
    try {
      const url = await uploadImage(file, 'donations')
      setForm(f => ({ ...f, images: [...f.images, url] }))
    } catch (e) {
      showError(e.message || (lang === 'mm' ? 'ပုံတင်ရာတွင် အမှားရှိသည်' : 'Image upload failed'))
    }
    setImgLoading(false)
  }
  const [submitting, setSubmitting] = useState(false)
  const set = async (k, v) => setForm(f => ({...f, [k]: v}))

  async function load() {
    setLoading(true)
    setLoadError(false)
    try {
      let q = supabase.from('donations').select('*').eq('status', 'active').order('is_urgent', { ascending: false }).order('posted_at', { ascending: false }).limit(30)
      if (catFilter !== 'all') q = q.eq('category', catFilter)
      const { data, error } = await q
      if (error) throw error
      setItems(data || [])
    } catch (e) { console.warn(e); setLoadError(true) }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('donations-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'donations' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'donations' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [catFilter])

  async function submit() {
    if (!isLoggedIn) { showError(lang === 'mm' ? 'Campaign တင်ရန် Login ဝင်ပါ' : 'Login to post a campaign'); return }
    if (!form.title_mm) { showError(lang === 'mm' ? 'ခေါင်းစဉ် ထည့်ပါ' : 'Title is required'); return }
    // A campaign with no way to donate through is useless — require at
    // least one contact/payment method.
    if (!form.contact_phone && !form.kbz_pay && !form.wave_pay && !form.bank_account) {
      showError(lang === 'mm' ? 'ဖုန်း (သို့) KBZPay / WavePay / ဘဏ်အကောင့် တစ်ခုခု ထည့်ပါ — လှူမည့်သူ ဆက်သွယ်နိုင်ရန်' : 'Add a phone, KBZPay, WavePay or bank account so donors can reach you')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('donations').insert({
        category: form.category,
        // `title` is NOT NULL in the schema; the form only collects title_mm.
        title: form.title_mm,
        title_mm: form.title_mm,
        description_mm: form.description_mm || null,
        target_amount: form.target_amount ? parseInt(form.target_amount) : null,
        deadline: form.deadline || null,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        kbz_pay: form.kbz_pay || null,
        wave_pay: form.wave_pay || null,
        bank_name: form.bank_name || null,
        bank_account: form.bank_account || null,
        bank_holder: form.bank_holder || null,
        images: form.images || [],
        is_urgent: form.is_urgent,
        organizer_id: user.id,
      })
      if (error) throw error
      setShowForm(false)
      load()
    } catch (err) {
      showError(err.message || (lang === 'mm' ? 'တင်ရာတွင် အမှားရှိသည်' : 'Failed to post campaign'))
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteDonation(id) {
    if (!(await confirmDialog(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?'))) return
    const { error } = await supabase.from('donations').delete().eq('id', id)
    if (error) { showError(error.message); return }
    load()
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">❤️ {lang === 'mm' ? 'လှူဒါန်းမှု' : 'Donations'}</h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? `${config.app_city || ''} ကျောင်း၊ ဘုန်းကြီးကျောင်း၊ Community ငွေကြေးစုဆောင်းမှု` : 'Community fundraising campaigns'}</p>
        </div>
        {isLoggedIn && <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"><Plus size={14} /> Post</button>}
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <select value={catFilter} onChange={e => setCat(e.target.value)} className="select-dark">
            {DON_CATS.map(c => (
              <option key={c.id} value={c.id} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                {c.icon} {lang === 'mm' ? c.mm : c.en}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      <div className="px-4 space-y-3 pb-24">
        {loading ? [1,2].map(n => <div key={n} className="h-36 rounded-2xl shimmer" />) :
         loadError ? <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30"><p className="text-sm text-red-400 font-myanmar">Data တင်ရာတွင် အမှားဖြစ်သွားသည်</p><button onClick={load} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button></div> :
         items.length === 0 ? <div className="flex flex-col items-center py-12 text-center"><span className="text-4xl mb-3">❤️</span><p className="text-white/40 font-display font-semibold">{lang === 'mm' ? 'Campaign မရှိသေး' : 'No campaigns yet'}</p></div> :
         items.map(d => {
           const cat = DON_CATS.find(c => c.id === d.category)
           return (
             <div key={d.id} className="card-dark rounded-2xl p-4 space-y-3">
               <div className="flex items-start justify-between gap-2">
                 <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1">
                     <span className="text-lg">{cat?.icon}</span>
                     {d.is_urgent && <span className="text-[9px] text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">⚡ Urgent</span>}
                   </div>
                   <h3 className="font-display font-semibold text-sm text-white">{lang === 'mm' ? (d.title_mm || d.title) : (d.title || d.title_mm)}</h3>
                   {d.description_mm && <p className="text-xs text-white/50 mt-1 font-myanmar line-clamp-2">{d.description_mm}</p>}
                 </div>
                 {/* Only moderators can delete: the only delete policy is
                     "Admin deletes donations" (admin/mod) — an organizer
                     shown the button would always be refused by RLS. */}
                 {isModerator && (
                   <button onClick={() => deleteDonation(d.id)} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 text-red-400 flex-shrink-0"><Trash2 size={12} /></button>
                 )}
               </div>

               {/* Goal amount only — nothing ever writes
                   collected_amount, so it is not rendered (no donation
                   flow in this version). */}
               {d.target_amount && (
                 <div className="flex items-center gap-3 text-xs flex-wrap">
                   <span className="text-white/50">{lang === 'mm' ? 'ပန်းတိုင်' : 'Goal'}: <span className="text-white font-bold font-mono">{Number(d.target_amount).toLocaleString()} Ks</span></span>
                 </div>
               )}

               {/* Images gallery */}
               {d.images?.length > 0 && (
                 <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                   {d.images.slice(0, 4).map((img, i) => (
                     <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                       <img src={img} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" loading="lazy" />
                     </a>
                   ))}
                   {d.images.length > 4 && (
                     <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-[10px] text-white/50 font-bold">
                       +{d.images.length - 4}
                     </div>
                   )}
                 </div>
               )}

               {/* Deadline + Verified badges */}
               {(d.deadline || d.is_verified) && (
                 <div className="flex items-center gap-2 flex-wrap">
                   {d.deadline && (() => {
                     const dl = daysLeft(d.deadline, lang)
                     if (!dl) return null
                     return (
                       <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${dl.urgent ? 'bg-red-500/15 border-red-500/25 text-red-400' : 'bg-white/8 border-white/15 text-white/60'}`}>
                         <Clock size={9} /> {dl.text}
                       </span>
                     )
                   })()}
                   {d.is_verified && (
                     <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-green-500/15 border-green-500/25 text-green-400 flex items-center gap-1">
                       <Check size={9} /> {lang === 'mm' ? 'အတည်ပြုပြီး' : 'Verified'}
                     </span>
                   )}
                 </div>
               )}

               {/* Contact + payment with copy buttons */}
               <div className="flex flex-wrap gap-1.5">
                 {d.contact_phone && (
                   <a href={`tel:${d.contact_phone}`} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/25 text-green-400 hover:bg-green-500/20">
                     📞 {d.contact_phone}
                   </a>
                 )}
                 {d.kbz_pay && <CopyButton value={d.kbz_pay} label="KBZPay" lang={lang} />}
                 {d.wave_pay && <CopyButton value={d.wave_pay} label="WavePay" lang={lang} />}
                 {d.bank_account && <CopyButton value={d.bank_account} label={d.bank_name || 'Bank'} lang={lang} />}
               </div>

               {/* Share */}
               <div className="flex justify-end pt-1 border-t border-white/6">
                 <ShareButton
                   url={window.location.origin + '/donations'}
                   title={d.title_mm || d.title}
                   description={d.description_mm || ''}
                 />
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
          <div className="px-4 py-4 space-y-4 pb-24">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">အမျိုးအစား</label>
              <div className="flex gap-2 flex-wrap">
                {DON_CATS.filter(c => c.id !== 'all').map(c => (
                  <button key={c.id} onClick={() => set('category', c.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border ${form.category === c.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>{c.icon} {lang === 'mm' ? c.mm : c.en}</button>
                ))}
              </div>
            </div>
            <div><label className="block text-xs text-white/50 mb-1.5">ခေါင်းစဉ် (မြန်မာ) *</label><input autoFocus value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">ဖော်ပြချက်</label><textarea value={form.description_mm} onChange={e => set('description_mm', e.target.value)} className="input-dark font-myanmar resize-none h-24" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">ပန်းတိုင် ငွေပမာဏ (Ks)</label>
                <input type="number" value={form.target_amount} onChange={e => set('target_amount', e.target.value)} className="input-dark font-mono" placeholder="5000000" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ကုန်ဆုံးမည့်ရက်' : 'Deadline'}</label>
                <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} className="input-dark" />
              </div>
            </div>

            {/* Images */}
            <div>
              <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဓာတ်ပုံများ (optional)' : 'Photos (optional)'}</label>
              <div className="flex gap-2 flex-wrap">
                {form.images.map((url, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-white/10" />
                    <button
                      type="button"
                      onClick={() => set('images', form.images.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center"
                    >✕</button>
                  </div>
                ))}
                {form.images.length < 5 && (
                  <ImageUploader onUpload={handleImageUpload} loading={imgLoading} label="+" />
                )}
              </div>
              <p className="text-[9px] text-white/25 mt-1.5">{lang === 'mm' ? 'အများဆုံး ၅ ပုံ' : 'Max 5 photos'}</p>
            </div>
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
// HEALTH SERVICE PAGE (with edit functionality)
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

function HealthCard({ service, lang, isModerator, userId, onEdit, onDelete }) {
  const isOwner = service.poster_id === userId

  return (
    <div className={`card-dark rounded-2xl p-4 space-y-2 border-l-4 ${service.type === 'blood_drive' ? 'border-l-red-500/60' : service.type === 'free_clinic' ? 'border-l-green-500/60' : 'border-l-brand-500/40'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-base">{HEALTH_TYPES.find(t => t.id === service.type)?.icon}</span>
            <span className="text-[9px] font-bold text-brand-300 bg-brand-600/15 border border-brand-400/20 px-1.5 py-0.5 rounded-full">
              {lang === 'mm' ? HEALTH_TYPES.find(t => t.id === service.type)?.mm : HEALTH_TYPES.find(t => t.id === service.type)?.en}
            </span>
            {service.is_urgent && <span className="text-[9px] text-red-400 font-bold">⚡ Urgent</span>}
            {service.is_verified && <span className="text-[9px] text-gold-400">✓ Verified</span>}
          </div>
          <h3 className="font-display font-semibold text-sm text-white">{lang === 'mm' ? (service.title_mm || service.title) : (service.title || service.title_mm)}</h3>
          {service.organizer_mm && <p className="text-[10px] text-brand-300 font-myanmar">{service.organizer_mm}</p>}
          {service.description_mm && <p className="text-xs text-white/50 mt-1 font-myanmar line-clamp-2">{service.description_mm}</p>}
        </div>
        {/* Edit & Delete buttons */}
        {(isOwner || isModerator) && (
          <div className="flex gap-1">
            <button onClick={() => onEdit(service)} className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center hover:bg-blue-500/30">
              <Edit2 size={12} />
            </button>
            <button onClick={() => onDelete(service.id)} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 text-red-400">
              <Trash2 size={12} />
            </button>
          </div>
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
        {service.start_date && <span>📅 {fmtDateShort(service.start_date, lang)}{service.end_date && service.end_date !== service.start_date ? ` – ${fmtDateShort(service.end_date, lang)}` : ''}</span>}
        {service.start_time && <span>🕐 {service.start_time}{service.end_time ? `–${service.end_time}` : ''}</span>}
      </div>

      <div className="flex gap-2">
        {service.contact_phone && <a href={`tel:${service.contact_phone}`} className="text-[10px] text-green-400 flex items-center gap-1">📞 {service.contact_phone}</a>}
        {service.facebook && <a href={service.facebook} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400">FB Page →</a>}
      </div>
    </div>
  )
}

function HealthForm({ onClose, onSuccess, lang, editTarget }) {
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
  const set = async (k, v) => setForm(f => ({...f, [k]: v}))

  useEffect(() => {
    if (editTarget) {
      setForm({
        type: editTarget.type || 'free_clinic',
        title: editTarget.title || '',
        title_mm: editTarget.title_mm || '',
        description_mm: editTarget.description_mm || '',
        organizer_mm: editTarget.organizer_mm || '',
        location_mm: editTarget.location_mm || '',
        contact_phone: editTarget.contact_phone || '',
        contact_name: editTarget.contact_name || '',
        facebook: editTarget.facebook || '',
        start_date: editTarget.start_date || '',
        end_date: editTarget.end_date || '',
        start_time: editTarget.start_time || '',
        end_time: editTarget.end_time || '',
        blood_types_needed: editTarget.blood_types_needed || [],
        is_urgent: editTarget.is_urgent || false,
      })
      setImages(editTarget.images || [])
    }
  }, [editTarget])

  async function toggleBloodType(bt) {
    setForm(f => ({...f, blood_types_needed: f.blood_types_needed.includes(bt) ? f.blood_types_needed.filter(b => b !== bt) : [...f.blood_types_needed, bt]}))
  }

  async function handleImageUpload(file) {
    setImgLoading(true)
    try {
      const url = await uploadImage(file, 'health')
      setImages(prev => [...prev, url])
    } catch (err) {
      showError(err.message || (lang === 'mm' ? 'ပုံတင်ရာတွင် အမှားရှိသည်' : 'Image upload failed'))
    } finally {
      setImgLoading(false)
    }
  }

  async function submit() {
    if (!form.title_mm) return
    setSubmitting(true)

    const payload = {
      ...form,
      // `title` is NOT NULL in the schema; fall back to the Myanmar title.
      title: form.title || form.title_mm,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      images,
      poster_id: user?.id || null,
    }

    // posted_at is set ONLY on insert — sending it on every edit
    // silently re-dated the service and re-sorted it to the top.
    let error
    if (editTarget) {
      error = (await supabase.from('health_services').update(payload).eq('id', editTarget.id)).error
    } else {
      error = (await supabase.from('health_services').insert({ ...payload, posted_at: new Date().toISOString() })).error
    }

    if (error) {
      console.error('Submit error:', error)
      showError(error.message)
    } else {
      onSuccess()
    }
    setSubmitting(false)
  }

  if (!isLoggedIn) return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 pt-safe">
      <div className="w-full max-w-lg bg-[#140020] border border-white/10 rounded-t-3xl p-6 pb-24 text-center">
        <p className="text-white font-myanmar mb-4">တင်ရန် Login လိုအပ်သည်</p>
        <button onClick={() => navigate('/login')} className="btn-primary w-full">Login ဝင်မည်</button>
        <button onClick={onClose} className="btn-ghost w-full mt-2">Cancel</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0015] overflow-y-auto pt-safe">
      <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
        <h2 className="font-display font-bold text-base text-white">{editTarget ? (lang === 'mm' ? 'ပြင်ဆင်မည်' : 'Edit') : (lang === 'mm' ? 'ဝန်ဆောင်မှု တင်မည်' : 'Post Health Service')}</h2>
        <button onClick={submit} disabled={!form.title_mm || submitting} className="btn-primary text-xs px-4 py-2">{submitting ? '...' : (lang === 'mm' ? 'တင်မည်' : 'Post')}</button>
      </div>
      <div className="px-4 py-4 space-y-4 pb-24">
        <div>
          <label className="block text-xs text-white/50 mb-1.5">အမျိုးအစား</label>
          <div className="flex gap-2 flex-wrap">
            {HEALTH_TYPES.filter(t => t.id !== 'all').map(t => (
              <button key={t.id} onClick={() => set('type', t.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border ${form.type === t.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>{t.icon} {t.mm}</button>
            ))}
          </div>
        </div>

        <div><label className="block text-xs text-white/50 mb-1.5">ခေါင်းစဉ် (မြန်မာ) *</label><input autoFocus value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" placeholder={form.type === 'blood_drive' ? 'ဥပမာ: သွေးလှူဒါန်းပွဲ — မြေနီတောင်ဆေးရုံ' : 'ဥပမာ: အခမဲ့ဆေးခန်း — ဆရာဝန် ၅ ဦး'} /></div>
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

export function HealthServicePage() {
  const { lang } = useLang()
  const { user, isModerator, isLoggedIn } = useAuth()
  const config = useAppConfig()
  useSEO({ title: lang === 'mm' ? 'ကျန်းမာရေးဝန်ဆောင်မှု' : 'Health Services' })
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [typeFilter, setType] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)

  async function load() {
    setLoading(true)
    setLoadError(false)
    try {
      let q = supabase.from('health_services').select('*').eq('status', 'active').order('is_urgent', { ascending: false }).order('posted_at', { ascending: false }).limit(30)
      if (typeFilter !== 'all') q = q.eq('type', typeFilter)
      const { data, error } = await q
      if (error) throw error
      setItems(data || [])
    } catch (e) { console.warn(e); setLoadError(true) }
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
    if (!(await confirmDialog(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?'))) return
    const { error } = await supabase.from('health_services').delete().eq('id', id)
    if (error) { showError(error.message); return }
    load()
  }

  return (
    <div className="pb-8">

      {/* Emergency/Health Tabs */}
      <div className="px-4 pb-3">
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
          <button
            onClick={() => navigate('/emergency')}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors text-white/50 hover:text-white/80"
          >
            🆘 {lang === 'mm' ? 'အရေးပေါ်' : 'Emergency'}
          </button>
          <button className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors bg-brand-600/40 text-brand-200 border border-brand-400/40">
            🏥 {lang === 'mm' ? 'ကျန်းမာရေး' : 'Health'}
          </button>
        </div>
      </div>
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">🏥 {lang === 'mm' ? 'ကျန်းမာရေးဝန်ဆောင်မှု' : 'Health Services'}</h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? `${config.app_city || ''} အခမဲ့ဆေးခန်း • သွေးလှူ • ဆေးထိုး` : 'Free clinic • Blood drives • Vaccination'}</p>
        </div>
        <button onClick={() => { setEditTarget(null); setShowForm(true) }} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"><Plus size={14} /> Post</button>
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
         loadError ? (
           <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
             <p className="text-sm text-red-400 font-myanmar">Data တင်ရာတွင် အမှားဖြစ်သွားသည်</p>
             <button onClick={load} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button>
           </div>
         ) :
         items.length === 0 ? (
           <div className="flex flex-col items-center py-12 text-center"><span className="text-4xl mb-3">🏥</span><p className="text-white/40 font-display font-semibold">{lang === 'mm' ? 'ဝန်ဆောင်မှု မရှိသေး' : 'No services posted'}</p></div>
         ) :
         items.map(item => (
           <HealthCard
             key={item.id}
             service={item}
             lang={lang}
             isModerator={isModerator}
             userId={user?.id}
             onEdit={(item) => { setEditTarget(item); setShowForm(true) }}
             onDelete={deleteItem}
           />
         ))}
      </div>

      {showForm && (
        <HealthForm
          lang={lang}
          editTarget={editTarget}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
          onSuccess={() => { setShowForm(false); setEditTarget(null); load() }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// BUS SCHEDULE PAGE (unchanged, same as before)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// BUS SCHEDULE PAGE — rewritten to the bus_departures table model
// (daily departure reports, NOT a static timetable).
// bus_departures columns: route_id FK, departure_date, departure_time,
// seats_available ('many'|'few'|'full'|'unknown'), actual_fare, notes,
// reporter_id, reported_at. No contact / arrival_time / price column.
// ─────────────────────────────────────────────────────────────
const SEAT_LABELS = {
  many:    { mm: 'နေရာများများ',  en: 'Many seats', color: 'text-green-400' },
  few:     { mm: 'နေရာနည်းနည်း',  en: 'Few seats',  color: 'text-amber-400' },
  full:    { mm: 'ပြည့်သွားပြီ',   en: 'Full',       color: 'text-red-400' },
  unknown: { mm: 'မသိရ',          en: 'Unknown',    color: 'text-white/40' },
}

export function BusSchedulePage() {
  const { lang } = useLang()
  const { user, isModerator, isLoggedIn } = useAuth()
  const config = useAppConfig()
  useSEO({ title: lang === 'mm' ? 'ကားထွက်ချိန်' : 'Bus Schedule' })

  const [routes, setRoutes] = useState([])
  const [departures, setDepartures] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [routeFilter, setRouteFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState(() => yangonToday())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ route_id: '', departure_date: yangonToday(), departure_time: '', seats_available: 'unknown', actual_fare: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({...f, [k]: v}))

  async function loadRoutes() {
    const { data, error } = await supabase.from('bus_routes').select('*').eq('is_active', true).order('sort_order', { ascending: true })
    if (error) { console.warn(error); return }
    setRoutes(data || [])
  }

  async function load() {
    setLoading(true)
    setLoadError(false)
    try {
      let q = supabase.from('bus_departures')
        .select('*, bus_routes(from_city, to_city, operator, type, normal_fare)')
        .eq('departure_date', dateFilter)
        .order('departure_time', { ascending: true })
      if (routeFilter !== 'all') q = q.eq('route_id', routeFilter)
      const { data, error } = await q
      if (error) throw error
      setDepartures(data || [])
    } catch (e) { console.warn(e); setLoadError(true) }
    setLoading(false)
  }

  useEffect(() => { loadRoutes() }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('bus-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bus_departures' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bus_departures' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [routeFilter, dateFilter])

  async function submit() {
    if (!form.route_id || !form.departure_time) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('bus_departures').insert({
        route_id: form.route_id,
        departure_date: form.departure_date || dateFilter,
        departure_time: form.departure_time,
        seats_available: form.seats_available,
        actual_fare: form.actual_fare ? parseInt(form.actual_fare) : null,
        notes: form.notes || null,
        reporter_id: user?.id || null,
      })
      if (error) throw error
      setShowForm(false)
      load()
    } catch (e) {
      showError(e.message || (lang === 'mm' ? 'ထည့်ရာတွင် အမှားရှိသည်' : 'Failed to add departure'))
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteSchedule(id) {
    if (!(await confirmDialog(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?'))) return
    const { error } = await supabase.from('bus_departures').delete().eq('id', id)
    if (error) { showError(error.message); return }
    load()
  }

  const routeLabel = (r) => r ? `${r.from_city} → ${r.to_city}${r.operator ? ` (${r.operator})` : ''}` : ''

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">🚌 {lang === 'mm' ? 'ကားထွက်ချိန်' : 'Bus Schedule'}</h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? `${config.app_city || ''} ကားထွက်ချိန် Community Report` : 'Community reported bus departures'}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"><Plus size={14} /> {lang === 'mm' ? 'ထည့်မည်' : 'Add'}</button>
      </div>
      <div className="px-4 mb-4 space-y-2">
        <div className="relative">
          <select value={routeFilter} onChange={e => setRouteFilter(e.target.value)} className="select-dark">
            <option value="all" style={{ backgroundColor: '#1a0030' }}>🚌 {lang === 'mm' ? 'လမ်းကြောင်း အားလုံး' : 'All routes'}</option>
            {routes.map(r => (
              <option key={r.id} value={r.id} style={{ backgroundColor: '#1a0030' }}>{routeLabel(r)}</option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ရက်စွဲ' : 'Date'}</label>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input-dark" />
        </div>
      </div>
      <div className="px-4 space-y-2">
        {loading ? [1,2,3].map(n => <div key={n} className="h-20 rounded-2xl shimmer" />) :
         loadError ? (
           <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
             <p className="text-sm text-red-400 font-myanmar">Data တင်ရာတွင် အမှားဖြစ်သွားသည်</p>
             <button onClick={load} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button>
           </div>
         ) :
         departures.length === 0 ? (
           <div className="flex flex-col items-center py-12 text-center">
             <span className="text-4xl mb-3">🚌</span>
             <p className="text-white/40 font-display font-semibold">{lang === 'mm' ? 'ဒီနေ့ ကားထွက်ချိန် မရှိသေး' : 'No departures reported for this date'}</p>
           </div>
         ) :
         departures.map(s => {
           const seat = SEAT_LABELS[s.seats_available] || SEAT_LABELS.unknown
           return (
             <div key={s.id} className="card-dark rounded-2xl p-4">
               <div className="flex items-start justify-between gap-2">
                 <div className="flex-1">
                   <p className="font-display font-semibold text-sm text-white font-myanmar">{routeLabel(s.bus_routes)}</p>
                   <div className="flex items-center gap-3 mt-1 flex-wrap">
                     {s.departure_time && <span className="text-xs text-brand-300">🕐 {s.departure_time}</span>}
                     <span className={`text-xs font-bold ${seat.color}`}>{lang === 'mm' ? seat.mm : seat.en}</span>
                     {s.actual_fare
                       ? <span className="text-xs text-gold-400 font-mono">{Number(s.actual_fare).toLocaleString()} Ks</span>
                       : (s.bus_routes?.normal_fare ? <span className="text-xs text-white/40 font-mono">~{Number(s.bus_routes.normal_fare).toLocaleString()} Ks</span> : null)}
                   </div>
                   {s.notes && <p className="text-xs text-white/40 mt-1 font-myanmar">{s.notes}</p>}
                 </div>
                 {isModerator && <button onClick={() => deleteSchedule(s.id)} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400"><Trash2 size={12} /></button>}
               </div>
             </div>
           )
         })}
      </div>
      {showForm && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0015] pt-safe">
          <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8">
            <button onClick={() => setShowForm(false)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
            <h2 className="font-display font-bold text-base text-white">{lang === 'mm' ? 'ကားထွက်ချိန် ထည့်မည်' : 'Report a Departure'}</h2>
            <button onClick={submit} disabled={!form.route_id || !form.departure_time || submitting} className="btn-primary text-xs px-4 py-2">{submitting ? '...' : lang === 'mm' ? 'သိမ်းမည်' : 'Save'}</button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">လမ်းကြောင်း *</label>
              <select value={form.route_id} onChange={e => set('route_id', e.target.value)} className="select-dark">
                <option value="">{lang === 'mm' ? 'လမ်းကြောင်း ရွေးပါ' : 'Choose a route'}</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{routeLabel(r)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] text-white/40 mb-1">ရက်စွဲ *</label><input type="date" value={form.departure_date} onChange={e => set('departure_date', e.target.value)} className="input-dark" /></div>
              <div><label className="block text-[10px] text-white/40 mb-1">ထွက်ချိန် *</label><input type="time" value={form.departure_time} onChange={e => set('departure_time', e.target.value)} className="input-dark" /></div>
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'နေရာ အခြေအနေ' : 'Seat availability'}</label>
              <select value={form.seats_available} onChange={e => set('seats_available', e.target.value)} className="select-dark">
                {Object.entries(SEAT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{lang === 'mm' ? v.mm : v.en}</option>
                ))}
              </select>
            </div>
            <div><label className="block text-xs text-white/50 mb-1.5">အမှန်တကယ် ဈေးနှုန်း (Ks)</label><input type="number" value={form.actual_fare} onChange={e => set('actual_fare', e.target.value)} className="input-dark font-mono" /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">မှတ်ချက်</label><input value={form.notes} onChange={e => set('notes', e.target.value)} className="input-dark font-myanmar" /></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TOURS PAGE — rewritten to the tour_packages table (it exists in the
// schema). tour_packages columns: guide_id, name, name_mm, description,
// description_mm, duration_days, type (trekking|boat|cycling|cultural|
// day_trip|multi_day), start_location, end_location, difficulty
// (easy|moderate|hard), includes (text), price_usd, price_mmk, images,
// is_active. Guide contact lives on tour_guides, not on packages —
// packages have no phone/facebook columns, so the submit form does not
// collect them; guide_id stays null (no guide picker yet).
// ─────────────────────────────────────────────────────────────
const TOUR_TYPES = [
  { id: 'all',      mm: 'အားလုံး',    en: 'All',       icon: '🏔️' },
  { id: 'trekking', mm: 'Trekking',   en: 'Trekking',  icon: '🥾' },
  { id: 'boat',     mm: 'လှေ/ရေ',     en: 'Boat Tour', icon: '⛵' },
  { id: 'cycling',  mm: 'စက်ဘီး',     en: 'Cycling',   icon: '🚲' },
  { id: 'cultural', mm: 'ယဉ်ကျေးမှု', en: 'Cultural',  icon: '🏛️' },
  { id: 'day_trip', mm: 'Day Trip',   en: 'Day Trip',  icon: '🌄' },
  { id: 'multi_day',mm: 'Multi-day',  en: 'Multi-day', icon: '🗺️' },
]

const TOUR_DIFFICULTIES = [
  { id: 'easy',     mm: 'လွယ်ကူ',    en: 'Easy' },
  { id: 'moderate', mm: 'အလယ်အလတ်', en: 'Moderate' },
  { id: 'hard',     mm: 'ခက်ခဲ',     en: 'Hard' },
]

const TOUR_INCLUDES = [
  { id: 'meals',     icon: '🍽️', mm: 'အစားအသောက်',      en: 'Meals' },
  { id: 'transport', icon: '🚗', mm: 'သယ်ယူပို့ဆောင်',  en: 'Transport' },
  { id: 'guide',     icon: '🧭', mm: 'Guide',            en: 'Guide' },
  { id: 'water',     icon: '💧', mm: 'ရေသောက်ရေ',        en: 'Drinking water' },
  { id: 'insurance', icon: '🛡️', mm: 'အာမခံ',            en: 'Insurance' },
  { id: 'tickets',   icon: '🎫', mm: 'ဝင်ခွင့်လက်မှတ်',  en: 'Entry tickets' },
]

export function ToursPage() {
  const { lang } = useLang()
  const { isModerator } = useAuth()
  const config = useAppConfig()
  useSEO({ title: 'Tour Guide' })

  const [tours, setTours] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [typeFilter, setType] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name_mm: '', description_mm: '', type: 'trekking',
    duration_days: '', price_mmk: '', price_usd: '',
    start_location: '', end_location: '', difficulty: '',
    includes: [], images: [],
  })
  const [submitting, setSubmitting] = useState(false)
  const [imgLoading, setImgLoading] = useState(false)
  const set = (k, v) => setForm(f => ({...f, [k]: v}))

  function toggleInclude(inc) {
    setForm(f => ({
      ...f,
      includes: f.includes.includes(inc)
        ? f.includes.filter(x => x !== inc)
        : [...f.includes, inc],
    }))
  }

  async function handleImageUpload(file) {
    setImgLoading(true)
    try {
      const url = await uploadImage(file, 'tours')
      setForm(f => ({ ...f, images: [...f.images, url] }))
    } catch (e) {
      showError(e.message || (lang === 'mm' ? 'ပုံတင်ရာတွင် အမှားရှိသည်' : 'Image upload failed'))
    } finally {
      setImgLoading(false)
    }
  }

  async function load() {
    setLoading(true)
    setLoadError(false)
    try {
      // tour_packages has no created_at; order by name. Public rows are
      // is_active = true (RLS "Packages public").
      let q = supabase
        .from('tour_packages')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (typeFilter !== 'all') {
        q = q.eq('type', typeFilter)
      }

      const { data, error } = await q
      if (error) throw error
      setTours(data || [])
    } catch (e) {
      console.warn('Load tours error:', e)
      setLoadError(true)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [typeFilter])

  // Realtime subscription for tours
  useEffect(() => {
    const channel = supabase
      .channel('tours-live')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tour_packages' },
        () => load()
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tour_packages' },
        () => load()
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tour_packages' },
        () => load()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [typeFilter])

  async function submit() {
    if (!form.name_mm) return
    // duration_days is explicit, never a silent default: the old
    // `parseInt(...) : 1` quietly filed every undated tour as 1 day.
    if (!form.duration_days || parseInt(form.duration_days) < 1) {
      showError(lang === 'mm' ? 'ကြာချိန် (ရက်) ထည့်ပါ' : 'Enter the duration in days')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('tour_packages').insert({
        name: form.name_mm,
        name_mm: form.name_mm,
        description: form.description_mm || null,
        description_mm: form.description_mm || null,
        duration_days: parseInt(form.duration_days),
        type: form.type,
        start_location: form.start_location || null,
        end_location: form.end_location || null,
        difficulty: form.difficulty || null,
        // `includes` is a plain text column in tour_packages.
        includes: form.includes.length ? form.includes.join(', ') : null,
        price_mmk: form.price_mmk ? parseInt(form.price_mmk) : null,
        price_usd: form.price_usd ? parseInt(form.price_usd) : null,
        images: form.images || [],
        is_active: true,
      })
      if (error) throw error
      setShowForm(false)
      load()
    } catch (e) {
      showError(e.message || (lang === 'mm' ? 'တင်ရာတွင် အမှားရှိသည်' : 'Failed to post tour package'))
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteTour(id) {
    if (!(await confirmDialog(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?'))) return
    const { error } = await supabase.from('tour_packages').delete().eq('id', id)
    if (error) { showError(error.message); return }
    load()
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">🏔️ Tour Guide / Trekking</h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? `${config.app_city || ''} Trekking / Boat Trip ခရီးစဉ်များ` : 'Local trekking & boat tour packages'}</p>
        </div>
        {/* Add is admin/mod only: tour_packages has a select-only policy,
            so an insert from anyone else would always fail at RLS. */}
        {isModerator && <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"><Plus size={14} /> {lang === 'mm' ? 'ထည့်မည်' : 'Add'}</button>}
      </div>
      <div className="px-4 mb-4">
        <div className="relative">
          <select value={typeFilter} onChange={e => setType(e.target.value)} className="select-dark">
            {TOUR_TYPES.map(t => <option key={t.id} value={t.id} style={{ backgroundColor: '#1a0030' }}>{t.icon} {lang === 'mm' ? t.mm : t.en}</option>)}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div className="px-4 space-y-3 pb-24">
        {loading ? [1,2,3].map(n => <div key={n} className="h-28 rounded-2xl shimmer" />) :
         loadError ? (
           <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
             <p className="text-sm text-red-400 font-myanmar">Data တင်ရာတွင် အမှားဖြစ်သွားသည်</p>
             <button onClick={load} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button>
           </div>
         ) :
         tours.length === 0 ? (
           <div className="flex flex-col items-center py-12 text-center">
             <span className="text-4xl mb-3">🏔️</span>
             <p className="text-white/40 font-display font-semibold">{lang === 'mm' ? 'Tour Package မရှိသေး' : 'No tour packages yet'}</p>
           </div>
         ) :
         tours.map(t => {
           const tt = TOUR_TYPES.find(x => x.id === t.type)
           const diff = TOUR_DIFFICULTIES.find(x => x.id === t.difficulty)
           const includes = t.includes ? String(t.includes).split(',').map(s => s.trim()).filter(Boolean) : []
           return (
             <div key={t.id} className="card-dark rounded-2xl p-4 space-y-2">
               <div className="flex items-start justify-between gap-2">
                 <div className="flex-1 min-w-0">
                   {/* Gallery preview */}
                   {t.images?.length > 0 && (
                     <div className="flex gap-1 mb-2 overflow-x-auto scrollbar-hide">
                       {t.images.slice(0, 3).map((img, i) => (
                         <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-white/10">
                           <img src={img} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" loading="lazy" />
                         </a>
                       ))}
                       {t.images.length > 3 && (
                         <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-[9px] text-white/50 font-bold">
                           +{t.images.length - 3}
                         </div>
                       )}
                     </div>
                   )}
                   <div className="flex items-center gap-2 mb-1 flex-wrap">
                     <span>{tt?.icon}</span>
                     <span className="text-[9px] text-brand-300 bg-brand-600/15 border border-brand-400/20 px-1.5 py-0.5 rounded-full font-bold">{lang === 'mm' ? tt?.mm : tt?.en}</span>
                     {diff && <span className="text-[9px] text-white/50 bg-white/8 px-1.5 py-0.5 rounded-full">{lang === 'mm' ? diff.mm : diff.en}</span>}
                   </div>
                   <h3 className="font-display font-semibold text-sm text-white font-myanmar">{lang === 'mm' ? (t.name_mm || t.name) : (t.name || t.name_mm)}</h3>
                   {t.description_mm && <p className="text-xs text-white/50 mt-1 font-myanmar line-clamp-2">{t.description_mm}</p>}
                   <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[10px]">
                     {t.duration_days && <span className="text-white/40 font-myanmar">⏱ {t.duration_days} {lang === 'mm' ? 'ရက်' : t.duration_days > 1 ? 'days' : 'day'}</span>}
                     {(t.price_mmk || t.price_usd) && (
                       <span className="text-gold-400 font-mono">
                         {t.price_mmk ? `${Number(t.price_mmk).toLocaleString()} Ks` : ''}
                         {t.price_mmk && t.price_usd ? ' · ' : ''}
                         {t.price_usd ? `$${Number(t.price_usd).toLocaleString()}` : ''}
                       </span>
                     )}
                     {(t.start_location || t.end_location) && (
                       <span className="text-white/40 font-myanmar">📍 {t.start_location || ''}{t.start_location && t.end_location ? ' → ' : ''}{t.end_location || ''}</span>
                     )}
                   </div>

                   {includes.length > 0 && (
                     <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                       {includes.slice(0, 4).map((inc, i) => {
                         const cfg = TOUR_INCLUDES.find(x => x.id === inc) || { icon: '✓', mm: inc, en: inc }
                         return (
                           <span key={i} className="text-[9px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                             {cfg.icon} {lang === 'mm' ? cfg.mm : cfg.en}
                           </span>
                         )
                       })}
                     </div>
                   )}
                 </div>
                 {isModerator && <button onClick={() => deleteTour(t.id)} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 flex-shrink-0"><Trash2 size={12} /></button>}
               </div>
             </div>
           )
         })}
      </div>
      {showForm && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0015] pt-safe">
          <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8">
            <button onClick={() => setShowForm(false)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
            <h2 className="font-display font-bold text-base text-white">{lang === 'mm' ? 'Tour Package ထည့်မည်' : 'Add Tour Package'}</h2>
            <button onClick={submit} disabled={!form.name_mm || !form.duration_days || submitting} className="btn-primary text-xs px-4 py-2">{submitting ? '...' : lang === 'mm' ? 'သိမ်းမည်' : 'Save'}</button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">
            <div>
              <label className="block text-xs text-white/50 mb-1.5">အမျိုးအစား</label>
              <div className="flex gap-2 flex-wrap">
                {TOUR_TYPES.filter(t => t.id !== 'all').map(t => (
                  <button key={t.id} onClick={() => set('type', t.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border ${form.type === t.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>{t.icon} {lang === 'mm' ? t.mm : t.en}</button>
                ))}
              </div>
            </div>
            <div><label className="block text-xs text-white/50 mb-1.5">ခရီးစဉ် အမည် *</label><input autoFocus value={form.name_mm} onChange={e => set('name_mm', e.target.value)} className="input-dark font-myanmar" /></div>
            <div><label className="block text-xs text-white/50 mb-1.5">ဖော်ပြချက်</label><textarea value={form.description_mm} onChange={e => set('description_mm', e.target.value)} className="input-dark font-myanmar resize-none h-20" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] text-white/40 mb-1">ကြာချိန် (ရက်)</label><input type="number" min="1" value={form.duration_days} onChange={e => set('duration_days', e.target.value)} className="input-dark font-mono" placeholder="1" /></div>
              <div>
                <label className="block text-[10px] text-white/40 mb-1">ခက်ခဲမှု</label>
                <select value={form.difficulty} onChange={e => set('difficulty', e.target.value)} className="select-dark">
                  <option value="">{lang === 'mm' ? 'မသတ်မှတ်ပါ' : 'Not specified'}</option>
                  {TOUR_DIFFICULTIES.map(d => (
                    <option key={d.id} value={d.id}>{lang === 'mm' ? d.mm : d.en}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] text-white/40 mb-1">ဈေး (Ks)</label><input type="number" value={form.price_mmk} onChange={e => set('price_mmk', e.target.value)} className="input-dark font-mono" /></div>
              <div><label className="block text-[10px] text-white/40 mb-1">ဈေး (USD)</label><input type="number" value={form.price_usd} onChange={e => set('price_usd', e.target.value)} className="input-dark font-mono" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] text-white/40 mb-1">စတင်ရာ</label><input value={form.start_location} onChange={e => set('start_location', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: ကလော" /></div>
              <div><label className="block text-[10px] text-white/40 mb-1">ပြီးဆုံးရာ</label><input value={form.end_location} onChange={e => set('end_location', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: အင်းလေး" /></div>
            </div>

            {/* Includes */}
            <div>
              <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ပါဝင်သည့် ဝန်ဆောင်မှုများ' : 'Includes'}</label>
              <div className="grid grid-cols-2 gap-2">
                {TOUR_INCLUDES.map(inc => (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => toggleInclude(inc.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${form.includes.includes(inc.id) ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/10 text-white/40'}`}
                  >
                    <span>{inc.icon}</span>
                    <span>{lang === 'mm' ? inc.mm : inc.en}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Images */}
            <div>
              <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဓာတ်ပုံများ (optional)' : 'Photos (optional)'}</label>
              <div className="flex gap-2 flex-wrap">
                {form.images.map((url, i) => (
                  <div key={i} className="relative w-20 h-20">
                    <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-white/10" />
                    <button
                      type="button"
                      onClick={() => set('images', form.images.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center"
                    >✕</button>
                  </div>
                ))}
                {form.images.length < 6 && (
                  <ImageUploader onUpload={handleImageUpload} loading={imgLoading} label="+" />
                )}
              </div>
              <p className="text-[9px] text-white/25 mt-1.5">{lang === 'mm' ? 'အများဆုံး ၆ ပုံ' : 'Max 6 photos'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
