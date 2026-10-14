import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { useAuditLog } from '../hooks/useAuditLog'
import { uploadImage } from '../lib/cloudinary'
import { ImageUploader } from '../components/UI'

function Field({ label, children, required }) {
  return (
    <div>
      <label className="block text-xs text-white/50 mb-1.5">
        {label} {required && <span className="text-brand-400">*</span>}
      </label>
      {children}
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
  const { user, isAdmin, isModerator } = useAuth()
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
        if (!allowed) { navigate('/news'); return }
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
      const allowed = isAdmin || isModerator
      setCanEdit(allowed)
      if (!allowed) navigate('/news')
    }
  }, [id, user, isAdmin, isModerator, navigate])

  function set(key, value) { setForm(f => ({ ...f, [key]: value })) }

  async function handleCoverUpload(file) {
    setCoverUploading(true)
    const url = await uploadImage(file, 'news/covers')
    set('cover_url', url)
    setCoverUploading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title && !form.title_mm) return
    setSaving(true)

    const payload = {
      ...form,
      type: 'news',
      author_id: isEdit ? original?.author_id || user?.id : user?.id,
      updated_at: new Date().toISOString(),
    }

    if (isEdit) {
      await supabase.from('posts').update(payload).eq('id', id)
      await log({ action: 'update', table: 'posts', id, name: form.title || form.title_mm, before: original, after: payload })
    } else {
      const { data } = await supabase.from('posts').insert({
        ...payload,
        created_at: new Date().toISOString(),
      }).select().single()
      await log({ action: 'create', table: 'posts', id: data?.id, name: form.title || form.title_mm, after: payload })
    }

    setSaved(true)
    setSaving(false)
    setTimeout(() => navigate('/news'), 1000)
  }

  async function handleDelete() {
    if (!confirm((lang === 'mm' ? 'ဤသတင်းကို ဖျက်မည်လား?' : 'Delete this post?'))) return
    await supabase.from('posts').delete().eq('id', id)
    await log({ action: 'delete', table: 'posts', id, name: form.title, before: original })
    navigate('/news')
  }

  if (!canEdit) return null

  return (
    <div className="pb-10">
      {/* Sticky header */}
      <div className="flex items-center justify-between px-4 py-3 glass sticky top-[var(--header-h)] z-40 border-b border-white/8">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="font-display font-bold text-sm text-white">
              {isEdit
                ? (lang === 'mm' ? 'သတင်း ပြင်မည်' : 'Edit News')
                : (lang === 'mm' ? 'သတင်း ထည့်မည်' : 'Add News')}
            </h1>
            <p className="text-[10px] text-white/40 font-myanmar">Admin / Moderator only</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <button onClick={handleDelete} className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center hover:bg-red-500/25 transition-colors">
              <Trash2 size={16} className="text-red-400" />
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

        <Field label="ခေါင်းစဉ် (English)">
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)} className="input-dark" placeholder="Title" />
        </Field>

        <Field label="ခေါင်းစဉ် (မြန်မာ)">
          <input type="text" value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" placeholder="သတင်း ခေါင်းစဉ်..." />
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
          <p className="text-xs text-white/40 font-display font-semibold uppercase tracking-wider">Settings</p>
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
