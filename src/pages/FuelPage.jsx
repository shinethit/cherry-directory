import { useState, useEffect, useRef } from 'react'
import { Fuel, RefreshCw, CheckCircle, AlertCircle, Users, Plus, Pencil, Trash2, X, Clock, FileText, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { useSEO } from '../hooks/useSEO'

const STATUS_CFG = {
  available:   { mm: 'ရနိုင်',   en: 'Available', color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/25', dot: 'bg-green-500' },
  limited:     { mm: 'အနည်းငယ်', en: 'Limited',   color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/25', dot: 'bg-amber-500' },
  unavailable: { mm: 'မရ',       en: 'Unavailable',color: 'text-red-400',   bg: 'bg-red-500/15   border-red-500/25',   dot: 'bg-red-500'   },
  unknown:     { mm: 'မသိ',      en: 'Unknown',    color: 'text-white/30',  bg: 'bg-white/5      border-white/8',       dot: 'bg-white/20'  },
}

function timeAgo(iso, lang) {
  if (!iso) return lang === 'mm' ? 'မသိ' : 'Unknown'
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return lang === 'mm' ? 'ယခုလေး' : 'just now'
  if (m < 60) return `${m}${lang === 'mm' ? 'မိနစ်' : 'm'}`
  return `${Math.floor(m/60)}${lang === 'mm' ? 'နာရီ' : 'h'}`
}

function groupByStation(rows, allFuelTypes) {
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
      fuel_type_names: row.fuel_type_names || [], // Dynamic fuel type names
      fuels: {} 
    }
    map[row.station_id].fuels[row.fuel_id] = row
  }
  return Object.values(map)
}

function StationCard({ station, lang, onReport, allFuelTypes }) {
  const [expanded, setExpanded] = useState(false)
  const stationFuelNames = station.fuel_type_names || []
  const stationFuels = allFuelTypes.filter(ft => stationFuelNames.includes(ft.name))
  
  const anyAvail = stationFuels.some(ft => station.fuels[ft.name]?.status === 'available')

  return (
    <div className={`card-dark rounded-2xl overflow-hidden border ${anyAvail ? 'border-green-500/20' : 'border-white/6'}`}>
      <button className="w-full flex items-start gap-3 p-4 text-left" onClick={() => setExpanded(e => !e)}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl ${anyAvail ? 'bg-green-500/15' : 'bg-white/5'}`}>
          ⛽
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-white truncate">{lang === 'mm' ? (station.name_mm || station.name) : station.name}</p>
          <p className="text-[10px] text-white/40 font-myanmar truncate">{station.address} • {station.township}</p>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {stationFuels.map(ft => {
              const row = station.fuels[ft.name]
              const st  = STATUS_CFG[row?.status || 'unknown']
              return (
                <span key={ft.id} className="flex items-center gap-1 text-[9px] font-bold">
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  <span className={st.color}>{ft.icon}</span>
                </span>
              )
            })}
          </div>
        </div>
        <span className="text-white/30 text-xs mt-1 flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/6 pt-3">
          {stationFuels.map(ft => {
            const row = station.fuels[ft.name]
            const st  = STATUS_CFG[row?.status || 'unknown']
            return (
              <div key={ft.id} className={`flex items-center gap-3 p-3 rounded-xl border ${st.bg}`}>
                <span className="text-lg flex-shrink-0">{ft.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-display font-semibold text-white">{lang === 'mm' ? ft.name_mm : ft.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-[10px] font-bold ${st.color}`}>{lang === 'mm' ? st.mm : st.en}</span>
                    {row?.reported_at && <span className="text-[9px] text-white/25">{timeAgo(row.reported_at, lang)}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {['available','limited','unavailable'].map(s => (
                    <button key={s} onClick={() => onReport(station, ft.name, s)}
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

function ManageFuelStationsModal({ onClose, onUpdated, lang, allFuelTypes }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({ name: '', name_mm: '', township: '', address: '', phone: '', notes: '', operating_hours: '', fuel_type_names: [] })
  const [form, setForm] = useState({ name: '', name_mm: '', township: '', address: '', phone: '', notes: '', operating_hours: '', fuel_type_names: [] })
  
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setEdit = (k, v) => setEditData(f => ({ ...f, [k]: v }))

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
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
      operating_hours: form.operating_hours.trim() || null,
      sort_order: list.length + 1,
      fuel_type_names: form.fuel_type_names,
      is_active: true,
    })
    setForm({ name: '', name_mm: '', township: '', address: '', phone: '', notes: '', operating_hours: '', fuel_type_names: [] })
    await load(); onUpdated(); setSaving(false)
  }

  async function saveEdit(id) {
    if (!editData.name.trim()) return
    await supabase.from('fuel_stations').update({ 
      name: editData.name.trim(), 
      name_mm: editData.name_mm.trim(),
      township: editData.township.trim() || null,
      address: editData.address.trim() || null,
      phone: editData.phone.trim() || null,
      notes: editData.notes.trim() || null,
      operating_hours: editData.operating_hours.trim() || null,
      fuel_type_names: editData.fuel_type_names,
    }).eq('id', id)
    setEditId(null); load(); onUpdated()
  }

  async function deleteStation(id) {
    if (!confirm('ဖျက်မည်လား?')) return
    await supabase.from('fuel_stations').delete().eq('id', id)
    load(); onUpdated()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#140020]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0"><X size={18} className="text-white" /></button>
        <h2 className="font-display font-bold text-base text-white">ဓာတ်ဆီဆိုင် စီမံမည်</h2>
        <div className="w-9" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-6">
        <div className="space-y-2 p-3 rounded-2xl bg-white/3 border border-white/8">
          <p className="text-xs text-white/50 font-bold">➕ ဆိုင်အသစ်ထည့်မည်</p>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Station Name" className="input-dark text-sm w-full" />
          <input value={form.name_mm} onChange={e => set('name_mm', e.target.value)} placeholder="အမည် (မြန်မာ)" className="input-dark text-sm w-full font-myanmar" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.township} onChange={e => set('township', e.target.value)} placeholder="မြို့နယ်" className="input-dark text-sm" />
            <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="လိပ်စာ" className="input-dark text-sm" />
          </div>
          <p className="text-[10px] text-white/40 font-bold uppercase mt-2">လောင်စာဆီ အမျိုးအစားများ</p>
          <div className="grid grid-cols-2 gap-2">
            {allFuelTypes.map(ft => (
              <label key={ft.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-white/5 border border-white/10">
                <input type="checkbox" checked={form.fuel_type_names.includes(ft.name)} onChange={e => {
                  const val = e.target.checked ? [...form.fuel_type_names, ft.name] : form.fuel_type_names.filter(n => n !== ft.name)
                  set('fuel_type_names', val)
                }} className="w-4 h-4" />
                <span className="text-xs text-white/70">{ft.icon} {ft.name_mm}</span>
              </label>
            ))}
          </div>
          <button onClick={addStation} disabled={saving} className="btn-primary w-full text-xs font-bold py-2.5 mt-2">{saving ? '...' : 'ထည့်မည်'}</button>
        </div>
        <div className="space-y-2">
          {list.map(s => (
            <div key={s.id} className="rounded-xl bg-white/5 border border-white/8 p-3">
              {editId === s.id ? (
                <div className="space-y-2">
                  <input value={editData.name} onChange={e => setEdit('name', e.target.value)} className="input-dark text-sm w-full" />
                  <input value={editData.name_mm} onChange={e => setEdit('name_mm', e.target.value)} className="input-dark text-sm w-full font-myanmar" />
                  <div className="grid grid-cols-2 gap-2">
                    {allFuelTypes.map(ft => (
                      <label key={ft.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-white/5 border border-white/10">
                        <input type="checkbox" checked={editData.fuel_type_names.includes(ft.name)} onChange={e => {
                          const val = e.target.checked ? [...editData.fuel_type_names, ft.name] : editData.fuel_type_names.filter(n => n !== ft.name)
                          setEdit('fuel_type_names', val)
                        }} className="w-4 h-4" />
                        <span className="text-xs text-white/70">{ft.icon} {ft.name_mm}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(s.id)} className="flex-1 px-3 py-2 bg-green-500 text-white text-xs font-bold rounded-xl">SAVE</button>
                    <button onClick={() => setEditId(null)} className="flex-1 px-3 py-2 bg-white/8 text-white/40 text-xs rounded-xl">CANCEL</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white font-myanmar">{s.name_mm || s.name}</p>
                    <p className="text-[10px] text-white/40">{s.address} • {s.township}</p>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {(s.fuel_type_names || []).map(name => {
                        const ft = allFuelTypes.find(f => f.name === name)
                        return ft ? <span key={ft.id} className="text-[8px] px-1.5 py-0.5 rounded-full bg-brand-600/20 text-brand-300 border border-brand-500/20">{ft.icon} {ft.name_mm}</span> : null
                      })}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditId(s.id); setEditData(s) }} className="w-7 h-7 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center"><Pencil size={12} /></button>
                    <button onClick={() => deleteStation(s.id)} className="w-7 h-7 bg-red-500/10 text-red-400 rounded-lg flex items-center justify-center"><Trash2 size={12} /></button>
                  </div>
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
  useSEO({ title: 'Fuel Availability' })

  const [stations, setStations] = useState([])
  const [allFuelTypes, setAllFuelTypes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showManage, setShowManage] = useState(false)
  const [toast, setToast]       = useState(null)

  async function load() {
    setLoading(true)
    try {
      const { data: ftData } = await supabase.from('fuel_types').select('*').order('sort_order')
      setAllFuelTypes(ftData || [])
      const { data: stData } = await supabase.from('current_fuel_status').select('*')
      setStations(groupByStation(stData || [], ftData || []))
    } catch (e) { console.warn(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleReport(station, fuelType, status) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('fuel_reports').insert({
      station_id: station.id, fuel_type: fuelType, status,
      reporter_id: user?.id || null,
    })
    setToast({ msg: 'Report တင်ပြီးပါပြီ' }); setTimeout(() => setToast(null), 3000); load()
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <h1 className="font-display font-bold text-xl text-white">⛽ Fuel Status</h1>
        <button onClick={load} className="text-brand-300"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      {isModerator && (
        <button onClick={() => setShowManage(true)} className="mx-4 mb-3 w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/50 font-bold">⛽ ဓာတ်ဆီဆိုင် စီမံမည်</button>
      )}

      <div className="px-4 space-y-2">
        {stations.map(s => <StationCard key={s.id} station={s} lang={lang} onReport={handleReport} allFuelTypes={allFuelTypes} />)}
      </div>

      {showManage && <ManageFuelStationsModal lang={lang} onClose={() => setShowManage(false)} onUpdated={load} allFuelTypes={allFuelTypes} />}
      
      {toast && (
        <div className="fixed bottom-28 left-4 right-4 z-[300] bg-green-500/20 border border-green-500/40 text-green-300 px-4 py-3 rounded-2xl text-center text-sm font-myanmar">
          {toast.msg}
        </div>
      )}
    </div>
  )
}
