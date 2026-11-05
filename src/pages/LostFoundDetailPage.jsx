import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin, CheckCircle, AlertTriangle, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { Skeleton } from '../components/UI'
import { getOptimizedUrl } from '../lib/cloudinary'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import 'yet-another-react-lightbox/plugins/thumbnails.css'
import { confirmDialog } from '../lib/confirmDialog'
import { showError, showSuccess } from '../lib/toast'
import { maskPhone, toTelHref } from '../lib/phoneMask'

const LF_TYPES = [
  { id: 'lost',  mm: 'ပျောက်ဆုံး', en: 'Lost' },
  { id: 'found', mm: 'တွေ့ရှိ',   en: 'Found' },
]
const LF_CATS = [
  { id: 'person', mm: 'လူ',        en: 'Person' },
  { id: 'child',  mm: 'ကလေး',     en: 'Child' },
  { id: 'animal', mm: 'တိရိစ္ဆာန်', en: 'Animal' },
  { id: 'item',   mm: 'ပစ္စည်း',   en: 'Item' },
]

export default function LostFoundDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { lang } = useLang()
  const { user, isModerator, isLoggedIn } = useAuth()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [claimed, setClaimed] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportReason, setReportReason] = useState('')

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  async function loadPost() {
    setLoading(true)
    setLoadError('')
    // 30 s timeout + try/catch (was a bare await): a hung or rejected
    // query left the page on skeletons forever with no retry.
    try {
      const { data, error } = await withTimeout(supabase.from('lost_found').select('*').eq('id', id).single(), 30000, 'Lost & found post')
      if (error) {
        setLoadError(error.message)
        setPost(null)
      } else {
        setPost(data)
        setEditForm(data)
        if (data?.images?.length) {
          setLightboxImages(data.images.map(src => ({ src })))
        }
      }
    } catch (e) {
      console.warn(e)
      setLoadError('တင်မရပါ — ပြန်ကြိုးစားမည်')
      setPost(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadPost()
  }, [id])

  async function handleDelete() {
    if (!(await confirmDialog(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?', { danger: true }))) return
    const { error } = await supabase.from('lost_found').delete().eq('id', id)
    if (error) showError(error.message)
    else navigate('/lost-found')
  }

  const [saving, setSaving] = useState(false)

  async function handleUpdate() {
    // N24 (v9.17): a blank title violates the NOT NULL column — require
    // at least one title, and block double-submit while saving.
    if (!editForm.title?.trim() && !editForm.title_mm?.trim()) { showError('ခေါင်းစဉ် (မြန်မာ သို့မဟုတ် English) တစ်ခု ထည့်ပါ'); return }
    if (saving) return
    setSaving(true)
    // Whitelist editable columns — never send id/timestamps through.
    const payload = {
      title: editForm.title || editForm.title_mm || null,
      title_mm: editForm.title_mm || null,
      description_mm: editForm.description_mm || null,
      location_mm: editForm.location_mm || null,
      contact_phone: editForm.contact_phone || null,
      contact_name: editForm.contact_name || null,
      reward: editForm.reward || null,
      type: editForm.type,
      category: editForm.category,
      is_urgent: !!editForm.is_urgent,
    }
    const { error } = await supabase.from('lost_found').update(payload).eq('id', id)
    setSaving(false)
    if (error) showError(error.message)
    else {
      setPost(p => ({ ...p, ...payload }))
      setEditing(false)
    }
  }

  async function handleResolve() {
    if (!(await confirmDialog(lang === 'mm' ? 'ဒီ Post ကို ဖြေရှင်းပြီးအဖြစ် သတ်မှတ်မည်လား?' : 'Mark this post as resolved?'))) return
    setResolving(true)
    const { error } = await supabase.from('lost_found').update({ status: 'resolved' }).eq('id', id)
    setResolving(false)
    if (error) { showError(error.message); return }
    setPost(p => ({ ...p, status: 'resolved' }))
    showSuccess(lang === 'mm' ? 'ဖြေရှင်းပြီးအဖြစ် သတ်မှတ်ပြီးပါပြီ' : 'Marked as resolved')
  }

  // Claim: the lost_found status CHECK is ('active','resolved','expired') —
  // there is NO 'claimed' status, so a claim cannot change the status.
  // Claiming only reveals the poster's contact to a logged-in user.
  function handleClaim() {
    if (!isLoggedIn) {
      showError(lang === 'mm' ? 'ပိုင်ဆိုင်ကြောင်း တောင်းဆိုရန် Login ဝင်ပါ' : 'Please log in to claim')
      return
    }
    setClaimed(true)
    // M3 (v9.17): no claim record is made server-side — the toast must
    // not say one was. Claiming only reveals the poster's contact.
    showSuccess(lang === 'mm' ? 'ဆက်သွယ်ရန် အချက်အလက်ကို အောက်မှာ ပြသထားသည်' : 'Contact details are shown below')
  }

  async function handleReport() {
    if (!reportReason.trim()) return
    // N25 (v9.17): one report per user per post per 24 h — repeated taps
    // used to stack identical rows for the admin to triage.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const coolMsg = lang === 'mm' ? 'ဤ Post ကို ၂၄ နာရီအတွင်း Report တင်ပြီးဖြစ်သည်' : 'You already reported this post in the last 24 hours'
    if (user?.id) {
      const { data: existing } = await supabase.from('reports')
        .select('id').eq('target_type', 'lost_found').eq('target_id', id)
        .eq('reporter_id', user.id).gte('created_at', since).limit(1)
      if (existing && existing.length > 0) { showError(coolMsg); return }
    } else {
      try {
        const last = Number(localStorage.getItem('cherry-report-lostfound-' + id) || 0)
        if (last && Date.now() - last < 24 * 60 * 60 * 1000) { showError(coolMsg); return }
      } catch { /* storage unavailable — fall through to the insert */ }
    }
    const { error } = await supabase.from('reports').insert({
      target_type: 'lost_found',
      target_id: id,
      reason: reportReason.trim(),
      reporter_id: user?.id || null,
      status: 'pending',
    })
    if (error) { showError(error.message); return }
    if (!user?.id) { try { localStorage.setItem('cherry-report-lostfound-' + id, String(Date.now())) } catch { /* ignore */ } }
    setReporting(false)
    setReportReason('')
    showSuccess(lang === 'mm' ? 'Report တင်ပြီးပါပြီ — Admin မှ စစ်ဆေးမည်' : 'Report submitted — an admin will review it')
  }

  function openLightbox(startIndex = 0) {
    setLightboxIndex(startIndex)
    setLightboxOpen(true)
  }

  if (loading) return <div className="p-4"><Skeleton className="h-64" /></div>
  if (loadError) return (
    <div className="p-4 text-center">
      <p className="text-red-400 text-sm mb-3">{loadError}</p>
      <button onClick={loadPost} className="btn-primary text-xs px-4 py-2">{lang === 'mm' ? 'ပြန်ကြိုးစားမည်' : 'Retry'}</button>
    </div>
  )
  if (!post) return (
    <div className="p-4 text-center space-y-4">
      <p className="text-white/60">မတွေ့ပါ</p>
      <button onClick={() => navigate('/lost-found')} className="btn-primary text-sm px-4 py-3 min-h-[44px]">
        ← {lang === 'mm' ? 'Lost & Found သို့ ပြန်သွားမည်' : 'Back to Lost & Found'}
      </button>
    </div>
  )

  const isLost = post.type === 'lost'
  const cover = post.images?.[0] ? getOptimizedUrl(post.images[0], { width: 500 }) : null
  const isOwner = user?.id === post.poster_id
  const canEdit = isOwner || isModerator
  // Contact is shown directly for 'lost' posts (the poster wants to be
  // reached). For 'found' posts it is revealed only after a logged-in
  // user claims the item — or to the owner / a moderator.
  const contactVisible = isOwner || isModerator || claimed || post.type === 'lost'

  if (editing) {
    return (
      <div className="pb-8">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => setEditing(false)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <h1 className="font-display font-bold text-lg text-white">ပြင်ဆင်မည်</h1>
          <button onClick={handleUpdate} disabled={saving} className="btn-primary text-xs px-4 py-2 disabled:opacity-50">{saving ? '...' : 'သိမ်းမည်'}</button>
        </div>
        <div className="px-4 space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1.5">အမျိုးအစား</label>
            <div className="flex gap-2">
              {LF_TYPES.map(t => (
                <button key={t.id} onClick={() => setEditForm({...editForm, type: t.id})} className={`flex-1 py-2 rounded-xl text-sm font-bold border ${editForm.type === t.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>{lang === 'mm' ? t.mm : t.en}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">အုပ်စု</label>
            <div className="flex gap-2 flex-wrap">
              {LF_CATS.map(c => (
                <button key={c.id} onClick={() => setEditForm({...editForm, category: c.id})} className={`px-3 py-1.5 rounded-full text-xs border ${editForm.category === c.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>{lang === 'mm' ? c.mm : c.en}</button>
              ))}
            </div>
          </div>
          <input type="text" value={editForm.title_mm || ''} onChange={e => setEditForm({...editForm, title_mm: e.target.value})} className="input-dark" placeholder="ခေါင်းစဉ်" />
          <input type="text" value={editForm.title || ''} onChange={e => setEditForm({...editForm, title: e.target.value})} className="input-dark" placeholder="Title (English)" />
          <textarea value={editForm.description_mm || ''} onChange={e => setEditForm({...editForm, description_mm: e.target.value})} className="input-dark resize-none h-32" placeholder="ဖော်ပြချက်" />
          <input type="text" value={editForm.location_mm || ''} onChange={e => setEditForm({...editForm, location_mm: e.target.value})} className="input-dark" placeholder="နေရာ" />
          <input type="text" value={editForm.contact_name || ''} onChange={e => setEditForm({...editForm, contact_name: e.target.value})} className="input-dark" placeholder="ဆက်သွယ်ရမည့်သူ" />
          <input type="text" value={editForm.contact_phone || ''} onChange={e => setEditForm({...editForm, contact_phone: e.target.value})} className="input-dark" placeholder="ဖုန်း" />
          <input type="text" value={editForm.reward || ''} onChange={e => setEditForm({...editForm, reward: e.target.value})} className="input-dark" placeholder="ဆုကြေး" />
          <button onClick={() => setEditForm({...editForm, is_urgent: !editForm.is_urgent})} className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl border text-sm ${editForm.is_urgent ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/10 text-white/50'}`}>
            ⚠️ {lang === 'mm' ? 'Urgent — အရေးပေါ်' : 'Mark as Urgent'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Pencil size={14} />
            </button>
            <button onClick={handleDelete} className="w-8 h-8 rounded-lg btn-danger flex items-center justify-center">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {cover && (
        <div className="mx-4 rounded-2xl overflow-hidden h-56 mb-4 cursor-pointer" onClick={() => openLightbox(0)}>
          <img src={cover} alt={post.title_mm || post.title} className="w-full h-full object-cover hover:scale-105 transition" />
        </div>
      )}

      <div className="px-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
            isLost ? 'bg-red-500/15 text-red-400 border-red-500/25' : 'bg-green-500/15 text-green-400 border-green-500/25'
          }`}>
            {isLost ? 'ပျောက်ဆုံး' : 'တွေ့ရှိ'}
          </span>
          {post.is_urgent && <span className="text-[9px] text-amber-400 font-bold">⚠️ Urgent</span>}
        </div>

        <h1 className="font-display font-bold text-2xl text-white">{lang === 'mm' ? (post.title_mm || post.title) : (post.title || post.title_mm)}</h1>

        {post.description_mm && (
          <p className="text-sm text-white/70 font-myanmar leading-relaxed whitespace-pre-wrap">{post.description_mm}</p>
        )}

        {post.location_mm && (
          <div className="flex items-center gap-2 text-white/60">
            <MapPin size={14} />
            <span className="text-sm font-myanmar">{post.location_mm}</span>
          </div>
        )}

        {post.reward && (
          <div className="bg-gold-500/10 border border-gold-500/30 rounded-xl p-3">
            <p className="text-gold-400 text-sm font-bold">ဆုကြေး</p>
            <p className="text-white/80 text-sm">{post.reward}</p>
          </div>
        )}

        {contactVisible ? (
          <>
            {post.contact_phone && (
              isLoggedIn ? (
                <a href={toTelHref(post.contact_phone, isLoggedIn)} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-600/20 border border-green-500/30 text-green-400 font-semibold text-sm hover:bg-green-600/30 transition-colors">
                  <Phone size={16} /> {post.contact_name ? `${post.contact_name} · ` : ''}{post.contact_phone}
                </a>
              ) : (
                <button onClick={() => navigate('/login')} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-600/10 border border-green-500/20 text-green-400/80 font-semibold text-sm hover:bg-green-600/20 transition-colors w-full">
                  <Phone size={16} /> {post.contact_name ? `${post.contact_name} · ` : ''}{maskPhone(post.contact_phone, false)} · {lang === 'mm' ? 'Login ဝင်မှ ဖုန်းခေါ်နိုင်မည်' : 'Login to call'}
                </button>
              )
            )}
            {!post.contact_phone && post.contact_name && (
              <p className="text-sm text-white/50 font-myanmar">ဆက်သွယ်ရမည့်သူ: {post.contact_name}</p>
            )}
            {!isLoggedIn && post.contact_phone && (
              <p className="text-[10px] text-white/60 text-center font-myanmar">ဖုန်းအပြည့်အစုံ မြင်ရန် Login ဝင်ပါ</p>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <button onClick={handleClaim} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-600/30 border border-brand-400/40 text-brand-200 font-semibold text-sm hover:bg-brand-600/40 transition-colors">
              🙋 {lang === 'mm' ? 'ဒါ ကျွန်တော့်ပစ္စည်းပါ' : 'This is mine'}
            </button>
            <p className="text-[10px] text-white/60 text-center font-myanmar">ပိုင်ဆိုင်ကြောင်း တောင်းဆိုပြီးမှ ပိုင်ရှင်နှင့် ဆက်သွယ်နိုင်မည် (Login လိုအပ်သည်)</p>
          </div>
        )}

        {claimed && post.type === 'found' && (
          <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl p-3 font-myanmar">✓ ပိုင်ဆိုင်ကြောင်း တောင်းဆိုချက် မှတ်တမ်းတင်ပြီးပါပြီ — အထက်ပါ ဖုန်းဖြင့် ပိုင်ရှင်ကို ဆက်သွယ်ပါ</p>
        )}

        {post.status === 'resolved' && (
          <div className="flex items-center gap-2 text-green-400 bg-green-500/10 rounded-xl p-3">
            <CheckCircle size={16} />
            <span className="text-sm font-myanmar">ဖြေရှင်းပြီးပါပြီ</span>
          </div>
        )}

        {canEdit && post.status !== 'resolved' && (
          <button onClick={handleResolve} disabled={resolving} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-600/20 border border-green-500/30 text-green-400 font-semibold text-sm hover:bg-green-600/30 transition-colors disabled:opacity-50">
            <CheckCircle size={16} /> {resolving ? '...' : (lang === 'mm' ? 'ဖြေရှင်းပြီးပါပြီ' : 'Mark as resolved')}
          </button>
        )}

        {/* Report */}
        {!reporting ? (
          <button onClick={() => setReporting(true)} className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60 hover:text-red-400 hover:border-red-500/30 transition-colors">
            🚩 {lang === 'mm' ? 'Report လုပ်မည်' : 'Report this post'}
          </button>
        ) : (
          <div className="space-y-2 rounded-2xl bg-white/5 border border-white/10 p-3">
            <input
              type="text"
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              placeholder={lang === 'mm' ? 'Report လုပ်ရသည့် အကြောင်းရင်း...' : 'Reason for reporting...'}
              className="input-dark font-myanmar"
            />
            <div className="flex gap-2">
              <button onClick={handleReport} disabled={!reportReason.trim()} className="flex-1 py-2 rounded-xl btn-danger text-xs font-bold disabled:opacity-40">
                {lang === 'mm' ? 'Report တင်မည်' : 'Submit report'}
              </button>
              <button onClick={() => { setReporting(false); setReportReason('') }} className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Gallery images with lightbox (if more than one) */}
        {post.images && post.images.length > 1 && (
          <div className="grid grid-cols-3 gap-2">
            {post.images.slice(1).map((img, idx) => (
              <div key={idx} className="aspect-square rounded-lg overflow-hidden cursor-pointer" onClick={() => openLightbox(idx + 1)}>
                <img src={getOptimizedUrl(img, { width: 200 })} alt={post.title_mm || post.title || 'ပုံ'} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxImages}
        index={lightboxIndex}
        plugins={[Zoom, Thumbnails]}
        zoom={{ maxZoomPixelRatio: 3 }}
      />
    </div>
  )
}