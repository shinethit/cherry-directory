import { useState, useEffect, useRef } from 'react'
import { Zap, ZapOff, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'

// ── Helpers ───────────────────────────────────────────────────
function timeAgoShort(iso, lang) {
  if (!iso) return '—'
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return lang === 'mm' ? 'ယခုလေး' : 'just now'
  if (m < 60) return `${m}${lang === 'mm' ? ' မိနစ်' : 'm'}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}${lang === 'mm' ? ' နာရီ' : 'h'}`
  return `${Math.floor(h / 24)}${lang === 'mm' ? ' ရက်' : 'd'}`
}

const COOLDOWN_MS = 5 * 60 * 1000   // 5 min per area per device

// ── Status card ───────────────────────────────────────────────
function AreaCard({ area, lang, onReport }) {
  const isCut      = area.current_status === 'cut'
  const isRestored = area.current_status === 'restored'
  const isUnknown  = area.current_status === 'unknown'
  const cutConf    = area.cut_confirmations || 0
  const restConf   = area.restored_confirmations || 0
  const total      = cutConf + restConf

  // Confidence bar
  const confidence = total > 0 ? Math.round((isCut ? cutConf : restConf) / total * 100) : 0

  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      isCut      ? 'bg-red-500/8   border-red-500/25'   :
      isRestored ? 'bg-green-500/8 border-green-500/25' :
                   'bg-white/4    border-white/8'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {/* Status icon */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
            isCut      ? 'bg-red-500/20'   :
            isRestored ? 'bg-green-500/20' :
                         'bg-white/8'
          }`}>
            {isCut      ? <ZapOff size={18} className="text-red-400" />      :
             isRestored ? <Zap    size={18} className="text-green-400" />    :
                          <Clock  size={16} className="text-white/30" />}
          </div>

          <div className="min-w-0">
            <p className="font-display font-semibold text-sm text-white">{area.name}</p>
            <p className="text-[10px] text-white/40 font-myanmar mt-0.5">{area.township}</p>

            {/* Status label */}
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`text-xs font-bold font-myanmar ${
                isCut      ? 'text-red-400'   :
                isRestored ? 'text-green-400' :
                             'text-white/30'
              }`}>
                {isCut      ? '🔴 ဓာတ်အားဖြတ်' :
                 isRestored ? '🟢 ဓာတ်အား ပြန်ရ' :
                              (lang === 'mm' ? '⚪ Data မရှိ' : '⚪ No data')}
              </span>
              {area.last_reported && (
                <span className="text-[9px] text-white/25">{timeAgoShort(area.last_reported, lang)}</span>
              )}
            </div>

            {/* Confirmation bar */}
            {total > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[9px] text-white/30 mb-1">
                  <span>{lang === 'mm' ? 'Confirm' : 'Confirmed'}: {confidence}%</span>
                  <span>{total} report{total > 1 ? 's' : ''}</span>
                </div>
                <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isCut ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>
            )}

            {area.notes && (
              <p className="text-[10px] text-white/40 mt-1.5 font-myanmar italic">{area.notes}</p>
            )}
          </div>
        </div>

        {/* Report buttons */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={() => onReport(area, 'cut')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-[10px] font-bold hover:bg-red-500/25 transition-colors font-myanmar"
          >
            <ZapOff size={11} /> ဖြတ်သည်
          </button>
          <button
            onClick={() => onReport(area, 'restored')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-green-500/15 border border-green-500/25 text-green-400 text-[10px] font-bold hover:bg-green-500/25 transition-colors font-myanmar"
          >
            <Zap size={11} /> ပြန်ရ
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function PowerCutPage() {
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'လျှပ်စစ်အခြေအနေ' : 'Power Status' })

  const [areas, setAreas]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [toast, setToast]       = useState(null)
  const [townFilter, setTownFilter] = useState('all')
  const channelRef = useRef(null)

  async function load() {
    setLoading(true)
    try {
    const { data } = await supabase.from('current_power_status').select('*')
    setAreas(data || [])
    setLastUpdate(new Date())
    } catch (e) { console.warn(e) }
    setLoading(false)
  }

  useEffect(() => {
    load()

    // Realtime
    channelRef.current = supabase
      .channel('power-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'power_cut_reports' }, load)
      .subscribe()

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  async function handleReport(area, status) {
    // Rate limit per area
    const key  = `pwr_${area.id}`
    const last = localStorage.getItem(key)
    if (last && Date.now() - parseInt(last) < COOLDOWN_MS) {
      setToast({ type: 'warn', msg: lang === 'mm' ? '၅ မိနစ်တစ်ကြိမ်သာ Report လုပ်နိုင်' : 'Please wait 5 min before re-reporting' })
      setTimeout(() => setToast(null), 3000)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('power_cut_reports').insert({
      area_id:     area.id,
      status,
      reporter_id: user?.id || null,
    })

    localStorage.setItem(key, String(Date.now()))

    const msg = status === 'cut'
      ? (lang === 'mm' ? `✓ "${area.name}" ဓာတ်အားဖြတ် Report တင်ပြပြီး` : `✓ Power cut reported for "${area.name}"`)
      : (lang === 'mm' ? `✓ "${area.name}" ဓာတ်အားပြန်ရ Report တင်ပြပြီး` : `✓ Power restored reported for "${area.name}"`)

    setToast({ type: status === 'cut' ? 'warn' : 'ok', msg })
    setTimeout(() => setToast(null), 3000)
  }

  const towns = ['all', ...new Set(areas.map(a => a.township).filter(Boolean))]
  const filtered = townFilter === 'all' ? areas : areas.filter(a => a.township === townFilter)

  const cutCount      = areas.filter(a => a.current_status === 'cut').length
  const restoredCount = areas.filter(a => a.current_status === 'restored').length
  const unknownCount  = areas.filter(a => a.current_status === 'unknown').length

  return (
    <div className="pb-8">

      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              ⚡ {lang === 'mm' ? 'လျှပ်စစ်အခြေအနေ' : 'Power Status'}
            </h1>
            <p className="text-xs text-white/40 mt-0.5 font-myanmar">
              {lang === 'mm' ? 'Community တင်ပြသော ဓာတ်အားဖြတ်တောက်မှု • Real-time' : 'Community-reported outages • Real-time'}
            </p>
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-1 text-[10px] text-brand-300 mt-1">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {lastUpdate && !loading ? timeAgoShort(lastUpdate.toISOString(), lang) : '...'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-2 px-4 mb-4">
        <div className="flex-1 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
          <p className="font-display font-bold text-xl text-red-400">{cutCount}</p>
          <p className="text-[9px] text-red-400/60 font-myanmar">ဖြတ်တောက်</p>
        </div>
        <div className="flex-1 p-3 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
          <p className="font-display font-bold text-xl text-green-400">{restoredCount}</p>
          <p className="text-[9px] text-green-400/60 font-myanmar">ပြန်ရ</p>
        </div>
        <div className="flex-1 p-3 rounded-2xl bg-white/5 border border-white/8 text-center">
          <p className="font-display font-bold text-xl text-white/40">{unknownCount}</p>
          <p className="text-[9px] text-white/25 font-myanmar">Data မရှိ</p>
        </div>
        <div className="flex-1 p-3 rounded-2xl bg-white/5 border border-white/8 text-center">
          <div className="flex items-center justify-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p className="font-display font-bold text-sm text-green-400">Live</p>
          </div>
          <p className="text-[9px] text-white/25">Auto</p>
        </div>
      </div>

      {/* Township filter */}
      {towns.length > 2 && (
        <div className="px-4 mb-4">
          <div className="relative">
            <select
              value={townFilter}
              onChange={e => setTownFilter(e.target.value)}
              className="select-dark"
            >
              {towns.map(t => (
                <option key={t} value={t} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                  {t === 'all' ? (lang === 'mm' ? 'ခပ်သိမ်း' : 'All') : t}
                </option>
              ))}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
      )}

      {/* Area list */}
      <div className="px-4 space-y-2 mb-6">
        {loading
          ? [1,2,3,4,5].map(n => <div key={n} className="h-24 rounded-2xl shimmer" />)
          : filtered.map(area => (
            <AreaCard key={area.id} area={area} lang={lang} onReport={handleReport} />
          ))
        }
      </div>

      {/* How it works */}
      <div className="mx-4 card-dark rounded-2xl p-4">
        <p className="text-xs font-display font-bold text-white/50 uppercase tracking-wider mb-3">
          {lang === 'mm' ? 'ဘယ်လိုအလုပ်လုပ်သလဲ' : 'How it works'}
        </p>
        <div className="space-y-2">
          {[
            { mm:'ရပ်ကွက်တွင် ဓာတ်အား ဖြတ်/ပြန်ရပါက Report လုပ်ပါ',   en:'When power cuts or restores, tap the button' },
            { mm:'လူများများ Confirm လုပ်လေ ဖြစ်ရပ် မှန်ကန်မှု များလေ', en:'More confirmations = higher confidence'       },
            { mm:'Data ကို ၁၂ နာရီအတွင်း Report မှ တွက်ချက်သည်',        en:'Status based on reports from last 12 hours'  },
            { mm:'Guest ပါ Report တင်ပြနိုင်သည် • ၅ မိနစ် Cooldown',     en:'Guests welcome • 5 min cooldown per area'    },
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

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-28 left-4 right-4 max-w-lg mx-auto z-[300] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl font-myanmar text-sm ${
          toast.type === 'ok'   ? 'bg-green-500/20 border border-green-500/40 text-green-300' :
          toast.type === 'warn' ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300' :
                                  'bg-red-500/20   border border-red-500/40   text-red-300'
        }`}>
          {toast.type === 'ok' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
