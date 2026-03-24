ရပါတယ်ဗျ။ Code တွေ အများကြီးဆိုတော့ ရှာရတာ မျက်စိလည်သွားတတ်ပါတယ်။ 

သင့်ရဲ့ `FuelPage.jsx` ဖိုင်ထဲက Code အဟောင်းတွေ အကုန်လုံးကို ဖျက်ပြီး၊ အောက်က Code အသစ် အပြည့်အစုံကိုသာ Copy ကူးပြီး Paste ချလိုက်ပါဗျ။ (အောက်ဆုံးထိ Scroll ဆွဲလို့ရတဲ့ အပိုင်းတွေရော၊ "How it works" အပိုင်းပါ အကုန် ထည့်သွင်းပေးထားပါတယ်)။

```jsx
import { useState, useEffect } from 'react'
import { RefreshCw, Pencil, Trash2, X } from 'lucide-react'
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

// ─── Station Card ────────────────────────────────────────────────────────────
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
            {stationFuels.length === 0 && (
              <span className="text-[9px] text-white/20">ဆီအမျိုးအစား မသတ်မှတ်ရ</span>
            )}
          </div>
        </div>
        <span className="text-white/30 text-xs mt-1 flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/6 pt-3">
          {stationFuels.length === 0 && (
            <p className="text-xs text-white/30 text-center py-2">ဆီအမျိုးအစား မသတ်မှတ်ရသေး</p>
          )}
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

// ─── Fuel Types Tab ──────────────────────────────────────────────────────────
function FuelTypesTab({ onChanged }) {
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [editId, setEditId]   = useState(null)
  const [editData, setEditData] = useState({ name: '', name_mm: '', icon: '', sort_order: 0 })
  const [form, setForm] = useState({ name: '', name_mm: '', icon: '⛽' })

  const set  = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setE = (k, v) => setEditData(f => ({ ...f, [k]: v }))

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('fuel_types').select('*').order('sort_order')
    setList(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addFuelType() {
    if (!form.name.trim() || !form.name_mm.trim()) return
    setSaving(true)
    
    const { error } = await supabase.from('fuel_types').insert({
      name: form.name.trim(),
      name_mm: form.name_mm.trim(),
      icon: form.icon.trim() || '⛽',
      sort_order: list.length + 1,
    })

    if (error) {
      alert("Error saving fuel type: " + error.message)
      setSaving(false)
      return
    }

    setForm({ name: '', name_mm: '', icon: '⛽' })
    await load()
    onChanged?.()
    setSaving(false)
  }

  async function saveEdit(id) {
    if (!editData.name.trim() || !editData.name_mm.trim()) return
    const { error } = await supabase.from('fuel_types').update({
      name: editData.name.trim(),
      name_mm: editData.name_mm.trim(),
      icon: editData.icon.trim() || '⛽',
      sort_order: Number(editData.sort_order) || 0,
    }).eq('id', id)

    if (error) {
      alert("Error updating fuel type: " + error.message)
      return
    }

    setEditId(null)
    await load()
    onChanged?.()
  }

  async function deleteFuelType(id) {
    if (!window.confirm('ဆီအမျိုးအစားကို ဖျက်မည်လား? ဆိုင်များမှ ဆီပိတ်သွားနိုင်သည်။')) return
    const { error } = await supabase.from('fuel_types').delete().eq('id', id)
    
    if (error) {
      alert("Error deleting fuel type: " + error.message)
      return
    }

    await load()
    onChanged?.()
  }

  const EMOJIS = ['⛽', '🔥', '🛢️', '💧', '🚛', '🛵', '⚡']

  return (
    <div className="space-y-4">
      {/* Add form */}
      <div className="space-y-2 p-3 rounded-2xl bg-white/3 border border-white/8">
        <p className="text-xs text-white/50 font-bold">➕ ဆီအမျိုးအစားအသစ် ထည့်မည်</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="Name (English)" className="input-dark text-sm" />
          <input value={form.name_mm} onChange={e => set('name_mm', e.target.value)}
            placeholder="အမည် (မြန်မာ)" className="input-dark text-sm font-myanmar" />
        </div>
        <div>
          <p className="text-[10px] text-white/40 mb-1.5">Icon ရွေးမည် (emoji)</p>
          <div className="flex gap-2 flex-wrap items-center">
            {EMOJIS.map(e => (
              <button key={e} onClick={() => set('icon', e)}
                className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-colors ${
                  form.icon === e ? 'bg-brand-500/30 border-brand-400/60' : 'bg-white/5 border-white/10'
                }`}>{e}</button>
            ))}
            <input value={form.icon} onChange={e => set('icon', e.target.value)}
              className="input-dark text-lg w-14 text-center" maxLength={4} placeholder="✏️" />
          </div>
        </div>
        <button onClick={addFuelType} disabled={saving || !form.name.trim() || !form.name_mm.trim()}
          className="btn-primary w-full text-xs font-bold py-2.5 disabled:opacity-40">
          {saving ? 'သိမ်းနေသည်...' : '+ ဆီအမျိုးအစားထည့်မည်'}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-xs text-white/30 text-center py-4">ဖွင့်နေသည်...</p>
      ) : (
        <div className="space-y-2">
          {list.length === 0 && (
            <p className="text-xs text-white/30 text-center py-4">ဆီအမျိုးအစား မရှိသေးပါ</p>
          )}
          {list.map(ft => (
            <div key={ft.id} className="rounded-xl bg-white/5 border border-white/8 p-3">
              {editId === ft.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editData.name} onChange={e => setE('name', e.target.value)}
                      className="input-dark text-sm" placeholder="Name (English)" />
                    <input value={editData.name_mm} onChange={e => setE('name_mm', e.target.value)}
                      className="input-dark text-sm font-myanmar" placeholder="အမည် (မြန်မာ)" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-white/40">Icon:</span>
                    {EMOJIS.map(e => (
                      <button key={e} onClick={() => setE('icon', e)}
                        className={`w-8 h-8 rounded-lg text-base flex items-center justify-center border transition-colors ${
                          editData.icon === e ? 'bg-brand-500/30 border-brand-400/60' : 'bg-white/5 border-white/10'
                        }`}>{e}</button>
                    ))}
                    <input value={editData.icon} onChange={e => setE('icon', e.target.value)}
                      className="input-dark text-base w-12 text-center" maxLength={4} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(ft.id)}
                      className="flex-1 px-3 py-2 bg-green-500 text-white text-xs font-bold rounded-xl">
                      သိမ်းမည်
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="flex-1 px-3 py-2 bg-white/8 text-white/40 text-xs rounded-xl">
                      ဖျက်သိမ်းမည်
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{ft.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white font-myanmar">{ft.name_mm}</p>
                      <p className="text-[10px] text-white/40">{ft.name}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => { setEditId(ft.id); setEditData(ft) }}
                      className="w-7 h-7 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => deleteFuelType(ft.id)}
                      className="w-7 h-7 bg-red-500/10 text-red-400 rounded-lg flex items-center justify-center">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Manage Modal ────────────────────────────────────────────────────────────
function ManageFuelStationsModal({ onClose, onUpdated, lang, allFuelTypes }) {
  const [modalTab, setModalTab] = useState('stations')
  const [list, setList]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [editId, setEditId]     = useState(null)
  const [editData, setEditData] = useState({ name: '', name_mm: '', township: '', address: '', phone: '', notes: '', operating_hours: '', fuel_type_names: [] })
  const [form, setForm]         = useState({ name: '', name_mm: '', township: '', address: '', phone: '', notes: '', operating_hours: '', fuel_type_names: [] })

  const set  = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setE = (k, v) => setEditData(f => ({ ...f, [k]: v }))

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
    
    const { error } = await supabase.from('fuel_stations').insert({
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

    if (error) {
      alert("Error adding station: " + error.message)
      setSaving(false)
      return
    }

    setForm({ name: '', name_mm: '', township: '', address: '', phone: '', notes: '', operating_hours: '', fuel_type_names: [] })
    await load()
    onUpdated()
    setSaving(false)
  }

  async function saveEdit(id) {
    if (!editData.name.trim()) return
    const { error } = await supabase.from('fuel_stations').update({
      name: editData.name.trim(),
      name_mm: editData.name_mm.trim(),
      township: editData.township?.trim() || null,
      address: editData.address?.trim() || null,
      phone: editData.phone?.trim() || null,
      notes: editData.notes?.trim() || null,
      operating_hours: editData.operating_hours?.trim() || null,
      fuel_type_names: editData.fuel_type_names || [],
    }).eq('id', id)

    if (error) {
      alert("Error updating station: " + error.message)
      return
    }

    setEditId(null)
    await load()
    onUpdated()
  }

  async function deleteStation(id) {
    if (!window.confirm('ဆိုင်ကို ဖျက်မည်လား?')) return
    const { error } = await supabase.from('fuel_stations').delete().eq('id', id)
    
    if (error) {
      alert("Error deleting station: " + error.message)
      return
    }

    await load()
    onUpdated()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#140020]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0">
          <X size={18} className="text-white" />
        </button>
        <h2 className="font-display font-bold text-base text-white">⛽ ဓာတ်ဆီ စီမံမည်</h2>
        <div className="w-9" />
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-white/8 bg-white/2">
        <button onClick={() => setModalTab('stations')}
          className={`flex-1 py-2.5 text-xs font-bold transition-colors border-b-2 ${
            modalTab === 'stations' ? 'text-brand-300 border-brand-400' : 'text-white/40 border-transparent'
          }`}>
          🏪 ဆိုင်များ ({list.length})
        </button>
        <button onClick={() => setModalTab('fueltypes')}
          className={`flex-1 py-2.5 text-xs font-bold transition-colors border-b-2 ${
            modalTab === 'fueltypes' ? 'text-brand-300 border-brand-400' : 'text-white/40 border-transparent'
          }`}>
          ⛽ ဆီအမျိုးအစားများ ({allFuelTypes.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">

        {/* ── Stations Tab ── */}
        {modalTab === 'stations' && (
          <div className="space-y-4">
            <div className="space-y-2 p-3 rounded-2xl bg-white/3 border border-white/8">
              <p className="text-xs text-white/50 font-bold">➕ ဆိုင်အသစ်ထည့်မည်</p>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Station Name" className="input-dark text-sm w-full" />
              <input value={form.name_mm} onChange={e => set('name_mm', e.target.value)}
                placeholder="အမည် (မြန်မာ)" className="input-dark text-sm w-full font-myanmar" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.township} onChange={e => set('township', e.target.value)}
                  placeholder="မြို့နယ်" className="input-dark text-sm" />
                <input value={form.address} onChange={e => set('address', e.target.value)}
                  placeholder="လိပ်စာ" className="input-dark text-sm" />
              </div>
              <p className="text-[10px] text-white/40 font-bold uppercase mt-2">လောင်စာဆီ အမျိုးအစားများ</p>
              {allFuelTypes.length === 0 ? (
                <p className="text-[10px] text-amber-400 py-1">
                  ⚠️ ဆီအမျိုးအစား မရှိသေး — "ဆီအမျိုးအစားများ" tab မှ ဦးစွာထည့်ပါ
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {allFuelTypes.map(ft => (
                    <label key={ft.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-white/5 border border-white/10">
                      <input type="checkbox"
                        checked={form.fuel_type_names.includes(ft.name)}
                        onChange={e => {
                          const val = e.target.checked
                            ? [...form.fuel_type_names, ft.name]
                            : form.fuel_type_names.filter(n => n !== ft.name)
                          set('fuel_type_names', val)
                        }} className="w-4 h-4" />
                      <span className="text-xs text-white/70">{ft.icon} {ft.name_mm}</span>
                    </label>
                  ))}
                </div>
              )}
              <button onClick={addStation} disabled={saving || !form.name.trim()}
                className="btn-primary w-full text-xs font-bold py-2.5 mt-2 disabled:opacity-40">
                {saving ? 'သိမ်းနေသည်...' : 'ထည့်မည်'}
              </button>
            </div>

            {loading ? (
              <p className="text-xs text-white/30 text-center py-4">ဖွင့်နေသည်...</p>
            ) : (
              <div className="space-y-2">
                {list.length === 0 && (
                  <p className="text-xs text-white/30 text-center py-4">ဆိုင် မရှိသေးပါ</p>
                )}
                {list.map(s => (
                  <div key={s.id} className="rounded-xl bg-white/5 border border-white/8 p-3">
                    {editId === s.id ? (
                      <div className="space-y-2">
                        <input value={editData.name} onChange={e => setE('name', e.target.value)}
                          className="input-dark text-sm w-full" />
                        <input value={editData.name_mm} onChange={e => setE('name_mm', e.target.value)}
                          className="input-dark text-sm w-full font-myanmar" />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={editData.township || ''} onChange={e => setE('township', e.target.value)}
                            className="input-dark text-sm" placeholder="မြို့နယ်" />
                          <input value={editData.address || ''} onChange={e => setE('address', e.target.value)}
                            className="input-dark text-sm" placeholder="လိပ်စာ" />
                        </div>
                        <p className="text-[10px] text-white/40 font-bold uppercase">ဆီအမျိုးအစားများ</p>
                        {allFuelTypes.length === 0 ? (
                          <p className="text-[10px] text-amber-400">⚠️ ဆီအမျိုးအစား tab မှ ဦးစွာထည့်ပါ</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {allFuelTypes.map(ft => (
                              <label key={ft.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-white/5 border border-white/10">
                                <input type="checkbox"
                                  checked={(editData.fuel_type_names || []).includes(ft.name)}
                                  onChange={e => {
                                    const cur = editData.fuel_type_names || []
                                    const val = e.target.checked ? [...cur, ft.name] : cur.filter(n => n !== ft.name)
                                    setE('fuel_type_names', val)
                                  }} className="w-4 h-4" />
                                <span className="text-xs text-white/70">{ft.icon} {ft.name_mm}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(s.id)}
                            className="flex-1 px-3 py-2 bg-green-500 text-white text-xs font-bold rounded-xl">
                            သိမ်းမည်
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="flex-1 px-3 py-2 bg-white/8 text-white/40 text-xs rounded-xl">
                            ဖျက်သိမ်းမည်
                          </button>
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
                              return ft ? (
                                <span key={ft.id} className="text-[8px] px-1.5 py-0.5 rounded-full bg-brand-600/20 text-brand-300 border border-brand-500/20">
                                  {ft.icon} {ft.name_mm}
                                </span>
                              ) : null
                            })}
                            {(s.fuel_type_names || []).length === 0 && (
                              <span className="text-[8px] text-white/20">ဆီ မသတ်မှတ်ရ</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button onClick={() => { setEditId(s.id); setEditData({ ...s, fuel_type_names: s.fuel_type_names || [] }) }}
                            className="w-7 h-7 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => deleteStation(s.id)}
                            className="w-7 h-7 bg-red-500/10 text-red-400 rounded-lg flex items-center justify-center">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Fuel Types Tab ── */}
        {modalTab === 'fueltypes' && (
          <FuelTypesTab onChanged={() => { onUpdated() }} />
        )}
      </div>
    </div>
  )
}

// ─── Main FuelPage ────────────────────────────────────────────────────────────
export default function FuelPage() {
  const { lang }       = useLang()
  const { isModerator } = useAuth()
  useSEO({ title: 'Fuel Availability' })

  const [stations, setStations]         = useState([])
  const [allFuelTypes, setAllFuelTypes] = useState([])
  const [loading, setLoading]           = useState(true)
  const [showManage, setShowManage]     = useState(false)
  const [toast, setToast]               = useState(null)

  async function load() {
    setLoading(true)
    try {
      // 1. Load fuel types
      const { data: ftData } = await supabase.from('fuel_types').select('*').order('sort_order')
      setAllFuelTypes(ftData || [])

      // 2. Load ALL active stations directly
      const { data: stationsRaw } = await supabase
        .from('fuel_stations')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      // 3. Load current fuel status from view
      const { data: statusData } = await supabase.from('current_fuel_status').select('*')

      // 4. Build lookup
      const statusMap = {}
      for (const row of (statusData || [])) {
        if (!statusMap[row.station_id]) statusMap[row.station_id] = {}
        statusMap[row.station_id][row.fuel_id] = row
      }

      // 5. Merge
      const merged = (stationsRaw || []).map(s => ({
        id: s.id,
        name: s.name,
        name_mm: s.name_mm,
        township: s.township,
        address: s.address,
        notes: s.notes,
        operating_hours: s.operating_hours,
        phone: s.phone,
        fuel_type_names: s.fuel_type_names || [],
        fuels: statusMap[s.id] || {},
      }))

      setStations(merged)
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
    setToast({ msg: 'Report တင်ပြီးပါပြီ ✓' })
    setTimeout(() => setToast(null), 3000)
    load()
  }

  return (
    <div className="pb-32">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <h1 className="font-display font-bold text-xl text-white">⛽ Fuel Status</h1>
        <button onClick={load} className="text-brand-300">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {isModerator && (
        <button onClick={() => setShowManage(true)}
          className="mx-4 mb-3 w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/50 font-bold flex items-center justify-center gap-2">
          ⚙️ ဓာတ်ဆီဆိုင် / ဆီအမျိုးအစား စီမံမည်
        </button>
      )}

      {loading ? (
        <div className="px-4 py-8 text-center text-white/30 text-sm">ဖွင့်နေသည်...</div>
      ) : stations.length === 0 ? (
        <div className="px-4 py-8 text-center text-white/30 text-sm">ဆိုင် မရှိသေးပါ</div>
      ) : (
        <div className="px-4 space-y-2">
          {stations.map(s => (
            <StationCard key={s.id} station={s} lang={lang} onReport={handleReport} allFuelTypes={allFuelTypes} />
          ))}
        </div>
      )}

      {/* ── How it works section ── */}
      <div className="mx-4 mt-6 card-dark rounded-2xl p-4 bg-white/5 border border-white/8">
        <p className="text-xs font-display font-bold text-white/50 uppercase tracking-wider mb-3">
          {lang === 'mm' ? 'ဘယ်လိုအလုပ်လုပ်သလဲ' : 'How it works'}
        </p>
        <div className="space-y-2">
          {[
            { mm:'ဆီဆိုင်များတွင် ဆီရ/မရ အခြေအနေကို Report လုပ်ပါ',  en:'Report fuel availability at stations' },
            { mm:'နောက်ဆုံးတင်ထားသော Report ကို အခြေခံပြီး ပြသပါမည်', en:'Status is based on the most recent reports' },
            { mm:'ဆီအမျိုးအစား (ဥပမာ- 92, Diesel) အလိုက် သီးသန့်တင်နိုင်သည်', en:'Report separately for each fuel type' },
            { mm:'Guest အနေဖြင့်လည်း အလွယ်တကူ Report တင်ပြနိုင်သည်', en:'Guests can easily submit reports' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-brand-600/40 text-brand-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
              <p className="text-xs text-white/50 font-myanmar">{lang === 'mm' ? s.mm : s.en}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-white/20 mt-3 font-myanmar border-t border-white/6 pt-3">
          ⚠️ {lang === 'mm' ? 'ဤ Data သည် Community Report ဖြစ်ပြီး တိကျမှု 100% ကို မသေချာနိုင်' : 'Community data — accuracy not guaranteed'}
        </p>
      </div>

      {showManage && (
        <ManageFuelStationsModal
          lang={lang}
          allFuelTypes={allFuelTypes}
          onClose={() => setShowManage(false)}
          onUpdated={load}
        />
      )}

      {toast && (
        <div className="fixed bottom-28 left-4 right-4 z-[300] bg-green-500/20 border border-green-500/40 text-green-300 px-4 py-3 rounded-2xl text-center text-sm font-myanmar">
          {toast.msg}
        </div>
      )}
    </div>
  )
}
```
