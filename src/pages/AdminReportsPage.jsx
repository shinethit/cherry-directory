import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Flag, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { useSEO } from '../hooks/useSEO'
import { showError, showSuccess } from '../lib/toast'
import { formatMyanmarDate } from '../lib/myanmarDate'
import { confirmDialog } from '../lib/confirmDialog'
import { useAuditLog } from '../hooks/useAuditLog'

const STATUS_META = {
  pending:   { mm: 'စစ်ဆေးဆဲ',  en: 'Pending',   cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30',  icon: Clock },
  reviewed:  { mm: 'ဖြေရှင်းပြီး', en: 'Reviewed',  cls: 'bg-green-500/15 text-green-400 border-green-500/30', icon: CheckCircle },
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
  const { log } = useAuditLog() // S14 (v9.17)
  const navigate = useNavigate()
  const { user, isAdmin, isModerator, loading: authLoading } = useAuth()
  const { lang } = useLang()
  useSEO({ title: 'Reports' })

  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(null) // S16 (v9.17): tab total from a head count, not the loaded page
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState('pending')
  const [actionBusy, setActionBusy] = useState(null)
  // Sort order (G21) — newest first by default.
  const [sortOrder, setSortOrder] = useState('new')
  // "Show more" paging — the old .limit(100) silently hid everything
  // past the first 100 reports.
  const [limit, setLimit] = useState(100)

  // Guard BEFORE fetching: non-admins never trigger the query.
  const load = useCallback(async () => {
    if (authLoading) return
    if (!isAdmin && !isModerator) { setLoading(false); return }
    setLoading(true)
    setLoadError('')
    try {
      // 30 s timeout (was none): a hung query left the list on skeletons forever.
      // S16 (v9.17): the header total is the tab's full count, not the
      // loaded page length. A failed count falls back to the page length.
      try {
        const { count } = await withTimeout(supabase
          .from('reports')
          .select('*', { count: 'exact', head: true })
          .eq('status', tab), 30000, 'Reports count')
        setTotalCount(count ?? null)
      } catch (countErr) { console.warn('Reports count failed:', countErr); setTotalCount(null) }
      const { data, error } = await withTimeout(supabase
        .from('reports')
        .select('*, reporter:profiles!reporter_id(full_name, nickname)')
        .eq('status', tab)
        .order('created_at', { ascending: sortOrder === 'old' })
        .limit(limit), 30000, 'Reports')
      if (error) throw error

      const listingIds = (data || []).filter(r => r.target_type === 'listing').map(r => r.target_id)
      let listingMap = {}
      if (listingIds.length) {
        // Target names are secondary: a failed lookup must not fail
        // the whole report list (it used to throw into the same catch).
        try {
          const { data: listings } = await withTimeout(supabase
            .from('listings')
            .select('id, name, name_mm')
            .in('id', listingIds), 30000, 'Report targets')
          listingMap = Object.fromEntries((listings || []).map(l => [l.id, l]))
        } catch (nameErr) { console.warn('Report target names failed:', nameErr) }
      }

      setItems((data || []).map(r => ({ ...r, _target: listingMap[r.target_id] || null })))
    } catch (e) { console.warn(e); setLoadError('Report များ ရယူမရပါ') }
    setLoading(false)
  }, [tab, limit, sortOrder, authLoading, isAdmin, isModerator])

  useEffect(() => { load() }, [load])

  // Close the loop: reviewing a listing report also suspends the
  // reported listing (it stays suspended until an admin re-approves
  // it). Always records who reviewed it and when.
  // AR1 (v9.20): claim the report FIRST (guarded .eq('status','pending')),
  // suspend only on a successful claim. The old order suspended first, so
  // when another admin had already decided, the listing ended up suspended
  // while the toast said the decision failed. If the suspend then fails,
  // the claim is rolled back so the report stays pending and retryable.
  async function updateStatus(report, status) {
    if (status === 'reviewed') {
      if (!(await confirmDialog(lang === 'mm' ? 'ဤ Report ကို ဖြေရှင်းပြီး သတ်မှတ်မည်လား? ဆက်စပ် လုပ်ငန်းကို ဆိုင်းငံ့ထားမည်။' : 'Mark this report as resolved? The reported listing will be suspended.'))) return
    } else if (!(await confirmDialog(lang === 'mm' ? 'ဤ Report ကို ပယ်ချမည်လား?' : 'Dismiss this report?'))) return
    setActionBusy(report.id)
    try {
      // N11 (v9.17): only a still-pending report can be decided — two
      // admins deciding at once must not both succeed.
      const { data: updated, error } = await supabase
        .from('reports')
        .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user?.id || null })
        .eq('id', report.id)
        .eq('status', 'pending')
        .select('id')
      if (error) {
        console.error('Report update error:', error)
        showError('Report အပ်ဒိတ်လုပ်ရာတွင် အမှားရှိသည်')
        return
      }
      if (!updated || updated.length === 0) {
        showError('ဤ Report ကို အခြား Admin မှ ဆုံးဖြတ်ပြီးဖြစ်သည်')
        load()
        return
      }
      if (status === 'reviewed' && report.target_type === 'listing' && report.target_id) {
        const { error: susErr } = await supabase
          .from('listings')
          .update({ status: 'suspended' })
          .eq('id', report.target_id)
        if (susErr) {
          console.error('Suspend listing error:', susErr)
          // Roll the claim back — otherwise the report sits in Reviewed
          // while the listing stays live, with no retry.
          await supabase.from('reports').update({ status: 'pending', reviewed_at: null, reviewed_by: null }).eq('id', report.id)
          showError('လုပ်ငန်း ဆိုင်းငံ့မရပါ — Report ကို မဖြေရှင်းရသေးပါ')
          return
        }
      }
      // S14 (v9.17): review/dismiss decisions are audit-logged.
      log({ action: status === 'reviewed' ? 'review_report' : 'dismiss_report', table: 'reports', id: report.id, name: report._target?.name_mm || report._target?.name || report.target_id, before: { status: 'pending' }, after: { status } })
        .then(ok => { if (!ok) console.warn('Audit log failed for report decision') })
      showSuccess(status === 'reviewed' ? '✓ ဖြေရှင်းပြီးပါပြီ' : 'Report ပယ်ချပြီးပါပြီ')
      setItems(prev => prev.filter(r => r.id !== report.id))
    } finally {
      setActionBusy(null)
    }
  }

  // While the role is still loading, wait — do not flash the lock
  // screen (or the panel) before the role is known.
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh] px-8 text-center">
        <p className="text-white/50 font-myanmar">စစ်ဆေးနေသည်...</p>
      </div>
    )
  }

  if (!isAdmin && !isModerator) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60dvh] px-8 text-center gap-3">
        <p className="text-white/50 font-myanmar">🔒 Admin / Moderator သာ ကြည့်နိုင်သည်</p>
        <button onClick={() => navigate('/')} className="btn-primary text-xs px-4 py-2">Home သို့ ပြန်သွားမည်</button>
      </div>
    )
  }

  const TABS = [
    { id: 'pending',   mm: 'စစ်ဆေးဆဲ',   en: 'Pending' },
    { id: 'reviewed',  mm: 'ဖြေရှင်းပြီး', en: 'Reviewed' },
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
            <p className="text-[10px] text-white/60 mt-0.5 font-myanmar">
              {lang === 'mm' ? (totalCount ?? items.length) + ' ခု' : (totalCount ?? items.length) + ' items'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 px-4 mb-4">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setLimit(100) }}
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
        {/* Sort by date (G21) */}
        <select
          value={sortOrder}
          onChange={e => { setSortOrder(e.target.value); setLimit(100) }}
          className="select-dark font-semibold ml-auto"
          style={{ backgroundColor: '#1a0030' }}
        >
          <option value="new">ရက်စွဲ အသစ်</option>
          <option value="old">ရက်စွဲ အဟောင်း</option>
        </select>
      </div>

      <div className="px-4 space-y-2">
        {loading ? (
          [1,2,3].map(n => <div key={n} className="h-24 rounded-2xl bg-white/4 animate-pulse" />)
        ) : loadError ? (
          <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
            <p className="text-sm text-red-400 font-myanmar">Report များ ရယူရာတွင် အမှားဖြစ်သွားသည်</p>
            <p className="text-[10px] text-white/60">{loadError}</p>
            <button onClick={load} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl mb-3 block">✓</span>
            <p className="text-white/60 font-myanmar">
              {lang === 'mm' ? 'Report မရှိပါ' : 'No reports'}
            </p>
          </div>
        ) : (
          items.map(r => {
            const meta = STATUS_META[r.status] || STATUS_META.pending
            const Icon = meta.icon
            const targetName = r._target
              ? (lang === 'mm' ? (r._target.name_mm || r._target.name) : r._target.name)
              // target_id is nullable — a null target used to crash the
              // whole page at .slice(). Show '—' instead.
              : (r.target_id ? r.target_id.slice(0, 8) + '…' : '—')
            return (
              <div key={r.id} className="card-dark rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Flag size={14} className="text-red-400 flex-shrink-0" />
                    <span className="text-xs text-white/70 font-mono">{r.target_type}</span>
                    <span className="text-[10px] text-white/60">
                      {REASON_LABEL[r.reason]?.[lang] || r.reason}
                    </span>
                  </div>
                  <span className={'flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ' + meta.cls}>
                    <Icon size={9} /> {lang === 'mm' ? meta.mm : meta.en}
                  </span>
                </div>

                <div className="text-sm text-white/80 font-myanmar truncate">{targetName}</div>

                {/* Short reason/summary per report (G14) */}
                <p className="text-xs text-white/50 font-myanmar">
                  အကြောင်းရင်း: {REASON_LABEL[r.reason]?.[lang] || r.reason}
                </p>

                {r.note && (
                  <p className="text-xs text-white/50 font-myanmar bg-white/4 rounded-lg p-2 line-clamp-3">
                    💬 {r.note}
                  </p>
                )}

                <div className="flex items-center justify-between text-[10px] text-white/60">
                  <span>{r.reporter?.full_name || r.reporter?.nickname || (lang === 'mm' ? 'ဧည့်သည်' : 'Guest')}</span>
                  <span>{formatMyanmarDate(r.created_at)}</span>
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
                  {r.target_type === 'lost_found' && (
                    <button
                      onClick={() => navigate('/lost-found/' + r.target_id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-brand-300 bg-brand-600/10 rounded-xl hover:bg-brand-600/20 transition-colors"
                    >
                      <ExternalLink size={11} /> {lang === 'mm' ? 'ကြည့်' : 'View'}
                    </button>
                  )}
                  {r.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateStatus(r, 'reviewed')}
                        disabled={actionBusy === r.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-green-400 bg-green-500/10 rounded-xl hover:bg-green-500/20 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle size={11} /> {actionBusy === r.id ? '...' : (lang === 'mm' ? 'ဖြေရှင်း' : 'Resolve')}
                      </button>
                      <button
                        onClick={() => updateStatus(r, 'dismissed')}
                        disabled={actionBusy === r.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-white/60 bg-white/8 rounded-xl hover:bg-white/12 transition-colors disabled:opacity-50"
                      >
                        <XCircle size={11} /> {actionBusy === r.id ? '...' : (lang === 'mm' ? 'ပယ်ချ' : 'Dismiss')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
        {!loading && !loadError && items.length > 0 && items.length >= limit && (
          <button onClick={() => setLimit(l => l + 100)} className="w-full py-3 rounded-2xl bg-white/6 border border-white/10 text-sm text-white/70 hover:bg-white/10">
            {lang === 'mm' ? 'နောက်ထပ် ပြမည်' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  )
}
