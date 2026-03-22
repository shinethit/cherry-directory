import { useState, useEffect, useCallback, useRef } from 'react'
import { TrendingUp, TrendingDown, Minus, Plus, RefreshCw, AlertCircle, Trash2, CheckCircle, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'

// ── Constants ─────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',       mm: 'အားလုံး',          en: 'All',       icon: '🛒' },
  { id: 'grain',     mm: 'ဆန်/ပဲ/စီရသီ',    en: 'Grain',     icon: '🌾' },
  { id: 'oil',       mm: 'ဆီ',               en: 'Oil',        icon: '🫙' },
  { id: 'vegetable', mm: 'ဟင်းသီးဟင်းရွက်', en: 'Vegetable', icon: '🥬' },
  { id: 'meat',      mm: 'အသား',             en: 'Meat',       icon: '🥩' },
  { id: 'fish',      mm: 'ငါး/ပုဇွန်',       en: 'Fish',       icon: '🐟' },
  { id: 'fruit',     mm: 'သစ်သီး',           en: 'Fruit',      icon: '🍎' },
  { id: 'fuel',      mm: 'ဓာတ်ဆီ/ဂတ်',      en: 'Fuel',       icon: '⛽' },
  { id: 'other',     mm: 'အခြား',            en: 'Other',      icon: '📦' },
]
// Default markets — shown if DB has none yet
const DEFAULT_MARKETS = ['ပြည်သူ့ဈေး', 'ပင်လုံဈေး', 'မြို့သစ်ဈေး', 'အောင်မင်္ဂလာဈေး', 'အခြား']
const REPORT_COOLDOWN = 10 * 60 * 1000

// ── Helpers ───────────────────────────────────────────────────
function fmt(n)  { return n ? Number(n).toLocaleString() + ' Ks' : '—' }
function timeAgoShort(iso, lang) {
  if (!iso) return '—'
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return lang === 'mm' ? 'ယခုလေး' : 'just now'
  if (m < 60) return `${m}${lang === 'mm' ? 'မိနစ်' : 'm'}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}${lang === 'mm' ? 'နာရီ' : 'h'}`
  return `${Math.floor(h/24)}${lang === 'mm' ? 'ရက်' : 'd'}`
}

// ── Trend / % badge ───────────────────────────────────────────
function PctBadge({ pct, label, lang }) {
  if (pct === null || pct === undefined) return null
  const abs = Math.abs(pct)
  if (abs < 0.5) return <span className="flex items-center gap-0.5 text-white/30 text-[9px]"><Minus size={10} /> 0%</span>
  if (pct > 0) return (
    <span className="flex items-center gap-0.5 text-red-400 text-[9px] font-bold" title={label}>
      <TrendingUp size={10} /> +{abs.toFixed(1)}%
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-green-400 text-[9px] font-bold" title={label}>
      <TrendingDown size={10} /> -{abs.toFixed(1)}%
    </span>
  )
}

// ── Report modal ──────────────────────────────────────────────
function ReportModal({ item, onClose, onSubmit, lang, markets = DEFAULT_MARKETS }) {
  const [price, setPrice]   = useState('')
  const [market, setMarket] = useState(markets[0] || DEFAULT_MARKETS[0])
  const [notes, setNotes]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]   = useState('')

  async function submit() {
    const p = parseInt(price)
    if (!p || p < 100 || p > 10_000_000) { setError(lang === 'mm' ? 'ဈေးနှုန်း မမှန်ကန်' : 'Invalid price'); return }
    setSubmitting(true)
    await onSubmit({ price: p, market, notes })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#140020] border border-white/10 rounded-t-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Drag handle + header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2 border-b border-white/8">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="font-display font-bold text-white text-sm">{lang === 'mm' ? item.name : (item.name_en || item.name)}</p>
              <p className="text-[9px] text-white/40">per {lang === 'mm' ? item.unit : (item.unit_en || item.unit)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-white/50 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[75dvh] px-5 pb-8 pt-4 space-y-4">

        {/* Current price context */}
        {item.median_price && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl">
            <span className="text-xs text-white/50">{lang === 'mm' ? 'လက်ရှိ Median:' : 'Current median:'}</span>
            <span className="text-sm font-bold text-white">{fmt(item.median_price)}</span>
            {item.pct_change_week !== null && (
              <PctBadge pct={item.pct_change_week} lang={lang} label="vs last week" />
            )}
          </div>
        )}

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဈေးနှုန်း (Ks)' : 'Price (Ks)'} *</label>
          <div className="flex items-center gap-2">
            <button onClick={() => setPrice(p => String(Math.max(100, parseInt(p||0) - 100)))} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center text-white hover:bg-white/12"><Minus size={16} /></button>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 5000" className="input-dark flex-1 text-center text-lg font-mono font-bold" min="100" />
            <button onClick={() => setPrice(p => String(parseInt(p||0) + 100))} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center text-white hover:bg-white/12"><Plus size={16} /></button>
          </div>
          {price && <p className="text-center text-xs text-brand-300 mt-1 font-mono">{parseInt(price).toLocaleString()} Ks</p>}
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဈေးကွက်' : 'Market'}</label>
          <div className="flex gap-2 flex-wrap">
            {markets.map(m => (
              <button key={m} onClick={() => setMarket(m)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors font-myanmar ${market === m ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>{m}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'မှတ်ချက်' : 'Notes'} (optional)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder={lang === 'mm' ? 'ဥပမာ: ဒီပတ် ၅၀၀ တက်လာ' : 'e.g. Increased 500 this week'} className="input-dark text-sm font-myanmar" maxLength={100} />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button onClick={submit} disabled={!price || submitting} className="btn-primary flex-1">
            {submitting ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> ...</span>
              : lang === 'mm' ? '📤 တင်ပြမည်' : '📤 Submit'}
          </button>
        </div>

        <p className="text-[9px] text-white/25 text-center font-myanmar">Guest ပါ တင်ပြနိုင် • Outlier ဈေးများ auto-filter • ၁၀ မိနစ် Cooldown</p>
        </div>{/* end scrollable */}
      </div>
    </div>
  )
}

// ── Edit Item Modal (Admin/Mod only) ─────────────────────────
function EditItemModal({ item, onClose, onSave, lang }) {
  const [name, setName]             = useState(item.name || '')
  const [nameEn, setNameEn]         = useState(item.name_en || '')
  const [subcategory, setSubcat]    = useState(item.subcategory || '')
  const [unit, setUnit]             = useState(item.unit || '')
  const [unitEn, setUnitEn]         = useState(item.unit_en || '')
  const [icon, setIcon]             = useState(item.icon || '🛒')
  const [saving, setSaving]         = useState(false)

  const ICONS = ['🌾','🍚','🫙','🥬','🧅','🧄','🌶️','🥩','🍗','🐟','🦐','⛽','🚛','🔥','🥜','🫘','🍎','📦']

  async function save() {
    setSaving(true)
    await onSave({ name, name_en: nameEn || null, subcategory: subcategory || null, unit, unit_en: unitEn || null, icon })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#140020] border border-white/10 rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-display font-bold text-white">{lang === 'mm' ? 'ကုန်ပစ္စည်း ပြင်ဆင်မည်' : 'Edit Item'}</h3>

        {/* Icon picker */}
        <div>
          <label className="block text-xs text-white/50 mb-1.5">Icon</label>
          <div className="flex gap-1.5 flex-wrap">
            {ICONS.map(ic => (
              <button key={ic} onClick={() => setIcon(ic)}
                className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors ${icon === ic ? 'bg-brand-600/60 border border-brand-400/50' : 'bg-white/5 hover:bg-white/10'}`}>
                {ic}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-white/50 mb-1">အမည် (မြန်မာ) *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-dark font-myanmar text-sm" />
          </div>
          <div>
            <label className="block text-[10px] text-white/50 mb-1">Name (English)</label>
            <input value={nameEn} onChange={e => setNameEn(e.target.value)} className="input-dark text-sm" />
          </div>
          <div>
            <label className="block text-[10px] text-white/50 mb-1">Sub-category</label>
            <input value={subcategory} onChange={e => setSubcat(e.target.value)} className="input-dark font-myanmar text-sm" placeholder="e.g. ဆန်, ပဲ" />
          </div>
          <div />
          <div>
            <label className="block text-[10px] text-white/50 mb-1">ယူနစ် (မြန်မာ) *</label>
            <input value={unit} onChange={e => setUnit(e.target.value)} className="input-dark font-myanmar text-sm" placeholder="တင်း" />
          </div>
          <div>
            <label className="block text-[10px] text-white/50 mb-1">Unit (English)</label>
            <input value={unitEn} onChange={e => setUnitEn(e.target.value)} className="input-dark text-sm" placeholder="tin" />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={!name || !unit || saving} className="btn-primary flex-1">
            {saving ? '...' : lang === 'mm' ? '✓ သိမ်းမည်' : '✓ Save'}
          </button>
          <button onClick={onClose} className="btn-ghost px-4">{lang === 'mm' ? 'ပိတ်' : 'Close'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Manage Markets Modal (Admin/Mod only) ────────────────────
function ManageMarketsModal({ onClose, onUpdated, lang }) {
  const [list, setList]         = useState([])
  const [newName, setNewName]   = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    supabase.from('markets').select('*').order('sort_order').then(({ data }) => {
      setList(data || [])
      setLoading(false)
    })
  }, [])

  async function addMarket() {
    if (!newName.trim()) return
    setSaving(true)
    await supabase.from('markets').insert({
      name: newName.trim(),
      city: 'Taunggyi',
      sort_order: list.length + 1,
      is_active: true,
    })
    setNewName('')
    const { data } = await supabase.from('markets').select('*').order('sort_order')
    setList(data || [])
    setSaving(false)
    onUpdated()
  }

  async function toggleMarket(id, current) {
    await supabase.from('markets').update({ is_active: !current }).eq('id', id)
    setList(l => l.map(m => m.id === id ? { ...m, is_active: !current } : m))
    onUpdated()
  }

  async function deleteMarket(id) {
    await supabase.from('markets').delete().eq('id', id)
    setList(l => l.filter(m => m.id !== id))
    onUpdated()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#140020] border border-white/10 rounded-t-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8">
          <div>
            <p className="font-display font-bold text-white">🏪 {lang === 'mm' ? 'ဈေးကွက် စီမံမည်' : 'Manage Markets'}</p>
            <p className="text-[10px] text-white/40 font-myanmar mt-0.5">
              {lang === 'mm' ? 'ဈေးနှုန်း Report မှာ ပေါ်မည့် ဈေးကွက်များ' : 'Markets shown when reporting prices'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-white/50">✕</button>
        </div>

        <div className="overflow-y-auto max-h-[65dvh] px-5 py-4 space-y-3">
          {/* Add new market */}
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMarket()}
              placeholder={lang === 'mm' ? 'ဈေးကွက် အမည်ထည့်ပါ...' : 'Market name...'}
              className="input-dark flex-1 font-myanmar text-sm"
              maxLength={30}
            />
            <button
              onClick={addMarket}
              disabled={!newName.trim() || saving}
              className="btn-primary px-4 text-sm disabled:opacity-50"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Market list */}
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(n => <div key={n} className="h-12 rounded-xl shimmer" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {list.map(m => (
                <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  m.is_active ? 'bg-white/5 border-white/10' : 'bg-white/2 border-white/5 opacity-50'
                }`}>
                  <span className="text-lg">🏪</span>
                  <p className={`flex-1 text-sm font-myanmar ${m.is_active ? 'text-white' : 'text-white/40 line-through'}`}>
                    {m.name}
                  </p>
                  <span className="text-[9px] text-white/30">{m.city}</span>
                  {/* Toggle active */}
                  <button
                    onClick={() => toggleMarket(m.id, m.is_active)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors ${
                      m.is_active
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-white/8 text-white/30 hover:bg-white/12'
                    }`}
                    title={m.is_active ? 'Hide' : 'Show'}
                  >
                    {m.is_active ? '✓' : '○'}
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => deleteMarket(m.id)}
                    className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center text-xs transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-[9px] text-white/25 font-myanmar text-center pt-1">
            {lang === 'mm'
              ? '✓ = ပြသမည် • ○ = မပြ • ဖျက်ရင် ဒေတာပါ ပျောက်မည်'
              : '✓ = visible • ○ = hidden • Delete removes permanently'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Add Custom Item modal ─────────────────────────────────────
function AddItemModal({ onClose, onAdded, lang }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ name: '', name_en: '', category: 'other', unit: 'ပိဿာ', unit_en: 'viss', icon: '📦' })
  const [submitting, setSubmitting] = useState(false)
  const ICONS = ['📦','🌾','🥬','🍎','🥩','🐟','🫙','⛽','🥛','🍞','🧂','🌶️','🧅','🧄','🥔','🌽','🫘','🍳','🫚','🧋']
  const UNITS = [
    {mm:'ပိဿာ',en:'viss'},{mm:'တင်း',en:'tin'},{mm:'ဘူး',en:'can'},{mm:'ဆယ်ဈောင်',en:'bunch'},
    {mm:'လီတာ',en:'liter'},{mm:'ကီလို',en:'kg'},{mm:'ကျပ်သား',en:'tael'},{mm:'ပုလင်း',en:'bottle'},{mm:'ထုပ်',en:'pack'}
  ]

  async function submit() {
    if (!form.name) return
    setSubmitting(true)
    await supabase.from('price_items').insert({
      name: form.name, name_en: form.name_en || null,
      category: form.category, unit: form.unit, unit_en: form.unit_en,
      icon: form.icon, is_custom: true, approved: true,
      added_by: user?.id || null, sort_order: 999,
    })
    setSubmitting(false)
    onAdded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#140020] border border-white/10 rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-display font-bold text-white">{lang === 'mm' ? 'ကုန်ပစ္စည်း အသစ်ထည့်မည်' : 'Add Custom Item'}</h3>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">Icon</label>
          <div className="flex gap-1.5 flex-wrap">
            {ICONS.map(ic => (
              <button key={ic} onClick={() => setForm(f => ({...f, icon: ic}))} className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center ${form.icon === ic ? 'bg-brand-600/60 border border-brand-400/50' : 'bg-white/5'}`}>{ic}</button>
            ))}
          </div>
        </div>

        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ပစ္စည်းအမည် (မြန်မာ)' : 'Item Name (Myanmar)'} *</label>
          <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="input-dark font-myanmar" placeholder="ဥပမာ: သကြားလုံး" />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'အမျိုးအစား' : 'Category'}</label>
          <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} className="input-dark">
            {CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.icon} {c.mm}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ယူနစ် (မြန်မာ)' : 'Unit (MM)'}</label>
            <select value={form.unit} onChange={e => { const u = UNITS.find(u => u.mm === e.target.value); setForm(f => ({...f, unit: e.target.value, unit_en: u?.en || ''})) }} className="input-dark font-myanmar">
              {UNITS.map(u => <option key={u.mm} value={u.mm}>{u.mm}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-white/50 mb-1.5">Unit (English)</label>
            <input value={form.unit_en} onChange={e => setForm(f => ({...f, unit_en: e.target.value}))} className="input-dark" placeholder="e.g. kg" />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={submit} disabled={!form.name || submitting} className="btn-primary flex-1">{submitting ? '...' : lang === 'mm' ? 'ထည့်မည်' : 'Add'}</button>
          <button onClick={onClose} className="btn-ghost px-4">{lang === 'mm' ? 'ပိတ်' : 'Close'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Price Row ─────────────────────────────────────────────────
function PriceRow({ item, lang, onReport, onEdit, onDelete, onVerify, isAdmin }) {
  const [showTrend, setShowTrend] = useState(false)
  const hasData = item.median_price > 0
  const weekPct = item.pct_change_week
  const verifiedPct = item.pct_change_verified

  return (
    <div className="card-dark rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-3.5 hover:bg-white/3 transition-colors">
        <button onClick={() => hasData && setShowTrend(s => !s)} className="text-xl flex-shrink-0">{item.icon}</button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-display font-semibold text-white truncate">{lang === 'mm' ? item.name : (item.name_en || item.name)}</p>
            {item.is_custom && <span className="text-[8px] bg-brand-600/20 text-brand-300 border border-brand-400/20 px-1 rounded">custom</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {hasData ? (
              <>
                <PctBadge pct={weekPct} lang={lang} label={lang === 'mm' ? 'တစ်ပတ်နှင့် နှိုင်း' : 'vs last week'} />
                {verifiedPct !== null && verifiedPct !== undefined && <PctBadge pct={verifiedPct} lang={lang} label={lang === 'mm' ? 'Verified နှင့် နှိုင်း' : 'vs verified price'} />}
                <p className="text-[9px] text-white/30">{item.report_count} report • {timeAgoShort(item.last_reported, lang)}</p>
              </>
            ) : (
              <p className="text-[9px] text-white/30 font-myanmar">{lang === 'mm' ? 'Data မရှိသေး' : 'No data yet'}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {hasData ? (
            <div className="text-right">
              <p className="font-display font-bold text-base text-white">{Number(item.median_price).toLocaleString()}</p>
              <p className="text-[9px] text-white/30">Ks/{lang === 'mm' ? item.unit : (item.unit_en || item.unit)}</p>
            </div>
          ) : (
            <button onClick={() => onReport(item)} className="text-[10px] text-brand-300 font-semibold">{lang === 'mm' ? 'တင်ပါ' : 'Report'}</button>
          )}

          {/* Admin actions */}
          {isAdmin && hasData && (
            <button onClick={() => onVerify(item)} title="Verify this price" className="w-7 h-7 rounded-lg bg-gold-500/15 border border-gold-500/25 flex items-center justify-center hover:bg-gold-500/25 transition-colors">
              <CheckCircle size={13} className="text-gold-400" />
            </button>
          )}
          {isAdmin && onEdit && (
            <button onClick={() => onEdit(item)} title="Edit item" className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center hover:bg-blue-500/20 transition-colors">
              <Pencil size={11} className="text-blue-400" />
            </button>
          )}
          {isAdmin && (
            <button onClick={() => onDelete(item)} title="Delete item" className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/15 flex items-center justify-center hover:bg-red-500/20 transition-colors">
              <Trash2 size={12} className="text-red-400" />
            </button>
          )}

          {hasData && (
            <button onClick={() => onReport(item)} className="w-7 h-7 rounded-xl bg-brand-600/20 border border-brand-400/25 flex items-center justify-center hover:bg-brand-600/35 transition-colors">
              <Plus size={14} className="text-brand-300" />
            </button>
          )}
        </div>
      </div>

      {/* Trend expand */}
      {showTrend && hasData && (
        <div className="px-4 pb-3 pt-1 border-t border-white/6 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-white/40 font-display uppercase tracking-wider">{lang === 'mm' ? 'ဈေးနှုန်း အချက်အလက်' : 'Price Details'}</p>
            <button onClick={() => setShowTrend(false)} className="text-white/30 hover:text-white/60"><ChevronUp size={14} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: lang === 'mm' ? 'အနည်းဆုံး' : 'Min',    val: item.min_price,     color: 'text-green-400' },
              { label: lang === 'mm' ? 'Median'    : 'Median',  val: item.median_price,   color: 'text-white'     },
              { label: lang === 'mm' ? 'အများဆုံး' : 'Max',    val: item.max_price,      color: 'text-red-400'   },
            ].map(s => (
              <div key={s.label} className="bg-white/5 rounded-xl p-2 text-center">
                <p className={`font-mono font-bold text-sm ${s.color}`}>{Number(s.val).toLocaleString()}</p>
                <p className="text-[9px] text-white/30 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          {item.verified_price && (
            <div className="flex items-center gap-2 text-[10px] text-white/40">
              <CheckCircle size={10} className="text-gold-400" />
              <span>{lang === 'mm' ? 'Verified ဈေး:' : 'Verified price:'}</span>
              <span className="font-mono text-gold-400 font-bold">{Number(item.verified_price).toLocaleString()} Ks</span>
              <span className="text-white/25">{timeAgoShort(item.verified_at, lang)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function MarketPricePage() {
  const { lang } = useLang()
  const { user, isModerator } = useAuth()
  useSEO({ title: lang === 'mm' ? 'ဈေးနှုန်းဘုတ်' : 'Market Price Board' })

  const [prices, setPrices]         = useState([])
  const [catFilter, setCat]         = useState('all')
  const [loading, setLoading]       = useState(true)
  const [lastUpdate, setLast]       = useState(null)
  const [reportTarget, setReport]   = useState(null)
  const [showAddItem, setShowAdd]   = useState(false)
  const [toast, setToast]           = useState(null)
  const [recentReports, setRecent]  = useState([])
  const [collapsedCats, setCollapsed] = useState({})
  const [markets, setMarkets]       = useState(DEFAULT_MARKETS)
  const [showManageMarkets, setShowManageMarkets] = useState(false)
  const channelRef = useRef(null)

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500) }

  // Load markets from DB
  useEffect(() => {
    supabase.from('markets').select('name').eq('is_active', true).order('sort_order').then(({ data }) => {
      if (data && data.length > 0) setMarkets(data.map(m => m.name))
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('current_prices').select('*')
    setPrices(data || [])
    setLast(new Date())
    setLoading(false)
    supabase.from('price_reports').select('*, item:price_items(name, name_en, icon, unit, unit_en), reporter:profiles(full_name, nickname)').order('reported_at', { ascending: false }).limit(8).then(({ data }) => setRecent(data || []))
  }, [])

  useEffect(() => {
    load()
    channelRef.current = supabase.channel('prices-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_reports' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_items' }, load)
      .subscribe()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [load])

  async function handleSubmitReport({ price, market, notes }) {
    if (!reportTarget) return
    const key  = `pr_${reportTarget.id}`
    const last = localStorage.getItem(key)
    if (last && Date.now() - parseInt(last) < REPORT_COOLDOWN) {
      showToast('warn', lang === 'mm' ? '၁၀ မိနစ်တစ်ကြိမ်သာ တင်ပြနိုင်' : 'Wait 10 min before re-reporting'); setReport(null); return
    }
    // Outlier check
    const med = reportTarget.median_price
    if (med && (price > med * 3 || price < med * 0.2)) {
      showToast('warn', lang === 'mm' ? 'ဈေးနှုန်း ကွဲလွဲမှု များလွန်းသည်' : 'Price seems unusual'); setReport(null); return
    }
    await supabase.from('price_reports').insert({ item_id: reportTarget.id, price, market, notes: notes || null, reporter_id: user?.id || null })
    localStorage.setItem(key, String(Date.now()))
    setReport(null)
    showToast('ok', lang === 'mm' ? '✓ တင်ပြပြီး — ကျေးဇူးပါ' : '✓ Submitted — thank you!')
  }

  async function handleVerify(item) {
    if (!item.median_price) return
    await supabase.from('verified_prices').insert({
      item_id: item.id, price: item.median_price,
      verified_by: user?.id, note: `Community median (${item.report_count} reports)`,
    })
    showToast('ok', lang === 'mm' ? `✓ ${item.name} ဈေးနှုန်း Verify လုပ်ပြီး` : `✓ ${item.name} price verified`)
    load()
  }

  const [editTarget, setEditTarget] = useState(null)

  async function handleEditItem(updates) {
    await supabase.from('price_items').update(updates).eq('id', editTarget.id)
    setEditTarget(null)
    showToast('ok', lang === 'mm' ? '✓ ပြင်ဆင်ပြီး' : '✓ Updated')
    load()
  }

  async function handleDeleteItem(item) {
    if (!confirm(lang === 'mm' ? `"${item.name}" ကို ဖျက်မည်လား?` : `Delete "${item.name}"?`)) return
    await supabase.from('price_items').update({ is_active: false }).eq('id', item.id)
    showToast('ok', lang === 'mm' ? 'ဖျက်ပြီး' : 'Deleted')
    load()
  }

  // Group by category → then by subcategory within each category
  const grouped = CATEGORIES.filter(c => c.id !== 'all').map(cat => {
    const catItems = prices.filter(p =>
      p.category === cat.id && (catFilter === 'all' || catFilter === cat.id)
    )
    // Group items by subcategory
    const subMap = {}
    catItems.forEach(item => {
      const sub = item.subcategory || ''
      if (!subMap[sub]) subMap[sub] = []
      subMap[sub].push(item)
    })
    return { ...cat, items: catItems, subgroups: subMap }
  }).filter(g => g.items.length > 0)

  const displayed = catFilter === 'all' ? grouped : grouped.filter(g => g.id === catFilter)
  const totalReports = prices.reduce((s, p) => s + (p.report_count || 0), 0)

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-xl text-white">🛒 {lang === 'mm' ? 'ဈေးနှုန်းဘုတ်' : 'Market Prices'}</h1>
            <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? 'Community တင်ပြသော ဈေးနှုန်း • Real-time' : 'Community-reported prices • Real-time'}</p>
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-1 text-[10px] text-brand-300 mt-1">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {lastUpdate && !loading ? timeAgoShort(lastUpdate.toISOString(), lang) : '...'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-2 px-4 mb-4">
        <div className="flex-1 card-dark rounded-2xl p-3 text-center">
          <p className="font-display font-bold text-lg text-white">{prices.filter(p => p.report_count > 0).length}</p>
          <p className="text-[9px] text-white/40">{lang === 'mm' ? 'ကုန်ပစ္စည်း' : 'Items tracked'}</p>
        </div>
        <div className="flex-1 card-dark rounded-2xl p-3 text-center">
          <p className="font-display font-bold text-lg text-white">{totalReports}</p>
          <p className="text-[9px] text-white/40">{lang === 'mm' ? 'Report (48h)' : 'Reports (48h)'}</p>
        </div>
        <div className="flex-1 card-dark rounded-2xl p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p className="font-display font-bold text-sm text-green-400">Live</p>
          </div>
          <p className="text-[9px] text-white/25">Real-time</p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 px-4 mb-4 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setCat(cat.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${catFilter === cat.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}>
            <span>{cat.icon}</span> {lang === 'mm' ? cat.mm : cat.en}
          </button>
        ))}
      </div>

      {/* Grouped price list — Category → Sub-category */}
      <div className="px-4 space-y-4 mb-4">
        {loading ? [1,2,3,4,5].map(n => <div key={n} className="h-14 rounded-2xl shimmer" />) :
          displayed.map(group => (
            <div key={group.id}>
              {/* Category header */}
              <button
                className="flex items-center gap-2 mb-2 w-full text-left"
                onClick={() => setCollapsed(c => ({...c, [group.id]: !c[group.id]}))}
              >
                <span className="text-base">{group.icon}</span>
                <p className="text-[10px] font-display font-bold text-white/60 uppercase tracking-wider flex-1">
                  {lang === 'mm' ? group.mm : group.en}
                </p>
                <span className="text-[9px] text-white/30 bg-white/6 px-1.5 py-0.5 rounded-full">{group.items.length}</span>
                {collapsedCats[group.id] ? <ChevronDown size={12} className="text-white/30" /> : <ChevronUp size={12} className="text-white/30" />}
              </button>

              {!collapsedCats[group.id] && (
                <div className="space-y-3">
                  {/* If sub-categories exist, group by them */}
                  {Object.entries(group.subgroups).map(([sub, items]) => (
                    <div key={sub || '_nosub'}>
                      {/* Sub-category label — only show if it has a value and there are multiple subgroups */}
                      {sub && Object.keys(group.subgroups).filter(k => k).length > 1 && (
                        <div className="flex items-center gap-2 mb-1.5 ml-1">
                          <div className="h-px flex-1 bg-white/8" />
                          <p className="text-[9px] text-white/40 font-myanmar font-semibold px-2">
                            {sub}
                          </p>
                          <div className="h-px flex-1 bg-white/8" />
                        </div>
                      )}
                      <div className="space-y-2">
                        {items.map(item => (
                          <PriceRow
                            key={item.id}
                            item={item}
                            lang={lang}
                            onReport={setReport}
                            onEdit={isModerator ? setEditTarget : null}
                            onDelete={handleDeleteItem}
                            onVerify={handleVerify}
                            isAdmin={isModerator}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        }
      </div>

      {/* Admin action buttons */}
      <div className="px-4 mb-4 space-y-2">
        <button onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-white/15 text-white/40 text-sm hover:border-brand-400/30 hover:text-brand-300 transition-colors">
          <Plus size={16} /> {lang === 'mm' ? 'ကုန်ပစ္စည်း အသစ်ထည့်မည်' : 'Add Custom Item'}
        </button>
        {isModerator && (
          <button onClick={() => setShowManageMarkets(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-white/10 text-white/40 text-xs hover:border-brand-400/30 hover:text-brand-300 transition-colors">
            🏪 {lang === 'mm' ? 'ဈေးကွက် စီမံမည် (Admin)' : 'Manage Markets (Admin)'}
          </button>
        )}
      </div>

      {/* Recent reports */}
      {recentReports.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-[10px] text-white/30 font-display font-bold uppercase tracking-wider mb-2">{lang === 'mm' ? 'နောက်ဆုံး Report များ' : 'Recent Reports'}</p>
          <div className="space-y-1.5">
            {recentReports.map(r => (
              <div key={r.id} className="flex items-center gap-2 text-[10px] text-white/40">
                <span className="text-sm">{r.item?.icon}</span>
                <span className="font-myanmar flex-1 truncate">{lang === 'mm' ? r.item?.name : (r.item?.name_en || r.item?.name)}</span>
                <span className="font-mono font-bold text-white/60">{Number(r.price).toLocaleString()} Ks</span>
                <span className="text-white/20">•</span>
                <span className="text-white/30">{r.reporter?.nickname ? `@${r.reporter.nickname}` : 'Guest'}</span>
                <span className="text-white/20">{timeAgoShort(r.reported_at, lang)}</span>
                {isModerator && (
                  <button onClick={async () => { await supabase.from('price_reports').delete().eq('id', r.id); load() }} className="w-5 h-5 flex items-center justify-center hover:text-red-400 transition-colors">
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-delete info */}
      <div className="mx-4 card-dark rounded-2xl p-4">
        <p className="text-[10px] text-white/30 font-myanmar">
          💡 {lang === 'mm'
            ? 'Report ချက်တွေကို ၆ လကျော်ရင် auto-delete ဖြစ်မည် • Verified ဈေးနှုန်းများ (✓) သည် ထာဝရ သိမ်းဆည်းထားမည်'
            : 'Reports auto-deleted after 6 months • Verified prices (✓) are kept permanently for history'}
        </p>
      </div>

      {reportTarget && <ReportModal item={reportTarget} lang={lang} markets={markets} onClose={() => setReport(null)} onSubmit={handleSubmitReport} />}
      {showAddItem && <AddItemModal lang={lang} onClose={() => setShowAdd(false)} onAdded={load} />}
      {showManageMarkets && (
        <ManageMarketsModal
          lang={lang}
          onClose={() => setShowManageMarkets(false)}
          onUpdated={() => {
            supabase.from('markets').select('name').eq('is_active', true).order('sort_order').then(({ data }) => {
              if (data && data.length > 0) setMarkets(data.map(m => m.name))
            })
          }}
        />
      )}

      {/* Edit Item Modal */}
      {editTarget && (
        <EditItemModal
          item={editTarget}
          lang={lang}
          onClose={() => setEditTarget(null)}
          onSave={handleEditItem}
        />
      )}

      {toast && (
        <div className={`fixed bottom-28 left-4 right-4 max-w-lg mx-auto z-[300] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl font-myanmar text-sm ${
          toast.type === 'ok'   ? 'bg-green-500/20 border border-green-500/40 text-green-300' :
          toast.type === 'warn' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' :
                                  'bg-red-500/20   border border-red-500/40   text-red-300'
        }`}>
          {toast.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
