import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Pencil, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { fetchFuelData } from '../lib/prefetch'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { useSEO } from '../hooks/useSEO'
import { confirmDialog } from '../lib/confirmDialog'
import { showError } from '../lib/toast'

// ─── Station Card ────────────────────────────────────────────────────────────
function StationCard({ station, lang, allFuelTypes }) {
  const [expanded, setExpanded] = useState(false)

  const stationFuelNames = station.fuel_type_names || []
  const stationFuels = allFuelTypes.filter(ft => stationFuelNames.includes(ft.name))

  return (
    <div className="card-dark rounded-2xl overflow-hidden border border-white/6">
      <button className="w-full flex items-start gap-3 p-4 text-left" onClick={() => setExpanded(e => !e)}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl bg-white/5">
          ⛽
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-white truncate">{lang === 'mm' ? (station.name_mm || station.name) : station.name}</p>
          {[station.address, station.township].filter(Boolean).length > 0 && (
            <p className="text-[10px] text-white/60 font-myanmar truncate">{[station.address, station.township].filter(Boolean).join(' • ')}</p>
          )}
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {stationFuels.map(ft => (
              <span key={ft.id} className="flex items-center gap-1 text-[9px] text-white/60">
                <span>{ft.icon}</span>
                <span>{lang === 'mm' ? ft.name_mm : ft.name}</span>
              </span>
            ))}
            {stationFuels.length === 0 && (
              <span className="text-[9px] text-white/60">ဆီအမျိုးအစား မသတ်မှတ်ရ</span>
            )}
          </div>
        </div>
        <span className="text-white/60 text-xs mt-1 flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/6 pt-3 space-y-2">
          {station.phone && (
            <p className="text-xs text-white/70">
              📞 <a href={`tel:${station.phone}`} className="text-brand-300">{station.phone}</a>
            </p>
          )}
          {station.operating_hours && (
            <p className="text-xs text-white/70">🕒 {station.operating_hours}</p>
          )}
          {station.notes && (
            <p className="text-xs text-white/60 font-myanmar">{station.notes}</p>
          )}
          {/* S22 (v9.17): Directions link when coordinates exist */}
          {station.latitude != null && station.longitude != null && (
            <p className="text-xs text-white/70">
              📍 <a href={`https://maps.google.com/?q=${station.latitude},${station.longitude}`} target="_blank" rel="noopener noreferrer" className="text-brand-300">{lang === 'mm' ? 'လမ်းညွှန်' : 'Directions'}</a>
            </p>
          )}
          {/* Fuel types sold here */}
          <div className="pt-1">
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider font-myanmar mb-1.5">
              {lang === 'mm' ? 'ရောင်းချသော ဆီအမျိုးအစားများ' : 'Fuel types sold'}
            </p>
            {stationFuels.length === 0 ? (
              <p className="text-xs text-white/60 text-center py-2">ဆီအမျိုးအစား မသတ်မှတ်ရသေး</p>
            ) : (
              <div className="flex gap-1.5 flex-wrap">
                {stationFuels.map(ft => (
                  <span key={ft.id} className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                    {ft.icon} {lang === 'mm' ? ft.name_mm : ft.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Fuel Types Tab (unchanged) ──────────────────────────────────────────
function FuelTypesTab({ onChanged }) {
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [editId, setEditId]   = useState(null)
  const [editData, setEditData] = useState({ name: '', name_mm: '', icon: '', sort_order: 0 })
  const [form, setForm] = useState({ name: '', name_mm: '', icon: '⛽' })

  const set  = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setE = async (k, v) => setEditData(f => ({ ...f, [k]: v }))

  async function load() {
    setLoading(true)
    // 30 s timeout (was none): a hung query left the modal spinner up forever.
    try {
      const { data } = await withTimeout(supabase.from('fuel_types').select('*').order('sort_order'), 30000, 'Fuel types')
      setList(data || [])
    } catch (e) { console.warn(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addFuelType() {
    if (!form.name.trim() || !form.name_mm.trim()) return
    setSaving(true)
    // fuel_types.id is a text PK with no default — generate it as a slug
    // from the name ('Petrol 92' → 'petrol92', matching the seeded ids).
    // The old insert passed no id at all, so it always failed.
    const slugBase = form.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || `fuel${Date.now()}`
    let slugId = slugBase
    let n = 2
    while (list.some(x => x.id === slugId)) slugId = slugBase + '-' + (n++)
    const { error } = await supabase.from('fuel_types').insert({
      id: slugId,
      name: form.name.trim(),
      name_mm: form.name_mm.trim(),
      icon: form.icon.trim() || '⛽',
      sort_order: list.length + 1,
    })
    if (error) { showError(error.message); setSaving(false); return }
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
    if (error) { showError(error.message); return }
    setEditId(null)
    load()
    onChanged?.()
  }

  async function deleteFuelType(id) {
    if (!(await confirmDialog('ဆီအမျိုးအစားကို ဖျက်မည်လား? ဆိုင်များမှ ဆီပိတ်သွားနိုင်သည်။', { danger: true }))) return
    const ft = list.find(x => x.id === id)
    const { error } = await supabase.from('fuel_types').delete().eq('id', id)
    if (error) { showError(error.message); return }
    if (ft) {
      const { data: stations } = await supabase.from('fuel_stations').select('id, fuel_type_names')
      const affected = (stations || []).filter(x => (x.fuel_type_names || []).includes(ft.name))
      for (const st of affected) {
        await supabase.from('fuel_stations').update({ fuel_type_names: (st.fuel_type_names || []).filter(n => n !== ft.name) }).eq('id', st.id)
      }
    }
    load()
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
            placeholder="Name (English)" className="input-dark" />
          <input value={form.name_mm} onChange={e => set('name_mm', e.target.value)}
            placeholder="အမည် (မြန်မာ)" className="input-dark font-myanmar" />
        </div>
        <div>
          <p className="text-[10px] text-white/60 mb-1.5">Icon ရွေးမည် (emoji)</p>
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
        <p className="text-xs text-white/60 text-center py-4">ဖွင့်နေသည်...</p>
      ) : (
        <div className="space-y-2">
          {list.length === 0 && (
            <p className="text-xs text-white/60 text-center py-4">ဆီအမျိုးအစား မရှိသေးပါ</p>
          )}
          {list.map(ft => (
            <div key={ft.id} className="rounded-xl bg-white/5 border border-white/8 p-3">
              {editId === ft.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editData.name} onChange={e => setE('name', e.target.value)}
                      className="input-dark" placeholder="Name (English)" />
                    <input value={editData.name_mm} onChange={e => setE('name_mm', e.target.value)}
                      className="input-dark font-myanmar" placeholder="အမည် (မြန်မာ)" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/60">Sort order:</span>
                    <input type="number" value={editData.sort_order ?? 0} onChange={e => setE('sort_order', e.target.value)}
                      className="input-dark w-20 text-center" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-white/60">Icon:</span>
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
                      className="flex-1 px-3 py-2 bg-white/8 text-white/60 text-xs rounded-xl">
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
                      <p className="text-[10px] text-white/60">{ft.name}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => { setEditId(ft.id); setEditData(ft) }}
                      className="w-7 h-7 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => deleteFuelType(ft.id)}
                      className="w-7 h-7 btn-danger rounded-lg flex items-center justify-center">
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
function ManageFuelStationsModal({ onClose, onUpdated, lang, allFuelTypes, onFuelTypesChanged }) {
  const [modalTab, setModalTab] = useState('stations')
  const [list, setList]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [editId, setEditId]     = useState(null)
  const [editData, setEditData] = useState({ name: '', name_mm: '', township: '', address: '', phone: '', notes: '', operating_hours: '', fuel_type_names: [] })
  const [form, setForm]         = useState({ name: '', name_mm: '', township: '', address: '', phone: '', notes: '', operating_hours: '', fuel_type_names: [] })

  const set  = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setE = async (k, v) => setEditData(f => ({ ...f, [k]: v }))

  async function load() {
    setLoading(true)
    // 30 s timeout (was none): a hung query left the modal spinner up forever.
    try {
      const { data } = await withTimeout(supabase.from('fuel_stations').select('*').order('sort_order'), 30000, 'Fuel stations')
      setList(data || [])
    } catch (e) { console.warn(e) }
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
    if (error) { showError(error.message); setSaving(false); return }
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
    if (error) { showError(error.message); return }
    setEditId(null)
    load()
    onUpdated()
  }

  async function deleteStation(id) {
    if (!(await confirmDialog('ဆိုင်ကို ဖျက်မည်လား?', { danger: true }))) return
    const { error } = await supabase.from('fuel_stations').delete().eq('id', id)
    if (error) { showError(error.message); return }
    load()
    onUpdated()
  }

  // N17 (v9.17): hide/show a station — the public list only shows
  // is_active stations, so this is the soft-delete.
  async function toggleStation(id, current) {
    const { error } = await supabase.from('fuel_stations').update({ is_active: !current }).eq('id', id)
    if (error) { showError(error.message); return }
    load()
    onUpdated()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#140020] pt-safe">
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
            modalTab === 'stations' ? 'text-brand-300 border-brand-400' : 'text-white/60 border-transparent'
          }`}>
          🏪 ဆိုင်များ ({list.length})
        </button>
        <button onClick={() => setModalTab('fueltypes')}
          className={`flex-1 py-2.5 text-xs font-bold transition-colors border-b-2 ${
            modalTab === 'fueltypes' ? 'text-brand-300 border-brand-400' : 'text-white/60 border-transparent'
          }`}>
          ⛽ ဆီအမျိုးအစားများ ({allFuelTypes.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-36">
        {modalTab === 'stations' && (
          <div className="space-y-4">
            <div className="space-y-2 p-3 rounded-2xl bg-white/3 border border-white/8">
              <p className="text-xs text-white/50 font-bold">➕ ဆိုင်အသစ်ထည့်မည်</p>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Station Name" className="input-dark w-full" />
              <input value={form.name_mm} onChange={e => set('name_mm', e.target.value)}
                placeholder="အမည် (မြန်မာ)" className="input-dark w-full font-myanmar" />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.township} onChange={e => set('township', e.target.value)}
                  placeholder="မြို့နယ်" className="input-dark" />
                <input value={form.address} onChange={e => set('address', e.target.value)}
                  placeholder="လိပ်စာ" className="input-dark" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="ဖုန်းနံပါတ်" type="tel" className="input-dark" />
                <input value={form.operating_hours} onChange={e => set('operating_hours', e.target.value)}
                  placeholder="ဖွင့်ချိန်" className="input-dark font-myanmar" />
              </div>
              <input value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="မှတ်ချက်" className="input-dark w-full font-myanmar" />
              <p className="text-[10px] text-white/60 font-bold uppercase mt-2">လောင်စာဆီ အမျိုးအစားများ</p>
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
                        }} className="w-4 h-4 flex-shrink-0" />
                      <span className="text-xs text-white/70 min-w-0 flex-1 truncate">{ft.icon} {ft.name_mm}</span>
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
              <p className="text-xs text-white/60 text-center py-4">ဖွင့်နေသည်...</p>
            ) : (
              <div className="space-y-2">
                {list.length === 0 && (
                  <p className="text-xs text-white/60 text-center py-4">ဆိုင် မရှိသေးပါ</p>
                )}
                {list.map(s => (
                  <div key={s.id} className="rounded-xl bg-white/5 border border-white/8 p-3">
                    {editId === s.id ? (
                      <div className="space-y-2">
                        <input value={editData.name} onChange={e => setE('name', e.target.value)}
                          className="input-dark w-full" />
                        <input value={editData.name_mm} onChange={e => setE('name_mm', e.target.value)}
                          className="input-dark w-full font-myanmar" />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={editData.township || ''} onChange={e => setE('township', e.target.value)}
                            className="input-dark" placeholder="မြို့နယ်" />
                          <input value={editData.address || ''} onChange={e => setE('address', e.target.value)}
                            className="input-dark" placeholder="လိပ်စာ" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input value={editData.phone || ''} onChange={e => setE('phone', e.target.value)}
                            className="input-dark" placeholder="ဖုန်းနံပါတ်" type="tel" />
                          <input value={editData.operating_hours || ''} onChange={e => setE('operating_hours', e.target.value)}
                            className="input-dark font-myanmar" placeholder="ဖွင့်ချိန်" />
                        </div>
                        <input value={editData.notes || ''} onChange={e => setE('notes', e.target.value)}
                          className="input-dark w-full font-myanmar" placeholder="မှတ်ချက်" />
                        <p className="text-[10px] text-white/60 font-bold uppercase">ဆီအမျိုးအစားများ</p>
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
                                  }} className="w-4 h-4 flex-shrink-0" />
                                <span className="text-xs text-white/70 min-w-0 flex-1 truncate">{ft.icon} {ft.name_mm}</span>
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
                            className="flex-1 px-3 py-2 bg-white/8 text-white/60 text-xs rounded-xl">
                            ဖျက်သိမ်းမည်
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white font-myanmar truncate">{s.name_mm || s.name}</p>
                          {[s.address, s.township].filter(Boolean).length > 0 && (
                            <p className="text-[10px] text-white/60 truncate">{[s.address, s.township].filter(Boolean).join(' • ')}</p>
                          )}
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
                              <span className="text-[8px] text-white/60">ဆီ မသတ်မှတ်ရ</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2 flex-shrink-0">
                          <button onClick={() => toggleStation(s.id, s.is_active)} title={s.is_active ? 'ဖျောက်မည်' : 'ပြန်ပြမည်'} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${s.is_active ? 'bg-green-500/20 text-green-400' : 'bg-white/8 text-white/60'}`}>{s.is_active ? '✓' : '○'}</button>
                          <button onClick={() => { setEditId(s.id); setEditData({ ...s, fuel_type_names: s.fuel_type_names || [] }) }}
                            className="w-7 h-7 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => deleteStation(s.id)}
                            className="w-7 h-7 btn-danger rounded-lg flex items-center justify-center">
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

        {modalTab === 'fueltypes' && (
          <FuelTypesTab onChanged={() => { onUpdated(); onFuelTypesChanged?.() }} />
        )}
      </div>
    </div>
  )
}

// ─── Main FuelPage (optimized updates) ───────────────────────────────────────
export default function FuelPage() {
  const { lang }       = useLang()
  const { isModerator } = useAuth()
  useSEO({ title: 'Fuel Stations' })

  const [stations, setStations]         = useState([])
  const [allFuelTypes, setAllFuelTypes] = useState([])
  const [loading, setLoading]           = useState(true)
  const [showManage, setShowManage]     = useState(false)
  const [loadError, setLoadError]       = useState(false)

  // Load initial data — Issue 4c (v9.17): useQuery ['fuel-stations']
  // (same fetcher as the prefetch runner), so the list renders from
  // cache instantly on revisit under VPN. S22: the fetcher keeps lat/lng
  // so the Directions link in StationCard can use them.
  const { data: fuelData, isLoading: fuelQueryLoading, isFetching: fuelQueryFetching, isError: fuelQueryError, refetch: refetchFuel } = useQuery({
    queryKey: ['fuel-stations'],
    queryFn: fetchFuelData,
  })
  useEffect(() => {
    if (fuelData) {
      setAllFuelTypes(fuelData.types)
      setStations(fuelData.stations)
    }
    setLoading(fuelQueryLoading || fuelQueryFetching)
    setLoadError(fuelQueryError)
  }, [fuelData, fuelQueryLoading, fuelQueryFetching, fuelQueryError])

  // S21 (v9.17): search + township + fuel-type filters.
  const [searchQuery, setSearchQuery] = useState('')
  const [townshipFilter, setTownshipFilter] = useState('All')
  const [fuelTypeFilter, setFuelTypeFilter] = useState('All')
  const townships = [...new Set(stations.map(s => s.township).filter(Boolean))].sort()
  const filteredStations = stations.filter(s => {
    if (townshipFilter !== 'All' && s.township !== townshipFilter) return false
    if (fuelTypeFilter !== 'All' && !(s.fuel_type_names || []).includes(fuelTypeFilter)) return false
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      if (!((s.name || '').toLowerCase().includes(q) || (s.name_mm || '').includes(searchQuery.trim()) || (s.address || '').toLowerCase().includes(q))) return false
    }
    return true
  })

  return (
    <div className="pb-36">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <h1 className="font-display font-bold text-xl text-white">{lang === 'mm' ? '⛽ ဓာတ်ဆီဆိုင်များ' : '⛽ Fuel Stations'}</h1>
        <button onClick={() => refetchFuel()} className="text-brand-300">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {isModerator && (
        <button onClick={() => setShowManage(true)}
          className="mx-4 mb-3 w-[calc(100%-2rem)] py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/50 font-bold flex items-center justify-center gap-2">
          ⚙️ ဓာတ်ဆီဆိုင် / ဆီအမျိုးအစား စီမံမည်
        </button>
      )}

      {/* S21 (v9.17): search + township + fuel-type filters */}
      <div className="px-4 pb-3 space-y-2">
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={lang === 'mm' ? '🔍 ဆိုင်အမည် / လိပ်စာ ရှာမည်' : '🔍 Search name / address'}
          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40 outline-none"
        />
        <div className="flex gap-2">
          <select value={townshipFilter} onChange={e => setTownshipFilter(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none">
            <option value="All">{lang === 'mm' ? 'မြို့နယ် အားလုံး' : 'All townships'}</option>
            {townships.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={fuelTypeFilter} onChange={e => setFuelTypeFilter(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none">
            <option value="All">{lang === 'mm' ? 'ဆီ အမျိုးအစား အားလုံး' : 'All fuel types'}</option>
            {allFuelTypes.map(ft => <option key={ft.id} value={ft.name}>{lang === 'mm' ? (ft.name_mm || ft.name) : ft.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-white/60 text-sm">ဖွင့်နေသည်...</div>
      ) : loadError ? (
        <div className="px-4 py-8 text-center space-y-3">
          <p className="text-sm text-red-400 font-myanmar">Data တင်ရာတွင် အမှားဖြစ်သွားသည်</p>
          <button onClick={() => refetchFuel()} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button>
        </div>
      ) : stations.length === 0 ? (
        <div className="px-4 py-8 text-center text-white/60 text-sm">ဆိုင် မရှိသေးပါ</div>
      ) : filteredStations.length === 0 ? (
        <div className="px-4 py-8 text-center text-white/60 text-sm">{lang === 'mm' ? 'ရှာမတွေ့ပါ' : 'No stations match'}</div>
      ) : (
        <div className="px-4 space-y-2">
          {filteredStations.map(s => (
            <StationCard
              key={s.id}
              station={s}
              lang={lang}
              allFuelTypes={allFuelTypes}
            />
          ))}
        </div>
      )}

      {/* About this page */}
      <div className="mx-4 mt-6 card-dark rounded-2xl p-4 bg-white/5 border border-white/8">
        <p className="text-xs font-display font-bold text-white/50 uppercase tracking-wider mb-3">
          {lang === 'mm' ? 'ဤစာမျက်နှာအကြောင်း' : 'About this page'}
        </p>
        <div className="space-y-2">
          {[
            { mm:'ဓာတ်ဆီဆိုင်များ၏ လိပ်စာ၊ မြို့နယ် နှင့် ဖုန်းနံပါတ်များကို ကြည့်နိုင်သည်',  en:'See station addresses, townships and phone numbers' },
            { mm:'ဆိုင်ဖွင့်ချိန် နှင့် မှတ်ချက်များကို ကြည့်နိုင်သည်', en:'Check operating hours and notes' },
            { mm:'ဆိုင်တစ်ခုစီတွင် ရောင်းချသော ဆီအမျိုးအစားများကို ကြည့်နိုင်သည်', en:'See which fuel types each station sells' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-brand-600/40 text-brand-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
              <p className="text-xs text-white/50 font-myanmar">{lang === 'mm' ? s.mm : s.en}</p>
            </div>
          ))}
        </div>
      </div>

      {showManage && (
        <ManageFuelStationsModal
          lang={lang}
          allFuelTypes={allFuelTypes}
          onClose={() => setShowManage(false)}
          onUpdated={() => refetchFuel()}
          onFuelTypesChanged={() => refetchFuel()}
        />
      )}

    </div>
  )
}