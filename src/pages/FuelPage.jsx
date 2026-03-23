import { useState, useEffect, useRef } from 'react'
import { Fuel, RefreshCw, CheckCircle, AlertCircle, Users, Plus, Pencil, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { useSEO } from '../hooks/useSEO'

const FUEL_TYPES = ['petrol92','petrol95','diesel','lpg']
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

// Group rows by station
function groupByStation(rows) {
  const map = {}
  for (const row of rows) {
    if (!map[row.station_id]) map[row.station_id] = { id: row.station_id, name: row.name, name_mm: row.name_mm, township: row.township, address: row.address, fuels: {} }
    map[row.station_id].fuels[row.fuel_id] = row
  }
  return Object.values(map)
}

function StationCard({ station, lang, onReport }) {
  const [expanded, setExpanded] = useState(false)
  const allAvail = FUEL_TYPES.every(ft => station.fuels[ft]?.status === 'available')
  const anyAvail = FUEL_TYPES.some(ft => station.fuels[ft]?.status === 'available')

  return (
    <div className={`card-dark rounded-2xl overflow-hidden border ${allAvail ? 'border-green-500/20' : anyAvail ? 'border-amber-500/15' : 'border-white/6'}`}>
      {/* Station header */}
      <button className="w-full flex items-start gap-3 p-4 text-left" onClick={() => setExpanded(e => !e)}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl ${allAvail ? 'bg-green-500/15' : anyAvail ? 'bg-amber-500/10' : 'bg-white/5'}`}>
          ⛽
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-white">{lang === 'mm' ? (station.name_mm || station.name) : station.name}</p>
          <p className="text-[10px] text-white/40 font-myanmar">{station.address} • {station.township}</p>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {FUEL_TYPES.map(ft => {
              const row = station.fuels[ft]
              const st  = STATUS_CFG[row?.status || 'unknown']
              return (
                <span key={ft} className="flex items-center gap-1 text-[9px] font-bold">
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  <span className={st.color}>{FUEL_LABELS[ft].icon}</span>
                </span>
              )
            })}
          </div>
        </div>
        <span className="text-white/30 text-xs mt-1">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded fuel detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/6 pt-3">
          {FUEL_TYPES.map(ft => {
            const row = station.fuels[ft]
            const st  = STATUS_CFG[row?.status || 'unknown']
            const fl  = FUEL_LABELS[ft]
            return (
              <div key={ft} className={`flex items-center gap-3 p-3 rounded-xl border ${st.bg}`}>
                <span className="text-lg flex-shrink-0">{fl.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-display font-semibold text-white">{lang === 'mm' ? fl.mm : fl.en}</p>
                  <div className="flex items-center gap-2 mt-0.5">
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
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {['available','limited','unavailable'].map(s => (
                    <button key={s} onClick={() => onReport(station, ft, s)}
                      className={`text-[8px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                        row?.status === s ? STATUS_CFG[s].bg + ' ' + STATUS_CFG[s].color : 'bg-white/5 border-white/10 text-white/30 hover:text-white/60'
                      }`}>
                      {s === 'available' ? (lang === 'mm' ? 'ရ' : 'Yes') :
                       s === 'limited'   ? (lang === 'mm' ? 'နည်း' : 'Few') :
                                           (lang === 'mm' ? 'မရ' : 'No')}
                    </button>
                  ))}
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
  const [editName, setEditName] = useState('')
  const [form, setForm] = useState({ name: '', name_mm: '', township: '', address: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('fuel_stations').select('*').order('sort_order')
    setList(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addStation() {
    if (!form.name.trim()) return
    setSaving(true)
    await supabase.from('fuel_stations').insert({
      name: form.name.trim(),
      name_mm: form.name_mm.trim() || form.name.trim(),
      township: form.township.trim() || null,
      address: form.address.trim() || null,
      sort_order: list.length + 1,
    })
    setForm({ name: '', name_mm: '', township: '', address: '' })
    await load()
    setSaving(false)
    onUpdated()
  }

  async function saveEdit(id) {
    if (!editName.trim()) return
    await supabase.from('fuel_stations').update({ name: editName.trim(), name_mm: editName.trim() }).eq('id', id)
    setEditId(null)
    load(); onUpdated()
  }

  async function deleteStation(id) {
    if (!confirm(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete this station?')) return
    await supabase.from('fuel_stations').delete().eq('id', id)
    load(); onUpdated()
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
          <input autoFocus value={form.name} onChange={e => set('name', e.target.value)}
            placeholder={lang === 'mm' ? 'ဆိုင်အမည် (English) *' : 'Station name (English) *'}
            className="input-dark text-sm w-full" />
          <input value={form.name_mm} onChange={e => set('name_mm', e.target.value)}
            placeholder={lang === 'mm' ? 'ဆိုင်အမည် (မြန်မာ)' : 'Station name (Myanmar)'}
            className="input-dark font-myanmar text-sm w-full" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.township} onChange={e => set('township', e.target.value)}
              placeholder={lang === 'mm' ? 'မြို့နယ်' : 'Township'}
              className="input-dark text-sm" />
            <input value={form.address} onChange={e => set('address', e.target.value)}
              placeholder={lang === 'mm' ? 'လိပ်စာ' : 'Address'}
              className="input-dark font-myanmar text-sm" />
          </div>
          <button onClick={addStation} disabled={!form.name.trim() || saving}
            className="btn-primary w-full text-sm disabled:opacity-50">
            {saving ? '...' : lang === 'mm' ? 'ထည့်မည်' : 'Add Station'}
          </button>
        </div>

        {/* Station list */}
        <div className="space-y-2">
          {loading ? [1,2,3].map(n => <div key={n} className="h-14 rounded-xl shimmer" />) :
           list.length === 0 ? (
            <p className="text-center text-white/30 text-sm py-8 font-myanmar">{lang === 'mm' ? 'ဆိုင်မရှိသေး' : 'No stations yet'}</p>
           ) :
           list.map(s => (
            <div key={s.id} className="rounded-xl bg-white/5 border border-white/8">
              {editId === s.id ? (
                <div className="flex gap-2 p-2">
                  <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(s.id); if (e.key === 'Escape') setEditId(null) }}
                    className="input-dark flex-1 text-sm py-1.5" />
                  <button onClick={() => saveEdit(s.id)} className="px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-xs font-bold">✓</button>
                  <button onClick={() => setEditId(null)} className="px-3 py-1.5 bg-white/8 rounded-lg text-white/40 text-xs">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3">
                  <span className="text-xl flex-shrink-0">⛽</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-myanmar truncate">{s.name_mm || s.name}</p>
                    {s.township && <p className="text-[10px] text-white/40">{s.township}</p>}
                  </div>
                  <button onClick={() => { setEditId(s.id); setEditName(s.name_mm || s.name) }}
                    className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center flex-shrink-0">
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => deleteStation(s.id)}
                    className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center flex-shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
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
    setToast({ type: status === 'available' ? 'ok' : status === 'limited' ? 'warn' : 'err',
      msg: `${fl.icon} ${lang === 'mm' ? fl.mm : fl.en} — ${lang === 'mm' ? st.mm : st.en}` })
    setTimeout(() => setToast(null), 3000)
  }

  const available = stations.filter(s => FUEL_TYPES.some(ft => s.fuels[ft]?.status === 'available')).length

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              ⛽ {lang === 'mm' ? 'ဓာတ်ဆီ/ဒီဇယ် အခြေအနေ' : 'Fuel Status'}
            </h1>
            <p className="text-xs text-white/40 mt-0.5 font-myanmar">
              {lang === 'mm' ? 'Gas Station ဓာတ်ဆီ ရမရ • Real-time' : 'Community-reported fuel availability'}
            </p>
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-1 text-[10px] text-brand-300 mt-1">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {lastUpdate && !loading ? timeAgo(lastUpdate.toISOString(), lang) : '...'}
          </button>
        </div>
      </div>

      {isModerator && (
        <button onClick={() => setShowManage(true)}
          className="mx-4 mb-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/50 hover:bg-white/8 transition-colors">
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
        {loading ? [1,2,3].map(n => <div key={n} className="h-24 rounded-2xl shimmer" />) :
         stations.map(s => <StationCard key={s.id} station={s} lang={lang} onReport={handleReport} />)}
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
