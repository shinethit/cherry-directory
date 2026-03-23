import { useState, useEffect } from 'react'
import { Plus, Trash2, ArrowLeft, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'

const CATS = [
  { id: 'all',         mm: 'အားလုံး',          en: 'All',           icon: '📋' },
  { id: 'health',      mm: 'ကျန်းမာရေး',       en: 'Health',        icon: '🏥' },
  { id: 'vaccination', mm: 'ဆေးထိုး',          en: 'Vaccination',   icon: '💉' },
  { id: 'cleanup',     mm: 'သန့်ရှင်းရေး',     en: 'Cleanup',       icon: '🧹' },
  { id: 'water',       mm: 'ရေပိတ်',           en: 'Water',         icon: '💧' },
  { id: 'electricity', mm: 'လျှပ်စစ်',          en: 'Electricity',   icon: '⚡' },
  { id: 'traffic',     mm: 'ယာဉ်ကြောပိတ်',     en: 'Traffic',       icon: '🚧' },
  { id: 'community',   mm: 'ရပ်ကွက်',           en: 'Community',     icon: '🏘️' },
  { id: 'government',  mm: 'ထုတ်ပြန်ချက်',      en: 'Government',    icon: '🏛️' },
  { id: 'emergency',   mm: 'အရေးပေါ်',          en: 'Emergency',     icon: '🚨' },
  { id: 'other',       mm: 'အခြား',             en: 'Other',         icon: '📌' },
]

function timeAgo(iso, lang) {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 60) return `${m}${lang === 'mm' ? 'မိနစ်' : 'm'}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}${lang === 'mm' ? 'နာရီ' : 'h'}`
  return `${Math.floor(h/24)}${lang === 'mm' ? 'ရက်' : 'd'}`
}

function NoticeCard({ notice, lang, isMod, onDelete }) {
  const cat = CATS.find(c => c.id === notice.category)
  const isUrgent = notice.is_urgent || notice.category === 'emergency'
  return (
    <div className={`card-dark rounded-2xl p-4 space-y-2 border-l-4 ${isUrgent ? 'border-l-red-500/70' : notice.is_pinned ? 'border-l-gold-500/60' : 'border-l-brand-500/40'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg">{cat?.icon}</span>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${isUrgent ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-brand-600/20 text-brand-300 border-brand-400/20'}`}>
            {lang === 'mm' ? cat?.mm : cat?.en}
          </span>
          {notice.is_pinned && <span className="text-[9px] text-gold-400">📌</span>}
          {isUrgent && <span className="text-[9px] text-red-400 font-bold">⚠️ Urgent</span>}
          {notice.ward && <span className="text-[9px] text-white/30 font-myanmar">{notice.ward}</span>}
        </div>
        {isMod && (
          <button onClick={() => onDelete(notice.id)} className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 text-red-400 transition-colors flex-shrink-0">
            <Trash2 size={12} />
          </button>
        )}
      </div>
      <h3 className="font-display font-semibold text-sm text-white">{lang === 'mm' ? (notice.title_mm || notice.title) : notice.title}</h3>
      {(notice.content_mm || notice.content) && (
        <p className="text-xs text-white/60 font-myanmar leading-relaxed">{lang === 'mm' ? (notice.content_mm || notice.content) : notice.content}</p>
      )}
      <div className="flex items-center gap-2 text-[9px] text-white/25">
        <span className="font-myanmar">{notice.poster_name || 'Community'}</span>
        <span>•</span>
        <span>{timeAgo(notice.posted_at, lang)}</span>
      </div>
    </div>
  )
}

function PostForm({ onClose, onSuccess, lang }) {
  const { user, profile, isModerator } = useAuth()
  const [form, setForm] = useState({ title: '', title_mm: '', content_mm: '', category: 'community', ward: '', is_urgent: false })
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit() {
    if (!form.title && !form.title_mm) return
    setSubmitting(true)
    // Auto-approve if moderator, else pending
    const status = isModerator ? 'approved' : 'pending'
    await supabase.from('notices').insert({
      ...form,
      poster_id: user?.id || null,
      poster_name: profile?.full_name || profile?.nickname || form.poster_name || 'Community',
      status,
    })
    setSubmitting(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0d0015] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
        <h2 className="font-display font-bold text-base text-white">{lang === 'mm' ? 'ကြေညာချက် တင်မည်' : 'Post Notice'}</h2>
        <button onClick={submit} disabled={submitting || (!form.title && !form.title_mm)} className="btn-primary text-xs px-4 py-2">{submitting ? '...' : lang === 'mm' ? 'တင်မည်' : 'Post'}</button>
      </div>
      <div className="px-4 py-4 space-y-4 pb-8">
        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'အမျိုးအစား' : 'Category'}</label>
          <div className="flex gap-2 flex-wrap">
            {CATS.filter(c => c.id !== 'all').map(c => (
              <button key={c.id} onClick={() => set('category', c.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border ${form.category === c.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>
                {c.icon} {lang === 'mm' ? c.mm : c.en}
              </button>
            ))}
          </div>
        </div>
        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ကြေညာချက် ခေါင်းစဉ် (မြန်မာ)' : 'Title (Myanmar)'} *</label><input value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" /></div>
        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'အကြောင်းအရာ' : 'Content'}</label><textarea value={form.content_mm} onChange={e => set('content_mm', e.target.value)} className="input-dark font-myanmar resize-none h-28" /></div>
        <div><label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ရပ်ကွက်/နေရာ' : 'Ward/Area'}</label><input value={form.ward} onChange={e => set('ward', e.target.value)} className="input-dark font-myanmar" placeholder={lang === 'mm' ? 'ဥပမာ: ဗိုလ်ချုပ်ရပ်ကွက်' : 'e.g. Bogyoke Ward'} /></div>
        <button onClick={() => set('is_urgent', !form.is_urgent)} className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${form.is_urgent ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-white/50'}`}>
          <AlertTriangle size={16} /> {lang === 'mm' ? 'အရေးပေါ် ကြေညာချက်' : 'Mark as Emergency/Urgent'}
        </button>
        {!isModerator && <p className="text-[10px] text-amber-400/70 bg-amber-500/8 border border-amber-500/15 rounded-xl p-3 font-myanmar">ကြေညာချက်ကို Admin/Mod မှ စစ်ဆေးပြီးနောက် ထုတ်ဖော်မည်</p>}
      </div>
    </div>
  )
}

export default function NoticeBoardPage() {
  const { lang } = useLang()
  const { isModerator } = useAuth()
  useSEO({ title: lang === 'mm' ? 'ကြေညာချက်ဘုတ်' : 'Notice Board' })

  const [notices, setNotices]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [catFilter, setCat]     = useState('all')
  const [showForm, setShowForm] = useState(false)
  // Moderator: show pending count
  const [pendingCount, setPendingCount] = useState(0)
  const [showPending, setShowPending]   = useState(false)
  const [pendingList, setPendingList]   = useState([])

  async function load() {
    setLoading(true)
    let q = supabase.from('notices').select('*').eq('status', 'approved').order('is_pinned', { ascending: false }).order('is_urgent', { ascending: false }).order('posted_at', { ascending: false }).limit(50)
    if (catFilter !== 'all') q = q.eq('category', catFilter)
    const { data } = await q
    setNotices(data || [])
    if (isModerator) {
      const { count } = await supabase.from('notices').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      setPendingCount(count || 0)
    }
    setLoading(false)
  }

  async function loadPending() {
    const { data } = await supabase.from('notices').select('*').eq('status', 'pending').order('posted_at', { ascending: false })
    setPendingList(data || [])
  }

  useEffect(() => { load() }, [catFilter])
  useEffect(() => { if (showPending) loadPending() }, [showPending])

  async function deleteNotice(id) {
    if (!confirm(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete this notice?')) return
    await supabase.from('notices').delete().eq('id', id)
    load()
  }

  async function approveNotice(id) {
    await supabase.from('notices').update({ status: 'approved' }).eq('id', id)
    loadPending(); load()
  }

  return (
    <div className="pb-8">
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">📢 {lang === 'mm' ? 'ကြေညာချက်ဘုတ်' : 'Notice Board'}</h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">{lang === 'mm' ? 'ရပ်ကွက် ကြေညာချက်များ' : 'Community notices & announcements'}</p>
        </div>
        <div className="flex gap-2">
          {isModerator && pendingCount > 0 && (
            <button onClick={() => setShowPending(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-bold">
              ⏳ {pendingCount}
            </button>
          )}
          <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5"><Plus size={14} /> Post</button>
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="relative">
          <select
            value={catFilter}
            onChange={e => setCat(e.target.value)}
            className="w-full appearance-none border border-white/12 text-white text-sm rounded-xl px-4 py-2.5 pr-10 outline-none"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}
          >
            {CATS.map(c => (
              <option key={c.id} value={c.id} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                {c.icon} {lang === 'mm' ? c.mm : c.en}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      <div className="px-4 space-y-2">
        {loading ? [1,2,3].map(n => <div key={n} className="h-24 rounded-2xl shimmer" />) :
         notices.length === 0 ? <div className="flex flex-col items-center py-14 text-center"><span className="text-4xl mb-3">📋</span><p className="text-white/40 font-display font-semibold">{lang === 'mm' ? 'ကြေညာချက် မရှိသေး' : 'No notices yet'}</p></div> :
         notices.map(n => <NoticeCard key={n.id} notice={n} lang={lang} isMod={isModerator} onDelete={deleteNotice} />)}
      </div>

      {/* Pending approval panel */}
      {showPending && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-[#0d0015] overflow-y-auto">
          <div className="flex items-center gap-3 px-4 py-3 glass border-b border-white/8 sticky top-0">
            <button onClick={() => setShowPending(false)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"><ArrowLeft size={18} className="text-white" /></button>
            <h2 className="font-display font-bold text-base text-white">Pending Notices ({pendingList.length})</h2>
          </div>
          <div className="px-4 py-4 space-y-3">
            {pendingList.map(n => (
              <div key={n.id} className="card-dark rounded-2xl p-4 space-y-3">
                <p className="text-sm font-display font-semibold text-white">{n.title_mm || n.title}</p>
                {n.content_mm && <p className="text-xs text-white/50 font-myanmar">{n.content_mm}</p>}
                <div className="flex gap-2">
                  <button onClick={() => approveNotice(n.id)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-green-500/15 border border-green-500/25 text-green-400 text-xs font-bold hover:bg-green-500/25">✓ Approve</button>
                  <button onClick={() => { supabase.from('notices').delete().eq('id', n.id); loadPending() }} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-bold hover:bg-red-500/25">✕ Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && <PostForm lang={lang} onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); load() }} />}
    </div>
  )
}
