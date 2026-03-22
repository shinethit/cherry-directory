import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, CalendarDays, MapPin, Trash2 } from 'lucide-react'
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
  event_start: '', event_end: '', event_location: '',
  cover_url: '', status: 'published', is_pinned: false,
  category_id: '',
}

export default function EventFormPage() {
  const { id } = useParams()        // undefined = create, uuid = edit
  const navigate = useNavigate()
  const { profile, isAdmin, isModerator, user } = useAuth()
  const { lang } = useLang()
  const { log } = useAuditLog()
  useSEO({ title: id ? 'Edit Event' : 'Create Event' })

  const isEdit = !!id
  const [original, setOriginal] = useState(null)
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(BLANK)
  const [coverUploading, setCoverUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    supabase.from('categories').select('*').eq('type', 'event').then(({ data }) => setCategories(data || []))

    if (isEdit) {
      supabase.from('posts').select('*').eq('id', id).single().then(({ data }) => {
        if (!data) { navigate('/calendar'); return }
        // Permission: admin, mod, or author
        const allowed = isAdmin || isModerator || data.author_id === user?.id
        setCanEdit(allowed)
        if (!allowed) { navigate('/calendar'); return }
        setOriginal(data)
        setForm({
          title:          data.title || '',
          title_mm:       data.title_mm || '',
          content:        data.content || '',
          content_mm:     data.content_mm || '',
          event_start:    data.event_start ? data.event_start.slice(0, 16) : '',
          event_end:      data.event_end   ? data.event_end.slice(0, 16)   : '',
          event_location: data.event_location || '',
          cover_url:      data.cover_url || '',
          status:         data.status || 'published',
          is_pinned:      data.is_pinned || false,
          category_id:    data.category_id || '',
        })
      })
    } else {
      setCanEdit(isAdmin || isModerator)
    }
  }, [id, user])

  function set(key, value) { setForm(f => ({ ...f, [key]: value })) }

  async function handleCoverUpload(file) {
    setCoverUploading(true)
    const url = await uploadImage(file, 'events/covers')
    set('cover_url', url)
    setCoverUploading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.title || !form.event_start) return
    setSaving(true)

    const payload = {
      ...form,
      type: 'event',
      event_start: form.event_start ? new Date(form.event_start).toISOString() : null,
      event_end:   form.event_end   ? new Date(form.event_end).toISOString()   : null,
      author_id:   user?.id,
      updated_at:  new Date().toISOString(),
    }

    if (isEdit) {
      await supabase.from('posts').update(payload).eq('id', id)
      await log({ action: 'update', table: 'posts', id, name: form.title, before: original, after: payload })
    } else {
      const { data } = await supabase.from('posts').insert({ ...payload, created_at: new Date().toISOString() }).select().single()
      await log({ action: 'create', table: 'posts', id: data?.id, name: form.title, after: payload })
    }

    setSaved(true)
    setSaving(false)
    setTimeout(() => navigate('/calendar'), 1000)
  }

  async function handleDelete() {
    if (!confirm(`"${form.title}" ကို ဖျက်မည်လား?`)) return
    await supabase.from('posts').delete().eq('id', id)
    await log({ action: 'delete', table: 'posts', id, name: form.title, before: original })
    navigate('/calendar')
  }

  if (isEdit && !canEdit) return null  // redirect handled in useEffect

  return (
    <div className="pb-10">
      {/* Sticky header */}
      <div className="flex items-center justify-between px-4 py-3 glass sticky top-[97px] z-40 border-b border-white/8">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="font-display font-bold text-sm text-white">
              {isEdit ? 'Event ပြင်မည်' : 'Event ထည့်မည်'}
            </h1>
            <p className="text-[10px] text-white/40">Admin / Moderator only</p>
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
            disabled={saving || !form.title || !form.event_start}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-display font-semibold transition-all ${
              saved
                ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                : 'btn-primary disabled:opacity-50'
            }`}
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : saved ? '✓ Saved'
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
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)} className="input-dark" placeholder="Event title" required />
        </Field>

        <Field label="ခေါင်းစဉ် (မြန်မာ)">
          <input type="text" value={form.title_mm} onChange={e => set('title_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဖြစ်ရပ် ခေါင်းစဉ်..." />
        </Field>

        {/* Date & Time */}
        <div className="border-t border-white/8 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={14} className="text-brand-300" />
            <p className="text-xs text-white/40 font-display font-semibold uppercase tracking-wider">ရက်စွဲနှင့် အချိန်</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date & time" required>
              <input
                type="datetime-local"
                value={form.event_start}
                onChange={e => set('event_start', e.target.value)}
                className="input-dark text-sm"
                required
              />
            </Field>
            <Field label="End date & time">
              <input
                type="datetime-local"
                value={form.event_end}
                onChange={e => set('event_end', e.target.value)}
                min={form.event_start}
                className="input-dark text-sm"
              />
            </Field>
          </div>
        </div>

        {/* Location */}
        <Field label="တည်နေရာ">
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={form.event_location}
              onChange={e => set('event_location', e.target.value)}
              className="input-dark pl-9 font-myanmar"
              placeholder="ဖြစ်ရပ် ကျင်းပမည့် နေရာ..."
            />
          </div>
        </Field>

        {/* Content */}
        <Field label="အကြောင်းအရာ (မြန်မာ)">
          <textarea
            value={form.content_mm}
            onChange={e => set('content_mm', e.target.value)}
            className="input-dark font-myanmar resize-none h-28"
            placeholder="Event အကြောင်း ဖော်ပြချက်..."
          />
        </Field>

        <Field label="Content (English)">
          <textarea
            value={form.content}
            onChange={e => set('content', e.target.value)}
            className="input-dark resize-none h-24"
            placeholder="Event description..."
          />
        </Field>

        {/* Settings */}
        <div className="border-t border-white/8 pt-4 space-y-3">
          <p className="text-xs text-white/40 font-display font-semibold uppercase tracking-wider">Settings</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select value={form.status} onChange={e => set('status', e.target.value)} className="input-dark">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Pinned">
              <select value={form.is_pinned ? 'yes' : 'no'} onChange={e => set('is_pinned', e.target.value === 'yes')} className="input-dark">
                <option value="no">No</option>
                <option value="yes">📌 Yes</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Permission note */}
        <div className="bg-amber-500/8 border border-amber-500/15 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-amber-400/70 font-myanmar">
            ⚠️ Event ထည့်ခြင်း/ပြင်ဆင်ခြင်းကို Admin နှင့် Moderator တို့သာ ပြုလုပ်နိုင်သည်
          </p>
        </div>
      </form>
    </div>
  )
}
