import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Flag, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { supabase } from '../lib/supabase'
import { useSEO } from '../hooks/useSEO'

const STATUS_META = {
  pending:   { mm: 'စစ်ဆေးဆဲ',  en: 'Pending',   cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30',  icon: Clock },
  resolved:  { mm: 'ဖြေရှင်းပြီး', en: 'Resolved',  cls: 'bg-green-500/15 text-green-400 border-green-500/30', icon: CheckCircle },
  dismissed: { mm: 'ပယ်ချပြီး',   en: 'Dismissed', cls: 'bg-white/10 text-white/50 border-white/15',         icon: XCircle },
}

const REASON_LABEL = {
  spam:          { mm: 'ကြော်ငြာ / Spam',  en: 'Spam' },
  fake:          { mm: 'မမှန်ကန်',         en: 'Fake' },
  inappropriate: { mm: 'မသင့်လျော်',        en: 'Inappropriate' },
  wrong_info:    { mm: 'အချက်အလက်မှား',    en: 'Wrong info' },
  closed:        { mm: 'ပိတ်ထား',           en: 'Closed' },
  other:         { mm: 'အခြား',             en: 'Other' },
}

export default function AdminReportsPage() {
  const navigate = useNavigate()
  const { isAdmin, isModerator } = useAuth()
  const { lang } = useLang()
  useSEO({ title: 'Reports' })

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('reports')
        .select('*, reporter:profiles!reporter_id(full_name, nickname)')
        .eq('status', tab)
        .order('created_at', { ascending: false })
        .limit(100)

      const listingIds = (data || []).filter(r => r.target_type === 'listing').map(r => r.target_id)
      let listingMap = {}
      if (listingIds.length) {
        const { data: listings } = await supabase
          .from('listings')
          .select('id, name, name_mm')
          .in('id', listingIds)
        listingMap = Object.fromEntries((listings || []).map(l => [l.id, l]))
      }

      setItems((data || []).map(r => ({ ...r, _target: listingMap[r.target_id] || null })))
    } catch (e) { console.warn(e) }
    setLoading(false)
  }, [tab])

  useEffect(() => { load() }, [load])

  async function updateStatus(id, status) {
    const { error } = await supabase
      .from('reports')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) setItems(prev => prev.filter(r => r.id !== id))
  }

  if (!isAdmin && !isModerator) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh] px-8 text-center">
        <p className="text-white/50 font-myanmar">🔒 Admin / Moderator သာ ကြည့်နိုင်သည်</p>
      </div>
    )
  }

  const TABS = [
    { id: 'pending',   mm: 'စစ်ဆေးဆဲ',   en: 'Pending' },
    { id: 'resolved',  mm: 'ဖြေရှင်းပြီး', en: 'Resolved' },
    { id: 'dismissed', mm: 'ပယ်ချပြီး',   en: 'Dismissed' },
  ]

  return (
    <div className="pb-8 min-h-[80dvh]">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              🚩 {lang === 'mm' ? 'Report များ' : 'Reports'}
            </h1>
            <p className="text-[10px] text-white/40 mt-0.5 font-myanmar">
              {lang === 'mm' ? items.length + ' ခု' : items.length + ' items'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 px-4 mb-4">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              'px-4 py-2 rounded-full text-xs font-semibold transition-colors ' +
              (tab === t.id
                ? 'bg-brand-600/60 text-brand-200 border border-brand-400/40'
                : 'bg-white/5 text-white/50 border border-white/10')
            }
          >
            {lang === 'mm' ? t.mm : t.en}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-2">
        {loading ? (
          [1,2,3].map(n => <div key={n} className="h-24 rounded-2xl bg-white/4 animate-pulse" />)
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl mb-3 block">✓</span>
            <p className="text-white/40 font-myanmar">
              {lang === 'mm' ? 'Report မရှိပါ' : 'No reports'}
            </p>
          </div>
        ) : (
          items.map(r => {
            const meta = STATUS_META[r.status] || STATUS_META.pending
            const Icon = meta.icon
            const targetName = r._target
              ? (lang === 'mm' ? (r._target.name_mm || r._target.name) : r._target.name)
              : r.target_id.slice(0, 8) + '…'
            return (
              <div key={r.id} className="card-dark rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Flag size={14} className="text-red-400 flex-shrink-0" />
                    <span className="text-xs text-white/70 font-mono">{r.target_type}</span>
                    <span className="text-[10px] text-white/40">
                      {REASON_LABEL[r.reason]?.[lang] || r.reason}
                    </span>
                  </div>
                  <span className={'flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ' + meta.cls}>
                    <Icon size={9} /> {lang === 'mm' ? meta.mm : meta.en}
                  </span>
                </div>

                <div className="text-sm text-white/80 font-myanmar truncate">{targetName}</div>

                {r.note && (
                  <p className="text-xs text-white/50 font-myanmar bg-white/4 rounded-lg p-2 line-clamp-3">
                    💬 {r.note}
                  </p>
                )}

                <div className="flex items-center justify-between text-[10px] text-white/30">
                  <span>{r.reporter?.full_name || r.reporter?.nickname || (lang === 'mm' ? 'ဧည့်သည်' : 'Guest')}</span>
                  <span>{new Date(r.created_at).toLocaleDateString('my-MM')}</span>
                </div>

                <div className="flex gap-2 pt-1">
                  {r.target_type === 'listing' && (
                    <button
                      onClick={() => navigate('/directory/' + r.target_id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-brand-300 bg-brand-600/10 rounded-xl hover:bg-brand-600/20 transition-colors"
                    >
                      <ExternalLink size={11} /> {lang === 'mm' ? 'ကြည့်' : 'View'}
                    </button>
                  )}
                  {r.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateStatus(r.id, 'resolved')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-green-400 bg-green-500/10 rounded-xl hover:bg-green-500/20 transition-colors"
                      >
                        <CheckCircle size={11} /> {lang === 'mm' ? 'ဖြေရှင်း' : 'Resolve'}
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, 'dismissed')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-white/40 bg-white/8 rounded-xl hover:bg-white/12 transition-colors"
                      >
                        <XCircle size={11} /> {lang === 'mm' ? 'ပယ်ချ' : 'Dismiss'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
