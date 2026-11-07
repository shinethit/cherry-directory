import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Minus, Plus, RefreshCw, AlertCircle, Trash2, CheckCircle, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { supabase, realtimeEnabled } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { fetchMarketPrices } from '../lib/prefetch'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../contexts/AppConfigContext'
import { useSEO } from '../hooks/useSEO'
import { confirmDialog } from '../lib/confirmDialog'
import { showError } from '../lib/toast'

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
// Default markets — loaded from DB only
const DEFAULT_MARKETS = [] // loaded from DB only
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
  if (abs < 0.5) return <span className="flex items-center gap-0.5 text-white/60 text-[11px]"><Minus size={10} /> 0%</span>
  if (pct > 0) return (
    <span className="flex items-center gap-0.5 text-green-400 text-[11px] font-bold whitespace-nowrap" title={label}>
      <TrendingUp size={10} /> +{abs.toFixed(1)}%
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-red-400 text-[11px] font-bold whitespace-nowrap" title={label}>
      <TrendingDown size={10} /> -{abs.toFixed(1)}%
    </span>
  )
}

// ── Report modal ──────────────────────────────────────────────
// Gas station names for fuel category reports
const FUEL_STATIONS = [] // loaded from fuel_stations table

function ReportModal({ item, onClose, onSubmit, lang, markets = [], fuelStations = [], outlier = null, onConfirmOutlier, onCancelOutlier }) {
  const isFuel = item.category === 'fuel'
  const locations = isFuel ? fuelStations : markets

  const [price, setPrice]   = useState('')
  const [market, setMarket] = useState(locations[0] || '')
  const [notes, setNotes]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]   = useState('')

  // S20 (v9.17): markets/stations load async in the parent, so the
  // modal often opens with locations=[] and market=''. Sync to the
  // first location when it arrives.
  useEffect(() => {
    if (locations.length > 0 && !market) setMarket(locations[0])
  }, [locations])

  async function submit() {
    const p = parseInt(price)
    if (!p || p < 100 || p > 10_000_000) { setError(lang === 'mm' ? 'ဈေးနှုန်း မမှန်ကန်' : 'Invalid price'); return }
    if (!market.trim()) { setError(lang === 'mm' ? 'ဈေးကွက် ရွေးပါ' : 'Choose a market'); return }
    setSubmitting(true)
    await onSubmit({ price: p, market, notes })
    setSubmitting(false)
  }

  async function submitAnyway() {
    setSubmitting(true)
    await onConfirmOutlier()
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#140020] pt-safe">
      <div className="flex-1 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="text-2xl">{item.icon}</span>
          <div className="flex-1">
            <p className="font-display font-bold text-white text-sm">{lang === 'mm' ? item.name : (item.name_en || item.name)}</p>
            <p className="text-[9px] text-white/60">per {lang === 'mm' ? item.unit : (item.unit_en || item.unit)}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-4 space-y-4">

        {item.median_price && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl">
            <span className="text-xs text-white/50">{lang === 'mm' ? 'လက်ရှိ Median:' : 'Current median:'}</span>
            <span className="text-sm font-bold text-white">{fmt(item.median_price)}</span>
            {item.pct_change_week !== null && <PctBadge pct={item.pct_change_week} lang={lang} label="vs last week" />}
          </div>
        )}

        <div>
          <label className="block text-xs text-white/50 mb-1.5">
            {lang === 'mm' ? 'ဈေးနှုန်း' : 'Price'} — <span className="text-brand-300 font-semibold">Ks / {lang === 'mm' ? item.unit : (item.unit_en || item.unit)}</span> *
          </label>
          <div className="flex items-center gap-2">
            <button onClick={() => setPrice(p => String(Math.max(100, parseInt(p||0) - 100)))} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center text-white"><Minus size={16} /></button>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 5000" className="input-dark flex-1 text-center text-lg font-mono font-bold" min="100" />
            <button onClick={() => setPrice(p => String(parseInt(p||0) + 100))} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center text-white"><Plus size={16} /></button>
          </div>
          {price && <p className="text-center text-xs text-brand-300 mt-1 font-mono">{parseInt(price).toLocaleString()} Ks / {lang === 'mm' ? item.unit : (item.unit_en || item.unit)}</p>}
        </div>

        {/* Location — dropdown or text input */}
        <div>
          <label className="block text-xs text-white/50 mb-1.5">
            {isFuel ? (lang === 'mm' ? '⛽ ဓာတ်ဆီဆိုင်' : '⛽ Station') : (lang === 'mm' ? '🏪 ဈေးကွက်' : '🏪 Market')}
          </label>
          {locations.length > 0 ? (
            <div className="relative">
              <select value={market} onChange={e => setMarket(e.target.value)} className="select-dark">
                {locations.map(loc => <option key={loc} value={loc} style={{ backgroundColor: '#1a0030' }}>{loc}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            </div>
          ) : (
            <input
              type="text"
              value={market}
              onChange={e => setMarket(e.target.value)}
              placeholder={isFuel ? (lang === 'mm' ? 'ဓာတ်ဆီဆိုင် အမည်...' : 'Station name...') : (lang === 'mm' ? 'ဈေးကွက် အမည်...' : 'Market name...')}
              className="input-dark font-myanmar"
            />
          )}
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'မှတ်ချက်' : 'Notes'} (optional)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder={lang === 'mm' ? 'ဥပမာ: ဒီပတ် ၅၀၀ တက်လာ' : 'e.g. Increased 500 this week'} className="input-dark font-myanmar" maxLength={100} />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Outlier warning — the typed data is NOT discarded and the
            modal does NOT close: a genuine spike can be submitted
            anyway with the confirm below. */}
        {outlier && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
            <p className="text-sm font-bold text-amber-300 font-myanmar">
              ⚠️ {lang === 'mm' ? 'ဈေးနှုန်း ကွဲလွဲမှု များလွန်းသည်' : 'Price seems unusual'}
            </p>
            <p className="text-xs text-white/60 font-myanmar leading-relaxed">
              {lang === 'mm'
                ? `လက်ရှိ Median: ${fmt(outlier.median)} • သင် ထည့်သည့်ဈေး: ${fmt(outlier.price)} — တကယ်ဈေးတက်နေတာ / ဈေးကျနေတာဆိုရင် ဒီအတိုင်း တင်ပြနိုင်ပါသည်။`
                : `Current median: ${fmt(outlier.median)} • Your price: ${fmt(outlier.price)} — if this is a genuine spike, you can submit it anyway.`}
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={submitAnyway} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold disabled:opacity-50">
                {submitting ? '...' : (lang === 'mm' ? 'ဒီအတိုင်း တင်ပြမည်' : 'Submit anyway')}
              </button>
              <button onClick={onCancelOutlier} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-white/8 border border-white/10 text-white/60 text-xs font-bold disabled:opacity-50">
                {lang === 'mm' ? 'ဈေးနှုန်း ပြင်မည်' : 'Edit price'}
              </button>
            </div>
          </div>
        )}
        </div>
        <div className="px-5 py-3 border-t border-white/8">
          <button onClick={submit} disabled={!price || !market.trim() || submitting} className="btn-primary w-full">
            {submitting ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />...</span>
              : lang === 'mm' ? '📤 တင်ပြမည်' : '📤 Submit'}
          </button>
          <p className="text-[9px] text-white/60 text-center font-myanmar mt-1">Guest ပါ တင်ပြနိုင် • ၁၀ မိနစ် Cooldown</p>
        </div>
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
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#140020] pt-safe">
      <div className="flex-1 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <p className="font-display font-bold text-white text-sm">{lang === 'mm' ? '✏️ ကုန်ပစ္စည်း ပြင်ဆင်မည်' : '✏️ Edit Item'}</p>
          <button onClick={save} disabled={!name || !unit || saving} className="btn-primary text-xs px-4 py-2 disabled:opacity-50">
            {saving ? '...' : lang === 'mm' ? '✓ သိမ်း' : 'Save'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 pb-24">

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
            <input value={name} onChange={e => setName(e.target.value)} className="input-dark font-myanmar" />
          </div>
          <div>
            <label className="block text-[10px] text-white/50 mb-1">Name (English)</label>
            <input value={nameEn} onChange={e => setNameEn(e.target.value)} className="input-dark" />
          </div>
          <div>
            <label className="block text-[10px] text-white/50 mb-1">Sub-category</label>
            <input value={subcategory} onChange={e => setSubcat(e.target.value)} className="input-dark font-myanmar" placeholder="e.g. ဆန်, ပဲ" />
          </div>
          <div />
          <div>
            <label className="block text-[10px] text-white/50 mb-1">ယူနစ် (မြန်မာ) *</label>
            <input value={unit} onChange={e => setUnit(e.target.value)} className="input-dark font-myanmar" placeholder="တင်း" />
          </div>
          <div>
            <label className="block text-[10px] text-white/50 mb-1">Unit (English)</label>
            <input value={unitEn} onChange={e => setUnitEn(e.target.value)} className="input-dark" placeholder="tin" />
          </div>
        </div>
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
  const [editId, setEditId]     = useState(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    // 30 s timeout (was none) + catch: a hung/failed query used to
    // leave the modal spinner up forever.
    withTimeout(supabase.from('markets').select('*').order('sort_order'), 30000, 'Markets').then(({ data }) => {
      setList(data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function addMarket() {
    if (!newName.trim()) return
    setSaving(true)
    const { error } = await supabase.from('markets').insert({ name: newName.trim(), city: '', sort_order: list.length + 1, is_active: true })
    if (error) { showError(error.message); setSaving(false); return }
    setNewName('')
    const { data, error: refetchErr } = await supabase.from('markets').select('*').order('sort_order')
    // v9.25 regen #5: a resolve-with-error re-fetch wiped the modal
    // list with []. Keep the last good list on failure.
    if (!refetchErr) setList(data || [])
    setSaving(false)
    onUpdated()
  }

  async function saveEdit(id) {
    if (!editName.trim()) return
    const { error } = await supabase.from('markets').update({ name: editName.trim() }).eq('id', id)
    if (error) { showError(error.message); return }
    setList(l => l.map(m => m.id === id ? { ...m, name: editName.trim() } : m))
    setEditId(null)
    onUpdated()
  }

  async function toggleMarket(id, current) {
    const { error } = await supabase.from('markets').update({ is_active: !current }).eq('id', id)
    if (error) { showError(error.message); return }
    setList(l => l.map(m => m.id === id ? { ...m, is_active: !current } : m))
    onUpdated()
  }

  async function deleteMarket(id) {
    if (!(await confirmDialog(lang === 'mm' ? 'ဒီ ဈေးကွက်ကို ဖျက်မည်လား?' : 'Delete this market?', { danger: true }))) return
    const { error } = await supabase.from('markets').delete().eq('id', id)
    if (error) { showError(error.message); return }
    setList(l => l.filter(m => m.id !== id))
    onUpdated()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#140020] pt-safe">
      <div className="flex-1 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8">
          <div>
            <p className="font-display font-bold text-white">🏪 {lang === 'mm' ? 'ဈေးကွက် စီမံမည်' : 'Manage Markets'}</p>
            <p className="text-[10px] text-white/60 font-myanmar mt-0.5">{lang === 'mm' ? 'ဈေးနှုန်း Report မှာ ပေါ်မည့် ဈေးကွက်များ' : 'Markets shown when reporting prices'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-white/50">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 pb-24">
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMarket()}
              placeholder={lang === 'mm' ? 'ဈေးကွက် အမည်ထည့်ပါ...' : 'Market name...'}
              className="input-dark flex-1 font-myanmar" maxLength={30} />
            <button onClick={addMarket} disabled={!newName.trim() || saving} className="btn-primary px-4 text-sm disabled:opacity-50"><Plus size={16} /></button>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(n => <div key={n} className="h-12 rounded-xl shimmer" />)}</div>
          ) : (
            <div className="space-y-2">
              {list.map(m => (
                <div key={m.id} className={`rounded-xl border ${m.is_active ? 'bg-white/5 border-white/10' : 'bg-white/2 border-white/5 opacity-50'}`}>
                  {editId === m.id ? (
                    <div className="flex gap-2 p-2">
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(m.id); if (e.key === 'Escape') setEditId(null) }}
                        className="input-dark flex-1 font-myanmar py-1.5" maxLength={30} />
                      <button onClick={() => saveEdit(m.id)} className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-xs font-bold">✓</button>
                      <button onClick={() => setEditId(null)} className="px-3 py-1.5 bg-white/8 rounded-lg text-white/60 text-xs">✕</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3">
                      <span className="text-lg">🏪</span>
                      <p className={`flex-1 text-sm font-myanmar min-w-0 truncate ${m.is_active ? 'text-white' : 'text-white/60 line-through'}`}>{m.name}</p>
                      <button onClick={() => { setEditId(m.id); setEditName(m.name) }} className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center flex-shrink-0"><Pencil size={11} /></button>
                      <button onClick={() => toggleMarket(m.id, m.is_active)} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${m.is_active ? 'bg-green-500/20 text-green-400' : 'bg-white/8 text-white/60'}`}>{m.is_active ? '✓' : '○'}</button>
                      <button onClick={() => deleteMarket(m.id)} className="w-7 h-7 rounded-lg btn-danger flex items-center justify-center flex-shrink-0"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-[9px] text-white/60 font-myanmar text-center pt-1">✓ ပြသမည် • ○ မပြ • ✏️ ပြင် • 🗑 ဖျက်</p>
        </div>
      </div>
    </div>
  )
}

// ── Add Custom Item modal ─────────────────────────────────────
function AddItemModal({ onClose, onAdded, lang }) {
  const { user, isModerator, isAdmin } = useAuth()
  const [form, setForm] = useState({ name: '', name_en: '', category: 'other', unit: 'ပိဿာ', unit_en: 'viss', icon: '📦' })
  const [submitting, setSubmitting] = useState(false)
  const ICONS = ['📦','🌾','🥬','🍎','🥩','🐟','🫙','⛽','🥛','🍞','🧂','🌶️','🧅','🧄','🥔','🌽','🫘','🍳','🫚','🧋']
  const UNITS = [
    {mm:'ပိဿာ',en:'viss'},{mm:'တင်း',en:'tin'},{mm:'ဘူး',en:'can'},{mm:'ဆယ်ဈောင်',en:'bunch'},
    {mm:'လီတာ',en:'liter'},{mm:'ကီလို',en:'kg'},{mm:'ကျပ်သား',en:'tael'},{mm:'ပုလင်း',en:'bottle'},{mm:'ထုပ်',en:'pack'}
  ]

  async function submit() {
    if (!form.name) return
    // N13 (v9.17): same name in the same category already exists — the
    // list used to grow a silent duplicate.
    const { data: siblings, error: sibErr } = await supabase.from('price_items')
      .select('name, name_en').eq('category', form.category)
    // v9.25 regen #5: a resolve-with-error dup check used to pass
    // (siblings null → no dup) and insert a duplicate. Fail closed.
    if (sibErr) { showError(sibErr.message); return }
    const dup = (siblings || []).some(x =>
      (x.name || '').trim().toLowerCase() === form.name.trim().toLowerCase() ||
      (form.name_en && (x.name_en || '').trim().toLowerCase() === form.name_en.trim().toLowerCase()))
    if (dup) { showError(lang === 'mm' ? 'အမည်တူ ကုန်ပစ္စည်း ရှိပြီးဖြစ်သည်' : 'An item with this name already exists'); return }
    setSubmitting(true)
    const { error } = await supabase.from('price_items').insert({
      name: form.name, name_en: form.name_en || null,
      category: form.category, unit: form.unit, unit_en: form.unit_en,
      icon: form.icon, is_custom: true, approved: true,
      added_by: user?.id || null, sort_order: 999,
    })
    setSubmitting(false)
    if (error) { showError(error.message); return }
    onAdded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0015] pt-safe">
      <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg></button>
        <h2 className="font-display font-bold text-base text-white">{lang === 'mm' ? 'ကုန်ပစ္စည်း အသစ်ထည့်မည်' : 'Add Custom Item'}</h2>
        <button onClick={submit} disabled={!form.name || submitting} className="btn-primary text-xs px-4 py-2">{submitting ? '...' : lang === 'mm' ? 'ထည့်မည်' : 'Add'}</button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">

        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ပစ္စည်းအမည် (မြန်မာ)' : 'Item Name (Myanmar)'} *</label>
          <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="input-dark font-myanmar" placeholder="ဥပမာ: သကြားလုံး" />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'အမျိုးအစား' : 'Category'}</label>
          <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} className="select-dark">
            {CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.icon} {c.mm}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ယူနစ် (မြန်မာ)' : 'Unit (MM)'}</label>
            <select value={form.unit} onChange={e => { const u = UNITS.find(u => u.mm === e.target.value); setForm(f => ({...f, unit: e.target.value, unit_en: u?.en || ''})) }} className="select-dark">
              {UNITS.map(u => <option key={u.mm} value={u.mm}>{u.mm}</option>)}
            </select>
          </div>
          <div><label className="block text-xs text-white/50 mb-1.5">Unit (English)</label>
            <input value={form.unit_en} onChange={e => setForm(f => ({...f, unit_en: e.target.value}))} className="input-dark" placeholder="e.g. kg" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">Icon</label>
          <div className="flex gap-1.5 flex-wrap">
            {ICONS.map(ic => (
              <button key={ic} onClick={() => setForm(f => ({...f, icon: ic}))} className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center ${form.icon === ic ? 'bg-brand-600/60 border border-brand-400/50' : 'bg-white/5'}`}>{ic}</button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Price Row (table row: item | ဈေး | ယူနစ် | အပြောင်းအလဲ) ────────────
function PriceRow({ item, lang, onReport, onEdit, onDelete, onVerify, isAdmin }) {
  const [showTrend, setShowTrend] = useState(false)
  const hasData = item.median_price > 0
  const weekPct = item.pct_change_week
  const verifiedPct = item.pct_change_verified

  return (
    <>
      <tr className="border-b border-white/6 last:border-b-0 hover:bg-white/3 transition-colors align-top">
        {/* Item */}
        <td className="py-3 pl-3 pr-1">
          <div className="flex items-start gap-2 min-w-0">
            <button onClick={() => hasData && setShowTrend(s => !s)} className="text-xl leading-none flex-shrink-0">{item.icon}</button>
            <div className="min-w-0">
              <p className="text-sm font-display font-semibold text-white truncate">{lang === 'mm' ? item.name : (item.name_en || item.name)}</p>
              {item.is_custom && <span className="text-[8px] bg-brand-600/20 text-brand-300 border border-brand-400/20 px-1 rounded">custom</span>}
              <p className="text-[9px] text-white/60 mt-0.5">
                {hasData
                  ? `${item.report_count} report • ${timeAgoShort(item.last_reported, lang)}`
                  : (lang === 'mm' ? 'Data မရှိသေး' : 'No data yet')}
              </p>
            </div>
          </div>
        </td>
        {/* Price */}
        <td className="py-3 px-1 text-right">
          {hasData ? (
            <p className="font-display font-bold text-sm text-white tabular-nums truncate">{Number(item.median_price).toLocaleString()}</p>
          ) : (
            <button onClick={() => onReport(item)} className="text-[10px] text-brand-300 font-semibold whitespace-nowrap">{lang === 'mm' ? 'တင်ပါ' : 'Report'}</button>
          )}
        </td>
        {/* Unit */}
        <td className="py-3 px-1">
          <p className="text-[10px] text-white/60">Ks/{lang === 'mm' ? item.unit : (item.unit_en || item.unit)}</p>
        </td>
        {/* Change */}
        <td className="py-3 px-1">
          <div className="flex flex-col gap-0.5">
            <PctBadge pct={weekPct} lang={lang} label={lang === 'mm' ? 'တစ်ပတ်နှင့် နှိုင်း' : 'vs last week'} />
            {verifiedPct !== null && verifiedPct !== undefined && <PctBadge pct={verifiedPct} lang={lang} label={lang === 'mm' ? 'Verified နှင့် နှိုင်း' : 'vs verified price'} />}
            {weekPct === null && verifiedPct === null && <span className="text-[10px] text-white/60">—</span>}
          </div>
        </td>
        {/* Actions */}
        <td className="py-3 pr-2 pl-1 text-right">
          {hasData && (
            <button onClick={() => onReport(item)} className="w-7 h-7 rounded-xl bg-brand-600/20 border border-brand-400/25 inline-flex items-center justify-center hover:bg-brand-600/35 transition-colors">
              <Plus size={14} className="text-brand-300" />
            </button>
          )}
        </td>
      </tr>

      {/* Admin actions — own second row, 36px buttons (D9) */}
      {isAdmin && (
        <tr className="border-b border-white/6 last:border-b-0">
          <td colSpan={5} className="py-1.5 pr-2">
            <div className="flex justify-end gap-2">
              {hasData && (
                <button onClick={() => onVerify(item)} title="Verify this price" className="w-9 h-9 rounded-lg bg-gold-500/15 border border-gold-500/25 flex items-center justify-center hover:bg-gold-500/25 transition-colors">
                  <CheckCircle size={14} className="text-gold-400" />
                </button>
              )}
              {onEdit && (
                <button onClick={() => onEdit(item)} title="Edit item" className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center hover:bg-blue-500/20 transition-colors">
                  <Pencil size={13} className="text-blue-400" />
                </button>
              )}
              <button onClick={() => onDelete(item)} title="Delete item" className="w-9 h-9 rounded-lg btn-danger flex items-center justify-center transition-colors">
                <Trash2 size={13} className="text-white" />
              </button>
            </div>
          </td>
        </tr>
      )}

      {/* Trend expand */}
      {showTrend && hasData && (
        <tr className="border-b border-white/6 last:border-b-0">
          <td colSpan={5} className="px-4 pb-3 pt-1 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/60 font-display uppercase tracking-wider">{lang === 'mm' ? 'ဈေးနှုန်း အချက်အလက်' : 'Price Details'}</p>
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
                  <p className="text-[9px] text-white/60 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            {item.verified_price && (
              <div className="flex items-center gap-2 text-[10px] text-white/60">
                <CheckCircle size={10} className="text-gold-400" />
                <span>{lang === 'mm' ? 'Verified ဈေး:' : 'Verified price:'}</span>
                <span className="font-mono text-gold-400 font-bold">{Number(item.verified_price).toLocaleString()} Ks</span>
                <span className="text-white/60">{timeAgoShort(item.verified_at, lang)}</span>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function MarketPricePage() {
  const { lang } = useLang()
  const { user, isModerator } = useAuth()
  const config = useAppConfig()
  useSEO({ title: lang === 'mm' ? 'ဈေးနှုန်းဘုတ်' : 'Market Price Board' })

  const [prices, setPrices]         = useState([])
  const [catFilter, setCat]         = useState('all')
  const [loading, setLoading]       = useState(true)
  const [lastUpdate, setLast]       = useState(null)
  const [reportTarget, setReport]   = useState(null)
  // Pending outlier confirmation — the modal stays open with the typed
  // data intact until the user confirms or edits the price.
  const [outlier, setOutlier]       = useState(null)
  const [showAddItem, setShowAdd]   = useState(false)
  const [toast, setToast]           = useState(null)
  const [recentReports, setRecent]  = useState([])
  const [collapsedCats, setCollapsed] = useState({})
  const [markets, setMarkets]       = useState([])
  const [fuelStations, setFuelStations] = useState([])
  const [showManageMarkets, setShowManageMarkets] = useState(false)
  const [liveConnected, setLiveConnected] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [loadError, setLoadError] = useState(false)
  const channelRef = useRef(null)

  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500) }

  // Load markets + fuel stations from DB
  useEffect(() => {
    supabase.from('markets').select('name').eq('is_active', true).order('sort_order')
      .then(({ data }) => { if (data) setMarkets(data.map(m => m.name)) })
    supabase.from('fuel_stations').select('name, name_mm').eq('is_active', true).order('sort_order')
      .then(({ data }) => { if (data) setFuelStations(data.map(s => s.name_mm || s.name)) })
  }, [])

  // Issue 4c (v9.17): useQuery ['market-prices'] (same fetcher as the
  // prefetch runner), so prices render from cache instantly on revisit
  // under VPN. S18/S23: realtime refetches are background-only — the
  // sync effect uses isLoading (not isFetching), so a live update never
  // flashes the full-page skeletons.
  const { data: marketData, isLoading: marketQueryLoading, isFetching: marketQueryFetching, isError: marketQueryError, refetch: refetchPrices } = useQuery({
    queryKey: ['market-prices'],
    queryFn: fetchMarketPrices,
  })
  useEffect(() => {
    if (marketData) {
      // M-SHAPE guard: prices/recent always arrays, never undefined —
      // prices.filter(...) at render must never see undefined.
      setPrices(marketData.prices || [])
      // "Updated … ago" comes from the data's own latest timestamp, never
      // from page-load time.
      const latest = (marketData.prices || [])
        .map(p => p.last_reported || p.updated_at)
        .filter(Boolean)
        .sort()
        .pop()
      setLast(latest ? new Date(latest) : null)
      setRecent(marketData.recent || [])
    }
    setLoading(marketQueryLoading)
    setLoadError(marketQueryError)
  }, [marketData, marketQueryLoading, marketQueryError])

  useEffect(() => {
    // v9.18: realtime is off on the proxied origin (see supabase.js) —
    // prices load via useQuery; skip the channel so the Live pill falls
    // back to showing the last-update time instead of reconnecting.
    if (!realtimeEnabled) return
    channelRef.current = supabase.channel('prices-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_reports' }, () => refetchPrices())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_items' }, () => refetchPrices())
      .subscribe((status) => setLiveConnected(status === 'SUBSCRIBED'))
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); setLiveConnected(false) }
  }, [])

  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  async function handleSubmitReport({ price, market, notes, force = false }) {
    if (!reportTarget) return
    const key  = `pr_${reportTarget.id}`
    const last = localStorage.getItem(key)
    // Cooldown: warn but KEEP the modal open with the typed price intact
    // (FB-9) — closing here used to discard everything the user typed.
    if (last && Date.now() - parseInt(last) < REPORT_COOLDOWN) {
      showToast('warn', lang === 'mm' ? '၁၀ မိနစ်တစ်ကြိမ်သာ တင်ပြနိုင်' : 'Wait 10 min before re-reporting'); return
    }
    // Outlier check — do NOT discard the input or close the modal: keep
    // it open with a "submit anyway?" confirm. A genuine spike could
    // otherwise never be reported.
    const med = reportTarget.median_price
    if (med && !force && (price > med * 3 || price < med * 0.2)) {
      showToast('warn', lang === 'mm' ? 'ဈေးနှုန်း ကွဲလွဲမှု များလွန်းသည်' : 'Price seems unusual')
      setOutlier({ price, market, notes, median: med })
      return
    }
    const { error } = await supabase.from('price_reports').insert({ item_id: reportTarget.id, price, market, notes: notes || null, reporter_id: user?.id || null })
    // Only set the 10-minute cooldown + success toast on a REAL success.
    if (error) { showError(error.message); return }
    localStorage.setItem(key, String(Date.now()))
    setReport(null)
    setOutlier(null)
    showToast('ok', lang === 'mm' ? '✓ တင်ပြပြီး — ကျေးဇူးပါ' : '✓ Submitted — thank you!')
  }

  async function handleVerify(item) {
    if (!item.median_price) return
    const { data: latest, error: latestErr } = await supabase.from('verified_prices')
      .select('price').eq('item_id', item.id).order('created_at', { ascending: false }).limit(1)
    // v9.25 regen #5: a resolve-with-error here skipped the
    // already-verified check and inserted a duplicate verify row.
    if (latestErr) { showError(latestErr.message); return }
    if (latest && latest.length > 0 && Number(latest[0].price) === Number(item.median_price)) {
      showToast('ok', lang === 'mm' ? `✓ ${item.name} ဈေးနှုန်း Verify ပြီးသား ဖြစ်သည်` : `✓ ${item.name} price already verified`)
      return
    }
    const { error } = await supabase.from('verified_prices').insert({
      item_id: item.id, price: item.median_price,
      verified_by: user?.id, note: `Community median (${item.report_count} reports)`,
    })
    if (error) { showError(error.message); return }
    showToast('ok', lang === 'mm' ? `✓ ${item.name} ဈေးနှုန်း Verify လုပ်ပြီး` : `✓ ${item.name} price verified`)
    refetchPrices()
  }

  const [editTarget, setEditTarget] = useState(null)

  async function handleEditItem(updates) {
    const { error } = await supabase.from('price_items').update(updates).eq('id', editTarget.id)
    if (error) { showError(error.message); return }
    setEditTarget(null)
    showToast('ok', lang === 'mm' ? '✓ ပြင်ဆင်ပြီး' : '✓ Updated')
    refetchPrices()
  }

  async function handleDeleteItem(item) {
    if (!(await confirmDialog(lang === 'mm' ? `"${item.name}" ကို ဖျက်မည်လား?` : `Delete "${item.name}"?`, { danger: true }))) return
    const { error } = await supabase.from('price_items').update({ is_active: false }).eq('id', item.id)
    if (error) { showError(error.message); return }
    showToast('ok', lang === 'mm' ? 'ဖျက်ပြီး' : 'Deleted')
    refetchPrices()
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
    // v9.21 (Bug C): pb-40 (160 px) — the Submit FAB sits at
    // bottom calc(var(--nav-h) + safe-area + 12px) with --nav-h 5rem/80 px,
    // so its band starts 140 px above the viewport bottom (48 px tall);
    // pb-8 (32 px) let the last content slide underneath it. 160 px
    // clears the FAB plus breathing room and typical safe-area insets.
    <div className="pb-40">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-xl text-white">🛒 {lang === 'mm' ? 'ဈေးနှုန်းဘုတ်' : 'Market Prices'}</h1>
            <p className="text-xs text-white/60 mt-0.5 font-myanmar">{lang === 'mm' ? 'Community တင်ပြသော ဈေးနှုန်း • Real-time' : 'Community-reported prices • Real-time'}</p>
          </div>
          <button onClick={() => refetchPrices()} disabled={marketQueryFetching} className="flex items-center gap-1 text-[10px] text-brand-300 mt-1">
            <RefreshCw size={12} className={marketQueryFetching ? 'animate-spin' : ''} />
            {/* 9.25 slow-network: name the background refetch instead of
                showing the old "last updated" time while it runs. */}
            {marketQueryFetching ? 'အသစ်ရယူနေသည်…' : (lastUpdate && !loading ? timeAgoShort(lastUpdate.toISOString(), lang) : '...')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-2 px-4 mb-4">
        <div className="flex-1 card-dark rounded-2xl p-3 text-center">
          <p className="font-display font-bold text-lg text-white">{prices.filter(p => p.report_count > 0).length}</p>
          <p className="text-[9px] text-white/60">{lang === 'mm' ? 'ကုန်ပစ္စည်း' : 'Items tracked'}</p>
        </div>
        <div className="flex-1 card-dark rounded-2xl p-3 text-center">
          <p className="font-display font-bold text-lg text-white">{totalReports}</p>
          <p className="text-[9px] text-white/60">{lang === 'mm' ? 'Report (48h)' : 'Reports (48h)'}</p>
        </div>
        <div className="flex-1 card-dark rounded-2xl p-3 text-center">
          {isOnline && liveConnected ? (
            <>
              <div className="flex items-center justify-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="font-display font-bold text-sm text-green-400">Live</p>
              </div>
              <p className="text-[9px] text-white/60">Real-time</p>
            </>
          ) : (
            <>
              <p className="font-display font-bold text-sm text-white/70">{lastUpdate ? timeAgoShort(lastUpdate.toISOString(), lang) : '—'}</p>
              <p className="text-[9px] text-white/60">{lang === 'mm' ? 'နောက်ဆုံးအပ်ဒိတ်' : 'Last updated'}</p>
            </>
          )}
        </div>
      </div>

      {/* Category filter — dropdown to prevent overflow */}
      <div className="px-4 mb-4">
        <div className="relative">
          <select
            value={catFilter}
            onChange={e => setCat(e.target.value)}
            className="select-dark font-display font-semibold"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {lang === 'mm' ? cat.mm : cat.en}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        </div>
      </div>

      {/* Grouped price list — Category → Sub-category */}
      <div className="px-4 space-y-4 mb-4">
        {loading ? [1,2,3,4,5].map(n => <div key={n} className="h-14 rounded-2xl shimmer" />) :
          loadError && prices.length === 0 ? (
            <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
              <p className="text-sm text-red-400 font-myanmar">Data တင်ရာတွင် အမှားဖြစ်သွားသည်</p>
              <button onClick={() => refetchPrices()} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button>
            </div>
          ) : (
          <>
            {/* 9.25 slow-network: error with cached prices — keep the
                list, show the small amber strip above it. */}
            {loadError && (
              <div className="py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
                <p className="text-xs text-amber-300 font-myanmar">အဟောင်းပြထားသည် — အင်တာနက် နှေးနေသည်</p>
                <button onClick={() => refetchPrices()} className="text-xs font-bold text-amber-300 underline whitespace-nowrap">ပြန်ကြိုးစားမည်</button>
              </div>
            )}
            {displayed.map(group => (
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
                <span className="text-[9px] text-white/60 bg-white/6 px-1.5 py-0.5 rounded-full">{group.items.length}</span>
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
                          <p className="text-[9px] text-white/60 font-myanmar font-semibold px-2">
                            {sub}
                          </p>
                          <div className="h-px flex-1 bg-white/8" />
                        </div>
                      )}
                      <div className="card-dark rounded-2xl overflow-x-auto">
                        <table className="w-full table-fixed">
                          <colgroup>
                            <col className="w-[34%]" /><col className="w-[20%]" /><col className="w-[12%]" /><col className="w-[20%]" /><col className="w-[14%]" />
                          </colgroup>
                          <thead>
                            <tr className="border-b border-white/10 text-left">
                              <th className="py-2 pl-3 pr-1 text-[10px] font-display font-bold uppercase tracking-wider text-white/60">{lang === 'mm' ? 'ပစ္စည်း' : 'Item'}</th>
                              <th className="py-2 px-1 text-right text-[10px] font-display font-bold uppercase tracking-wider text-white/60">{lang === 'mm' ? 'ဈေး' : 'Price'}</th>
                              <th className="py-2 px-1 text-[10px] font-display font-bold uppercase tracking-wider text-white/60">{lang === 'mm' ? 'ယူနစ်' : 'Unit'}</th>
                              <th className="py-2 px-1 text-[10px] font-display font-bold uppercase tracking-wider text-white/60">{lang === 'mm' ? 'အပြောင်းအလဲ' : 'Change'}</th>
                              <th className="py-2 pr-2" aria-label="actions" />
                            </tr>
                          </thead>
                          <tbody>
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
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          </>
          )}
      </div>

      {/* Admin action buttons */}
      <div className="px-4 mb-4 space-y-2">
        {isModerator && (
          <button onClick={() => setShowAdd(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-white/15 text-white/60 text-sm hover:border-brand-400/30 hover:text-brand-300 transition-colors">
            <Plus size={16} /> {lang === 'mm' ? 'ကုန်ပစ္စည်း အသစ်ထည့်မည်' : 'Add Custom Item'}
          </button>
        )}
        {isModerator && (
          <button onClick={() => setShowManageMarkets(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-white/10 text-white/60 text-xs hover:border-brand-400/30 hover:text-brand-300 transition-colors">
            🏪 {lang === 'mm' ? 'ဈေးကွက် စီမံမည် (Admin)' : 'Manage Markets (Admin)'}
          </button>
        )}
      </div>

      {/* Recent reports */}
      {recentReports.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-[10px] text-white/60 font-display font-bold uppercase tracking-wider mb-2">{lang === 'mm' ? 'နောက်ဆုံး Report များ' : 'Recent Reports'}</p>
          <div className="space-y-1.5">
            {recentReports.map(r => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 text-[10px] text-white/60">
                <span className="text-sm">{r.item?.icon}</span>
                <span className="font-myanmar flex-1 min-w-0 truncate">{lang === 'mm' ? r.item?.name : (r.item?.name_en || r.item?.name)}</span>
                <span className="font-mono font-bold text-white/60">{Number(r.price).toLocaleString()} Ks</span>
                <span className="text-white/60">•</span>
                <span className="text-white/60 truncate max-w-[120px]">{r.reporter?.nickname ? `@${r.reporter.nickname}` : 'Guest'}</span>
                <span className="text-white/60">{timeAgoShort(r.reported_at, lang)}</span>
                {isModerator && (
                  <button onClick={async () => { if (!(await confirmDialog(lang === 'mm' ? 'ဒီ Report ကို ဖျက်မည်လား?' : 'Delete this report?', { danger: true }))) return; const { error } = await supabase.from('price_reports').delete().eq('id', r.id); if (error) { console.error('Delete price report error:', error); showError(lang === 'mm' ? 'ဖျက်ရာတွင် အမှားရှိသည်' : 'Delete failed'); return } refetchPrices() }} className="min-w-[44px] min-h-[44px] -my-2 flex items-center justify-center hover:text-red-400 transition-colors" aria-label={lang === 'mm' ? 'Report ဖျက်မည်' : 'Delete report'}>
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
        <p className="text-[10px] text-white/60 font-myanmar">
          💡 {lang === 'mm'
            ? 'Report ချက်တွေကို ၆ လကျော်ရင် auto-delete ဖြစ်မည် • Verified ဈေးနှုန်းများ (✓) သည် ထာဝရ သိမ်းဆည်းထားမည်'
            : 'Reports auto-deleted after 6 months • Verified prices (✓) are kept permanently for history'}
        </p>
      </div>

      {reportTarget && <ReportModal item={reportTarget} lang={lang} markets={markets} fuelStations={fuelStations} outlier={outlier} onConfirmOutlier={() => outlier && handleSubmitReport({ ...outlier, force: true })} onCancelOutlier={() => setOutlier(null)} onClose={() => { setReport(null); setOutlier(null) }} onSubmit={handleSubmitReport} />}
      {showAddItem && <AddItemModal lang={lang} onClose={() => setShowAdd(false)} onAdded={() => refetchPrices()} />}
      {showManageMarkets && (
        <ManageMarketsModal
          lang={lang}
          onClose={() => setShowManageMarkets(false)}
          onUpdated={() => {
            supabase.from('markets').select('name').eq('is_active', true).order('sort_order')
              .then(({ data }) => { setMarkets(data ? data.map(m => m.name) : []) })
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
        <div className={`fixed left-4 right-4 max-w-lg mx-auto z-[300] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl font-myanmar text-sm ${
          toast.type === 'ok'   ? 'bg-green-500/20 border border-green-500/40 text-green-300' :
          toast.type === 'warn' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' :
                                  'bg-red-500/20   border border-red-500/40   text-red-300'
        }`} style={{ bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 5rem)' }}>
          {toast.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}