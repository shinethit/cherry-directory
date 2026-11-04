import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { goBackOrHome } from '../lib/navigation'
import { useAuditLog } from '../hooks/useAuditLog'
import { uploadImage } from '../lib/cloudinary'
import { ImageUploader, Skeleton } from '../components/UI'
import { confirmDialog } from '../lib/confirmDialog'
import { showError, showSuccess } from '../lib/toast'

function Field({ label, children, required, error }) {
  return (
    <div>
      <label className="block text-xs text-white/50 mb-1.5">
        {label} {required && <span className="text-brand-400">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1 font-myanmar">{error}</p>}
    </div>
  )
}

const BLANK = {
  title: '', title_mm: '', content: '', content_mm: '',
  excerpt: '', cover_url: '', status: 'published', is_pinned: false,
  category_id: '', type: 'news',
}

export default function NewsEditPage() {
  const { id } = useParams()          // undefined = create, uuid = edit
  const navigate = useNavigate()
  const { user, isAdmin, isModerator, isLoggedIn } = useAuth()
  const { lang } = useLang()
  const { log } = useAuditLog()
  useSEO({ title: id ? 'Edit News' : 'Create News' })

  const isEdit = !!id
  const [original, setOriginal] = useState(null)
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(BLANK)
  const [coverUploading, setCoverUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .eq('type', 'news')
      .then(({ data }) => setCategories(data || []))

    if (isEdit) {
      supabase.from('posts').select('*').eq('id', id).single().then(({ data }) => {
        if (!data) { navigate('/news'); return }
        const allowed = isAdmin || isModerator || data.author_id === user?.id
        setCanEdit(allowed)
        setChecked(true)
        if (!allowed) return
        setOriginal(data)
        setForm({
          title:       data.title || '',
          title_mm:    data.title_mm || '',
          content:     data.content || '',
          content_mm:  data.content_mm || '',
          excerpt:     data.excerpt || '',
          cover_url:   data.cover_url || '',
          status:      data.status || 'published',
          is_pinned:   data.is_pinned || false,
          category_id: data.category_id || '',
          type:        data.type || 'news',
        })
      })
    } else {
      // Create: admin/mod only
      if (!isLoggedIn) { showError('အကောင့်ဝင်မှ သတင်းထည့်နိုင်မည်'); navigate('/login'); return }
      const allowed = isAdmin || isModerator
      setCanEdit(allowed)
      setChecked(true)
    }
  }, [id, user, isAdmin, isModerator, navigate])

  async function set(key, value) { setForm(f => ({ ...f, [key]: value })) }

  async function handleCoverUpload(file) {
    setCoverUploading(true)
    try {
      const url = await uploadImage(file, 'news/covers')
      set('cover_url', url)
    } catch (err) {
      showError(err?.message || 'ပုံတင်ရာတွင် အမှားဖြစ်သွားသည်')
    } finally {
      setCoverUploading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title && !form.title_mm) return
    setSaving(true)

    const payload = {
      ...form,
      // Preserve the original type on edit: hardcoding 'news' here used
      // to silently convert an event opened at /news/edit/<event-id>
      // into news (it then vanished from the Calendar).
      type: isEdit ? (form.type || 'news') : 'news',
      author_id: isEdit ? original?.author_id || user?.id : user?.id,
      updated_at: new Date().toISOString(),
    }

    if (isEdit) {
      const { error } = await supabase.from('posts').update(payload).eq('id', id)
      if (error) { showError(error.message); setSaving(false); return }
      // Audit log is fire-and-forget — it must never delay the toast.
      log({ action: 'update', table: 'posts', id, name: form.title || form.title_mm, before: original, after: payload })
        .then(ok => { if (!ok) console.warn('Audit log failed for news update') })
    } else {
      const { data, error } = await supabase.from('posts').insert({
        ...payload,
        created_at: new Date().toISOString(),
      }).select().single()
      if (error) { showError(error.message); setSaving(false); return }
      log({ action: 'create', table: 'posts', id: data?.id, name: form.title || form.title_mm, after: payload })
        .then(ok => { if (!ok) console.warn('Audit log failed for news create') })
    }

    setSaved(true)
    setSaving(false)
    showSuccess('✓ သိမ်းပြီးပါပြီ')
    setTimeout(() => navigate('/news'), 1000)
  }

  async function handleDelete() {
    if (!(await confirmDialog((lang === 'mm' ? 'ဤသတင်းကို ဖျက်မည်လား?' : 'Delete this post?'), { danger: true }))) return
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) { showError(error.message); return }
    log({ action: 'delete', table: 'posts', id, name: form.title, before: original })
      .then(ok => { if (!ok) console.warn('Audit log failed for news delete') })
    navigate('/news')
  }

  if (!checked) return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-12" />
      <Skeleton className="h-40" />
      <Skeleton className="h-24" />
    </div>
  )

  if (!canEdit) return (
    <div className="p-4 py-16 text-center space-y-3">
      <p className="text-4xl">🔒</p>
      <p className="font-display font-semibold text-white/70">{lang === 'mm' ? 'ပြင်ခွင့် မရှိပါ' : 'No permission to edit'}</p>
      <p className="text-xs text-white/60 font-myanmar">{lang === 'mm' ? 'ဤသတင်းကို ပြင်ရန် Admin / Moderator (သို့မဟုတ်) ရေးသားသူ သာ ခွင့်ရှိသည်' : 'Only an admin, moderator or the author can edit this post'}</p>
      <button onClick={() => navigate('/news')} className="btn-primary text-sm px-5 py-2.5">{lang === 'mm' ? 'သတင်းစာမျက်နှာသို့ ပြန်မည်' : 'Back to News'}</button>
    </div>
  )

  return (
    <div className="pb-10">
      {/* Sticky header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#140020] sticky top-[var(--header-h)] z-40 border-b border-white/8">
        <div className="flex items-center gap-3">
          <button onClick={() => goBackOrHome(navigate, '/news')} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="font-display font-bold text-sm text-white">
              {isEdit
                ? (lang === 'mm' ? 'သတင်း ပြင်မည်' : 'Edit News')
                : (lang === 'mm' ? 'သတင်း ထည့်မည်' : 'Add News')}
            </h1>
            <p className="text-[10px] text-white/60 font-myanmar">Admin / Moderator only</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <button onClick={handleDelete} className="w-9 h-9 rounded-xl btn-danger flex items-center justify-center transition-colors">
              <Trash2 size={16} className="text-white" />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || (!form.title && !form.title_mm)}
            className={'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-display font-semibold transition-all ' + (
              saved
                ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                : 'btn-primary disabled:opacity-50'
            )}
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : saved
              ? '✓ Saved'
              : <><Save size={14} /> Save</>}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="px-4 space-y-4 pt-4">
        {/* Cover */}
        <div>
          <label className="block text-xs text-white/50 mb-2">Cover ပုံ</label>
          {form.cover_url ? (
            <div className="relative h-40">
              <img src={form.cover_url} alt="" className="w-full h-full object-cover rounded-2xl" />
              <button type="button" onClick={() => set('cover_url', '')} className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-lg flex items-center justify-center text-white text-xs hover:bg-red-500/70">✕</button>
            </div>
          ) : (
            <ImageUploader onUpload={handleCoverUpload} loading={coverUploading} label="Cover ပုံ တင်ရန်" />
          )}
        </div>

        <Field label="ခေါင်းစဉ် (English)" required>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)} className={'input-dark' + ((!form.title && !form.title_mm) ? ' border-red-500/60' : '')} placeholder="Title" />
        </Field>

        <Field label="ခေါင်းစဉ် (မြန်မာ)" required error={(!form.title && !form.title_mm) ? 'ခေါင်းစဉ် (မြန်မာ သို့မဟုတ် English) တစ်ခု ထည့်ပါ' : ''}>
          <input type="text" value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className={'input-dark font-myanmar' + ((!form.title && !form.title_mm) ? ' border-red-500/60' : '')} placeholder="သတင်း ခေါင်းစဉ်..." />
        </Field>

        <Field label="အကျဉ်းချုပ် (Excerpt)">
          <textarea
            value={form.excerpt}
            onChange={e => set('excerpt', e.target.value)}
            className="input-dark font-myanmar resize-none h-16"
            placeholder="အကျဉ်းချုပ်..."
            maxLength={300}
          />
        </Field>

        <Field label="အကြောင်းအရာ (မြန်မာ)">
          <textarea
            value={form.content_mm}
            onChange={e => set('content_mm', e.target.value)}
            className="input-dark font-myanmar resize-none h-40"
            placeholder="သတင်း အကြောင်းအရာ..."
          />
        </Field>

        <Field label="Content (English)">
          <textarea
            value={form.content}
            onChange={e => set('content', e.target.value)}
            className="input-dark resize-none h-32"
            placeholder="Content..."
          />
        </Field>

        {/* Category + Settings */}
        <div className="border-t border-white/8 pt-4 space-y-3">
          <p className="text-xs text-white/60 font-display font-semibold uppercase tracking-wider">Settings</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={form.category_id} onChange={e => set('category_id', e.target.value)} className="select-dark">
                <option value="">— ရွေးရန် —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name_mm || c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => set('status', e.target.value)} className="select-dark">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </div>
          <Field label="Pinned">
            <select value={form.is_pinned ? 'yes' : 'no'} onChange={e => set('is_pinned', e.target.value === 'yes')} className="select-dark">
              <option value="no">No</option>
              <option value="yes">📌 Yes</option>
            </select>
          </Field>
        </div>

        <div className="bg-amber-500/8 border border-amber-500/15 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-amber-400/70 font-myanmar">
            ⚠️ သတင်းထည့်ခြင်း/ပြင်ဆင်ခြင်းကို Admin နှင့် Moderator တို့သာ ပြုလုပ်နိုင်သည်
          </p>
        </div>
      </form>
    </div>
  )
}
