import { useState, useEffect } from 'react'
import { Database, Check, X, RefreshCw, Trash2, Clock, HardDrive, AlertCircle } from 'lucide-react'
import { subscribe, inspectLocalStorage, clearCache } from '../lib/cacheStatus'
import { useLang } from '../contexts/LangContext'
import { useQueryClient } from '@tanstack/react-query'
import { confirmDialog } from '../lib/confirmDialog'
import { showError } from '../lib/toast'

export default function OfflineCachePanel() {
  const { lang } = useLang()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState(null)
  const [storage, setStorage] = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const unsub = subscribe(setStatus)
    setStorage(inspectLocalStorage())
    // Refresh storage every 3 sec
    const id = setInterval(() => setStorage(inspectLocalStorage()), 3000)
    return () => { unsub(); clearInterval(id) }
  }, [])

  function formatTime(iso, l) {
    if (!iso) return l === 'mm' ? 'မရှိသေး' : 'Never'
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return l === 'mm' ? 'ယခုလေး' : 'just now'
    if (m < 60) return l === 'mm' ? `${m} မိနစ်က` : `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return l === 'mm' ? `${h} နာရီက` : `${h}h ago`
    return d.toLocaleString()
  }

  async function handleRefresh() {
    queryClient.invalidateQueries()
    // Trigger a re-prefetch by clearing processed flag — but hook uses ref
    // Simplest: reload page which re-runs prefetch
    window.location.reload()
  }

  async function handleClear() {
    if (!(await confirmDialog(lang === 'mm' ? 'Cache ဖျက်မှာ သေချာလား? Offline မရတော့ဘူး။' : 'Clear offline cache? You will lose offline access.'))) return
    clearCache()
    setStorage(inspectLocalStorage())
    // Also clear in-memory query cache
    queryClient.clear()
    showError(lang === 'mm' ? 'Cache ဖျက်ပြီးပါပြီ။ Page ကို Reload ပါ။' : 'Cache cleared. Please reload.')
  }

  const running = status?.running
  const succeeded = status?.succeeded || 0
  const failed = status?.failed || 0
  const total = status?.totalTasks || 0
  const cached = storage?.exists
  const itemCount = storage?.queryCount || 0
  const sizeKB = storage?.sizeKB || 0

  return (
    <div className="card-dark rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          running ? 'bg-blue-500/20 text-blue-400' :
          cached ? 'bg-green-500/20 text-green-400' :
          'bg-white/8 text-white/40'
        }`}>
          {running ? (
            <RefreshCw size={18} className="animate-spin" />
          ) : cached ? (
            <Database size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display font-semibold text-white">
            {lang === 'mm' ? 'အော့ဖ်လိုင်း Data' : 'Offline Data'}
          </p>
          <p className="text-[10px] text-white/50 mt-0.5 font-myanmar">
            {running
              ? (lang === 'mm' ? `သိမ်းနေသည်... ${succeeded + failed}/${total}` : `Saving... ${succeeded + failed}/${total}`)
              : cached
                ? (lang === 'mm' ? `${itemCount} မျိုး • ${sizeKB} KB • ${formatTime(status?.lastRunAt, lang)}` : `${itemCount} items • ${sizeKB} KB • ${formatTime(status?.lastRunAt, lang)}`)
                : (lang === 'mm' ? 'မသိမ်းရသေး' : 'Not cached yet')}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          running ? 'bg-blue-500/20 text-blue-400' :
          cached ? 'bg-green-500/20 text-green-400' :
          'bg-amber-500/20 text-amber-400'
        }`}>
          {running ? '⏳' : cached ? '✓' : '!'}
        </span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-white/8 p-4 space-y-3">

          {/* Storage summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 rounded-xl p-2 text-center">
              <HardDrive size={14} className="mx-auto text-white/40 mb-1" />
              <p className="text-sm font-bold text-white">{sizeKB}</p>
              <p className="text-[9px] text-white/40">KB</p>
            </div>
            <div className="bg-white/5 rounded-xl p-2 text-center">
              <Database size={14} className="mx-auto text-white/40 mb-1" />
              <p className="text-sm font-bold text-white">{itemCount}</p>
              <p className="text-[9px] text-white/40">{lang === 'mm' ? 'မျိုး' : 'items'}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-2 text-center">
              <Clock size={14} className="mx-auto text-white/40 mb-1" />
              <p className="text-[10px] font-bold text-white leading-tight">
                {formatTime(status?.lastRunAt, lang)}
              </p>
              <p className="text-[9px] text-white/40">{lang === 'mm' ? 'နောက်ဆုံး' : 'Last'}</p>
            </div>
          </div>

          {/* Item list */}
          {status?.items?.length > 0 && (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {status.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 py-1 text-xs">
                  {item.status === 'ok' ? (
                    <Check size={11} className="text-green-400 flex-shrink-0" />
                  ) : (
                    <X size={11} className="text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-white/70 flex-1 truncate font-myanmar">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-white/40 font-mono">
                    {item.status === 'ok' ? item.count : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Not-cached state */}
          {!cached && !running && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3">
              <p className="text-xs text-amber-400 font-myanmar">
                ⚠️ {lang === 'mm'
                  ? 'Data မသိမ်းရသေးပါ။ Online ရှိစဉ် App ကို ဖွင့်ထားပါ — Auto သိမ်းပါမည်။'
                  : 'Nothing cached yet. Keep the app open while online — it will auto-save.'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleRefresh}
              disabled={running}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600/30 border border-brand-400/40 text-brand-200 text-xs font-bold hover:bg-brand-600/40 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={12} className={running ? 'animate-spin' : ''} />
              {running ? (lang === 'mm' ? 'သိမ်းနေသည်' : 'Saving...') : (lang === 'mm' ? 'ပြန်သိမ်း' : 'Re-save')}
            </button>
            {cached && (
              <button
                onClick={handleClear}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/25 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* Info */}
          <p className="text-[9px] text-white/30 font-myanmar pt-1">
            💡 {lang === 'mm'
              ? 'Data တွေ localStorage မှာ သိမ်းထားသည်။ Offline ဖြစ်ရင် ဒီ Data တွေ ပြပါမည်။'
              : 'Data stored in localStorage. When offline, this data is shown.'}
          </p>
        </div>
      )}
    </div>
  )
}
