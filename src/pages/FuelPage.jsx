import { useState, useEffect, useRef } from 'react'
import { Fuel, RefreshCw, CheckCircle, AlertCircle, Users, Plus, Pencil, Trash2, X, Clock, FileText, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { useSEO } from '../hooks/useSEO'

// All possible fuel types (master list)
const ALL_FUEL_TYPES = ['petrol92', 'petrol95', 'diesel', 'lpg']
const FUEL_LABELS = {
  petrol92: { mm: 'ဓာတ်ဆီ (92)', en: 'Petrol 92', icon: '⛽' },
  petrol95: { mm: 'ဓာတ်ဆီ (95)', en: 'Petrol 95', icon: '⛽' },
  diesel:   { mm: 'ဒီဇယ်',       en: 'Diesel',     icon: '🚛' },
  lpg:      { mm: 'LPG ဂတ်',     en: 'LPG Gas',    icon: '🔥' },
}
const STATUS_CFG = {
  available:   { mm: 'ရနိုင်',   en: 'Available', color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/25', dot: 'bg-green-500' },
  limited:     { mm: 'အနည်းငယ်', en: 'Limited',   color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/25', dot: 'bg-amber-500' },
  unavailable: { mm: 'မရ',       en: 'Unavailable',color: 'text-red-400',   bg: 'bg-red-500/15   border-red-500/25',   dot: 'bg-red-500'   },
  unknown:     { mm: 'မသိ',      en: 'Unknown',    color: 'text-white/30',  bg: 'bg-white/5      border-white/8',       dot: 'bg-white/20'  },
}
const QUEUE_LABELS = {
  none:      { mm: 'မတန်းရ',   en: 'No queue'    },
  short:     { mm: 'တန်းတို',   en: 'Short queue' },
  long:      { mm: 'တန်းရှည်',  en: 'Long queue'  },
  very_long: { mm: 'တန်းရှည်မြင်', en: 'Very long' },
}
const COOLDOWN = 5 * 60 * 1000

function timeAgo(iso, lang) {
  if (!iso) return lang === 'mm' ? 'မသိ' : 'Unknown'
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return lang === 'mm' ? 'ယခုလေး' : 'just now'
  if (m < 60) return `${m}${lang === 'mm' ? 'မိနစ်' : 'm'}`
  return `${Math.floor(m/60)}${lang === 'mm' ? 'နာရီ' : 'h'}`
}

// Group rows by station — respects station's fuel_types list
function groupByStation(rows) {
  const map = {}
  for (const row of rows) {
    if (!map[row.station_id]) map[row.station_id] = {
      id: row.station_id,
      name: row.name,
      name_mm: row.name_mm,
      township: row.township,
      address: row.address,
      notes: row.station_notes,
      operating_hours: row.operating_hours,
      phone: row.phone,
      fuel_types: row.fuel_types || ALL_FUEL_TYPES, // per-station fuel types
      fuels: {}
    }
    map[row.station_id].fuels[row.fuel_id] = row
  }
  return Object.values(map)
}

function StationCard({ station, lang, onReport }) {
  const [expanded, setExpanded] = useState(false)
  // Use station's own fuel_types list (not hardcoded ALL_FUEL_TYPES)
  const stationFuelTypes = station.fuel_types || ALL_FUEL_TYPES
  const allAvail = stationFuelTypes.every(ft => station.fuels[ft]?.status === 'available')
  const anyAvail = stationFuelTypes.some(ft => station.fuels[ft]?.status === 'available')

  return (
    <div className={`card-dark rounded-2xl overflow-hidden border ${allAvail ? 'border-green-500/20' : anyAvail ? 'border-amber-500/15' : 'border-white/6'}`}>
      {/* Station header */}
      <button className="w-full flex items-start gap-3 p-4 text-left" onClick={() => setExpanded(e => !e)}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl ${allAvail ? 'bg-green-500/15' : anyAvail ? 'bg-amber-500/10' : 'bg-white/5'}`}>
          ⛽
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-white">{lang === 'mm' ? (station.name_mm || station.name) : station.name}</p>
          <p className="text-[10px] text-white/40 font-myanmar truncate">{station.address} • {station.township}</p>
          {/* Fuel status dots — flex-wrap to prevent overflow */}
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {stationFuelTypes.map(ft => {
              const row = station.fuels[ft]
              const st  = STATUS_CFG[row?.status || 'unknown']
              return (
                <span key={ft} className="flex items-center gap-1 text-[9px] font-bold">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                  <span className={st.color}>{FUEL_LABELS[ft]?.icon || '⛽'}</span>
                </span>
              )
            })}
          </div>
        </div>
        <span className="text-white/30 text-xs mt-1 flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded fuel detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/6 pt-3">
          {/* Station info */}
          <div className="space-y-1.5 pb-2 border-b border-white/5">
            {station.operating_hours && (
              <div className="flex items-start gap-2 text-[10px]">
                <Clock size={12} className="text-white/40 mt-0.5 flex-shrink-0" />
                <span className="text-white/60 font-myanmar">{station.operating_hours}</span>
              </div>
            )}
            {station.phone && (
              <div className="flex items-start gap-2 text-[10px]">
                <span className="text-white/40 flex-shrink-0">📞</span>
                <a href={`tel:${station.phone}`} className="text-blue-400 hover:underline">{station.phone}</a>
              </div>
            )}
            {station.notes && (
              <div className="flex items-start gap-2 text-[10px]">
                <FileText size={12} className="text-white/40 mt-0.5 flex-shrink-0" />
                <span className="text-white/50 font-myanmar">{station.notes}</span>
              </div>
            )}
          </div>

          {/* Fuel types — only show station's own fuel types */}
          {stationFuelTypes.map(ft => {
            const row = station.fuels[ft]
            const st  = STATUS_CFG[row?.status || 'unknown']
            const fl  = FUEL_LABELS[ft]
            if (!fl) return null
            return (
              <div key={ft} className={`rounded-xl border ${st.bg} p-3`}>
                <div className="flex items-center gap-3">
                  <span className="text-lg flex-shrink-0">{fl.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-display font-semibold text-white">{lang === 'mm' ? fl.mm : fl.en}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[10px] font-bold ${st.color}`}>{lang === 'mm' ? st.mm : st.en}</span>
                      {row?.queue_level && row.queue_level !== 'none' && (
                        <span className="text-[9px] text-white/40 flex items-center gap-0.5">
                          <Users size={9} /> {lang === 'mm' ? QUEUE_LABELS[row.queue_level]?.mm : QUEUE_LABELS[row.queue_level]?.en}
                        </span>
                      )}
                      {row?.price && <span className="text-[9px] text-white/40 font-mono">{Number(row.price).toLocaleString()} Ks/L</span>}
                      {row?.reported_at && <span className="text-[9px] text-white/25">{timeAgo(row.reported_at, lang)}</span>}
                    </div>
                    {row?.notes && <p className="text-[10px] text-white/40 mt-0.5 font-myanmar">{row.notes}</p>}
                  </div>
                  {/* Report buttons — stacked vertically, flex-shrink-0 to prevent overflow */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {['available', 'limited', 'unavailable'].map(s => (
                      <button key={s} onClick={() => onReport(station, ft, s)}
                        className={`text-[8px] font-bold px-2 py-1 rounded-lg border transition-colors whitespace-nowrap ${
                          row?.status === s
                            ? STATUS_CFG[s].bg + ' ' + STATUS_CFG[s].color
                            : 'bg-white/5 border-white/10 text-white/30 hover:text-white/60'
                        }`}>
                        {s === 'available' ? (lang === 'mm' ? 'ရ' : 'Yes') :
                         s === 'limited'   ? (lang === 'mm' ? 'နည်း' : 'Few') :
                                             (lang === 'mm' ? 'မရ' : 'No')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ── Manage Fuel Stations Modal ────────────────────────────────
function ManageFuelStationsModal({ onClose, onUpdated, lang }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({
    name: '', name_mm: '', township: '', address: '', phone: '', notes: '', operating_hours: '',
    fuel_types: [...ALL_FUEL_TYPES]
  })
  const [form, setForm] = useState({
    name: '', name_mm: '', township: '', address: '', phone: '', notes: '', operating_hours: '',
    fuel_types: [...ALL_FUEL_TYPES]
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setEdit = (k, v) => setEditData(f => ({ ...f, [k]: v }))

  // Toggle a fuel type in the form's fuel_types array
  function toggleFuelType(fuelType, isEdit = false) {
    if (isEdit) {
      setEditData(f => ({
        ...f,
        fuel_types: f.fuel_types.includes(fuelType)
          ? f.fuel_types.filter(t => t !== fuelType)
          : [...f.fuel_types, fuelType]
      }))
    } else {
      setForm(f => ({
        ...f,
        fuel_types: f.fuel_types.includes(fuelType)
          ? f.fuel_types.filter(t => t !== fuelType)
          : [...f.fuel_types, fuelType]
      }))
    }
  }

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('fuel_stations').select('*').order('sort_order')
    setList(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addStation() {
    if (!form.name.trim()) return
    if (form.fuel_types.length === 0) {
      alert(lang === 'mm' ? 'လောင်စာဆီ အမျိုးအစားတစ်ခုတော့ ရွေးပါ' : 'Select at least one fuel type')
      return
    }
    setSaving(true)
    await supabase.from('fuel_stations').insert({
      name: form.name.trim(),
      name_mm: form.name_mm.trim() || form.name.trim(),
      township: form.township.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
      operating_hours: form.operating_hours.trim() || null,
      sort_order: list.length + 1,
      fuel_types: form.fuel_types,
      is_active: true,
    })
    setForm({ name: '', name_mm: '', township: '', address: '', phone: '', notes: '', operating_hours: '', fuel_types: [...ALL_FUEL_TYPES] })
    await load()
    setSaving(false)
    onUpdated()
  }

  async function saveEdit(id) {
    if (!editData.name.trim()) return
    if (editData.fuel_types.length === 0) {
      alert(lang === 'mm' ? 'လောင်စာဆီ အမျိုးအစားတစ်ခုတော့ ရွေးပါ' : 'Select at least one fuel type')
      return
    }
    await supabase.from('fuel_stations').update({
      name: editData.name.trim(),
      name_mm: editData.name_mm.trim(),
      township: editData.township.trim() || null,
      address: editData.address.trim() || null,
      phone: editData.phone.trim() || null,
      notes: editData.notes.trim() || null,
      operating_hours: editData.operating_hours.trim() || null,
      fuel_types: editData.fuel_types,
    }).eq('id', id)
    setEditId(null)
    load(); onUpdated()
  }

  async function deleteStation(id) {
    if (!confirm(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete this station?')) return
    await supabase.from('fuel_stations').delete().eq('id', id)
    load(); onUpdated()
  }

  // Fuel type selector component (reusable for add/edit)
  function FuelTypeSelector({ selected, onToggle }) {
    return (
      <div>
        <label className="block text-[10px] text-white/50 mb-1.5">
          {lang === 'mm' ? '⛽ ရနိုင်သော လောင်စာဆီ အမျိုးအစားများ' : '⛽ Available Fuel Types'}
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {ALL_FUEL_TYPES.map(ft => {
            const fl = FUEL_LABELS[ft]
            const isSelected = selected.includes(ft)
            return (
              <button
                key={ft}
                type="button"
                onClick={() => onToggle(ft)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                  isSelected
                    ? 'bg-green-500/20 border-green-500/40 text-green-300'
                    : 'bg-white/5 border-white/10 text-white/30 hover:text-white/50'
                }`}
              >
                <span className="text-base">{fl.icon}</span>
                <span className="font-myanmar truncate">{lang === 'mm' ? fl.mm : fl.en}</span>
                {isSelected && <span className="ml-auto text-green-400 text-[10px]">✓</span>}
              </button>
            )
          })}
        </div>
        {selected.length === 0 && (
          <p className="text-[10px] text-red-400 mt-1 font-myanmar">
            {lang === 'mm' ? '⚠ အနည်းဆုံး တစ်ခု ရွေးပါ' : '⚠ Select at least one'}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#140020]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0">
          <X size={18} className="text-white" />
        </button>
        <h2 className="font-display font-bold text-base text-white">⛽ {lang === 'mm' ? 'ဓာတ်ဆီဆိုင် စီမံမည်' : 'Manage Fuel Stations'}</h2>
        <div className="w-9" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-6">
        {/* Add new */}
        <div className="space-y-2 p-3 rounded-2xl bg-white/3 border border-white/8">
          <p className="text-xs text-white/50 font-display font-semibold">{lang === 'mm' ? '➕ ဆိုင်အသစ်ထည့်မည်' : '➕ Add New Station'}</p>
          <input
            autoFocus
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder={lang === 'mm' ? 'ဆိုင်အမည် (English) *' : 'Station name (English) *'}
            className="input-dark text-sm w-full"
          />
          <input
            value={form.name_mm}
            onChange={e => set('name_mm', e.target.value)}
            placeholder={lang === 'mm' ? 'ဆိုင်အမည် (မြန်မာ)' : 'Station name (Myanmar)'}
            className="input-dark font-myanmar text-sm w-full"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.township}
              onChange={e => set('township', e.target.value)}
              placeholder={lang === 'mm' ? 'မြို့နယ်' : 'Township'}
              className="input-dark text-sm"
            />
            <input
              value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder={lang === 'mm' ? 'လိပ်စာ' : 'Address'}
              className="input-dark font-myanmar text-sm"
            />
          </div>
          <input
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder={lang === 'mm' ? 'ဖုန်းနံပါတ်' : 'Phone number'}
            className="input-dark text-sm w-full"
          />
          <input
            value={form.operating_hours}
            onChange={e => set('operating_hours', e.target.value)}
            placeholder={lang === 'mm' ? 'လုပ်ငန်းအချိန် (e.g., 6:00 AM - 10:00 PM)' : 'Operating hours'}
            className="input-dark text-sm w-full"
          />
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder={lang === 'mm' ? 'မှတ်ချက်များ' : 'Notes'}
            className="input-dark font-myanmar text-sm w-full h-16 resize-none"
          />
          {/* Fuel type selector */}
          <FuelTypeSelector
            selected={form.fuel_types}
            onToggle={ft => toggleFuelType(ft, false)}
          />
          <button
            onClick={addStation}
            disabled={!form.name.trim() || saving || form.fuel_types.length === 0}
            className="btn-primary w-full text-sm disabled:opacity-50"
          >
            {saving ? '...' : lang === 'mm' ? 'ထည့်မည်' : 'Add Station'}
          </button>
        </div>

        {/* Station list */}
        <div className="space-y-2">
          {loading ? [1, 2, 3].map(n => <div key={n} className="h-14 rounded-xl shimmer" />) :
            list.length === 0 ? (
              <p className="text-center text-white/30 text-sm py-8 font-myanmar">{lang === 'mm' ? 'ဆိုင်မရှိသေး' : 'No stations yet'}</p>
            ) :
            list.map(s => (
              <div key={s.id} className="rounded-xl bg-white/5 border border-white/8 overflow-hidden">
                {editId === s.id ? (
                  <div className="p-3 space-y-2">
                    <input
                      value={editData.name}
                      onChange={e => setEdit('name', e.target.value)}
                      placeholder="Station name (EN) *"
                      className="input-dark text-sm w-full"
                    />
                    <input
                      value={editData.name_mm}
                      onChange={e => setEdit('name_mm', e.target.value)}
                      placeholder="ဆိုင်အမည် (မြန်မာ)"
                      className="input-dark font-myanmar text-sm w-full"
                    />
                    <input
                      value={editData.township}
                      onChange={e => setEdit('township', e.target.value)}
                      placeholder="Township"
                      className="input-dark text-sm w-full"
                    />
                    <input
                      value={editData.address}
                      onChange={e => setEdit('address', e.target.value)}
                      placeholder="Address"
                      className="input-dark text-sm w-full"
                    />
                    <input
                      value={editData.phone}
                      onChange={e => setEdit('phone', e.target.value)}
                      placeholder="Phone"
                      className="input-dark text-sm w-full"
                    />
                    <input
                      value={editData.operating_hours}
                      onChange={e => setEdit('operating_hours', e.target.value)}
                      placeholder="Operating hours"
                      className="input-dark text-sm w-full"
                    />
                    <textarea
                      value={editData.notes}
                      onChange={e => setEdit('notes', e.target.value)}
                      placeholder="Notes"
                      className="input-dark font-myanmar text-sm w-full h-12 resize-none"
                    />
                    {/* Fuel type selector for edit */}
                    <FuelTypeSelector
                      selected={editData.fuel_types}
                      onToggle={ft => toggleFuelType(ft, true)}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(s.id)}
                        disabled={editData.fuel_types.length === 0}
                        className="flex-1 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-xs font-bold disabled:opacity-50"
                      >
                        ✓ Save
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="flex-1 px-3 py-1.5 bg-white/8 rounded-lg text-white/40 text-xs"
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-myanmar font-semibold truncate">{s.name_mm || s.name}</p>
                        <p className="text-[10px] text-white/40 truncate">{s.address} • {s.township}</p>
                        {s.operating_hours && <p className="text-[9px] text-white/30 mt-0.5">⏰ {s.operating_hours}</p>}
                        {s.phone && <p className="text-[9px] text-blue-400 mt-0.5">📞 {s.phone}</p>}
                        {s.notes && <p className="text-[9px] text-white/40 mt-0.5 font-myanmar line-clamp-1">{s.notes}</p>}
                        {/* Show fuel types as badges */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(s.fuel_types || ALL_FUEL_TYPES).map(ft => (
                            <span key={ft} className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/8 text-white/50 font-semibold">
                              {FUEL_LABELS[ft]?.icon} {lang === 'mm' ? FUEL_LABELS[ft]?.mm : FUEL_LABELS[ft]?.en}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => {
                            setEditId(s.id)
                            setEditData({
                              name: s.name,
                              name_mm: s.name_mm || '',
                              township: s.township || '',
                              address: s.address || '',
                              phone: s.phone || '',
                              notes: s.notes || '',
                              operating_hours: s.operating_hours || '',
                              fuel_types: s.fuel_types || [...ALL_FUEL_TYPES],
                            })
                          }}
                          className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center flex-shrink-0 hover:bg-blue-500/20"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => deleteStation(s.id)}
                          className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center flex-shrink-0 hover:bg-red-500/20"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

export default function FuelPage() {
  const { lang } = useLang()
  const { isModerator } = useAuth()
  useSEO({ title: lang === 'mm' ? 'ဓာတ်ဆီ/ဒီဇယ် အခြေအနေ' : 'Fuel Availability' })

  const [stations, setStations] = useState([])
  const [loading, setLoading]   = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [toast, setToast]       = useState(null)
  const [showManage, setShowManage] = useState(false)
  const channelRef = useRef(null)

  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase.from('current_fuel_status').select('*')
      setStations(groupByStation(data || []))
      setLastUpdate(new Date())
    } catch (e) { console.warn(e) }
    setLoading(false)
  }

  useEffect(() => {
    load()
    channelRef.current = supabase.channel('fuel-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fuel_reports' }, load)
      .subscribe()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  async function handleReport(station, fuelType, status) {
    const key  = `fuel_${station.id}_${fuelType}`
    const last = localStorage.getItem(key)
    if (last && Date.now() - parseInt(last) < COOLDOWN) {
      setToast({ type: 'warn', msg: lang === 'mm' ? '၅ မိနစ်နောက်မှ ထပ်တင်ပြနိုင်' : 'Wait 5 min before re-reporting' })
      setTimeout(() => setToast(null), 3000); return
    }
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('fuel_reports').insert({
      station_id: station.id, fuel_type: fuelType, status,
      reporter_id: user?.id || null,
    })
    localStorage.setItem(key, String(Date.now()))
    const fl   = FUEL_LABELS[fuelType]
    const st   = STATUS_CFG[status]
    setToast({
      type: status === 'available' ? 'ok' : status === 'limited' ? 'warn' : 'err',
      msg: `${fl?.icon || '⛽'} ${lang === 'mm' ? fl?.mm : fl?.en} — ${lang === 'mm' ? st.mm : st.en}`
    })
    setTimeout(() => setToast(null), 3000)
  }

  // Count stations that have at least one available fuel type
  const available = stations.filter(s => {
    const fuelTypes = s.fuel_types || ALL_FUEL_TYPES
    return fuelTypes.some(ft => s.fuels[ft]?.status === 'available')
  }).length

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-xl text-white">
              ⛽ {lang === 'mm' ? 'ဓာတ်ဆီ/ဒီဇယ် အခြေအနေ' : 'Fuel Status'}
            </h1>
            <p className="text-xs text-white/40 mt-0.5 font-myanmar">
              {lang === 'mm' ? 'Gas Station ဓာတ်ဆီ ရမရ • Real-time' : 'Community-reported fuel availability'}
            </p>
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-1 text-[10px] text-brand-300 mt-1 flex-shrink-0">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {lastUpdate && !loading ? timeAgo(lastUpdate.toISOString(), lang) : '...'}
          </button>
        </div>
      </div>

      {isModerator && (
        <button
          onClick={() => setShowManage(true)}
          className="mx-4 mb-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/50 hover:bg-white/8 transition-colors"
        >
          <Pencil size={12} /> {lang === 'mm' ? '⛽ ဓာတ်ဆီဆိုင် စီမံမည်' : '⛽ Manage Fuel Stations'}
        </button>
      )}

      {/* Summary */}
      <div className="flex gap-2 px-4 mb-4">
        <div className="flex-1 p-3 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
          <p className="font-display font-bold text-xl text-green-400">{available}</p>
          <p className="text-[9px] text-green-400/60">{lang === 'mm' ? 'ဓာတ်ဆီဆိုင် ရနိုင်' : 'Stations OK'}</p>
        </div>
        <div className="flex-1 p-3 rounded-2xl bg-white/5 border border-white/8 text-center">
          <p className="font-display font-bold text-xl text-white/60">{stations.length}</p>
          <p className="text-[9px] text-white/30">{lang === 'mm' ? 'ဆိုင်ပေါင်း' : 'Total stations'}</p>
        </div>
        <div className="flex-1 p-3 rounded-2xl bg-white/5 border border-white/8 text-center">
          <div className="flex items-center justify-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p className="font-display font-bold text-sm text-green-400">Live</p>
          </div>
          <p className="text-[9px] text-white/25">6hr</p>
        </div>
      </div>

      <div className="px-4 space-y-2 mb-4">
        {loading
          ? [1, 2, 3].map(n => <div key={n} className="h-24 rounded-2xl shimmer" />)
          : stations.map(s => (
              <StationCard key={s.id} station={s} lang={lang} onReport={handleReport} />
            ))
        }
      </div>

      <div className="mx-4 card-dark rounded-2xl p-4">
        <p className="text-[10px] text-white/30 font-myanmar">
          ⛽ {lang === 'mm'
            ? 'Report လုပ်ရန် Station ကို နှိပ်ပြဲ့ပြီး ⛽ ကိုနှိပ်ပါ • ၅ မိနစ် Cooldown • ၆ နာရီအတွင်း Report မှ Data ဖြစ်သည်'
            : 'Tap a station to expand, then tap fuel type to report status • 5 min cooldown • Data from last 6 hours'}
        </p>
      </div>

      {showManage && (
        <ManageFuelStationsModal
          lang={lang}
          onClose={() => setShowManage(false)}
          onUpdated={load}
        />
      )}

      {toast && (
        <div className={`fixed bottom-28 left-4 right-4 max-w-lg mx-auto z-[300] flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-myanmar ${
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
