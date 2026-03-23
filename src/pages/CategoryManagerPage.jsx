import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, X, Save, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { useSEO } from '../hooks/useSEO'

// ── Common emoji icons for quick pick ────────────────────────
const ICONS = [
  '🍜','🍕','🍔','☕','🥗','🏥','💊','🦷','👁️','🎓','📚','🏫',
  '🏨','🏠','🏢','🏗️','🚗','🚕','🚌','📦','🛍️','💄','💅','✂️',
  '🔧','💡','🪣','🧹','👕','🏦','💰','💳','🎭','🎬','🎮','🎵',
  '📱','💻','🖨️','🔌','🌿','🌸','🐾','🚑','👮','🔴','📢','📋',
]

const BLANK = { name: '', name_mm: '', icon: '📦', type: 'directory', sort_order: 0, parent_id: null, description_mm: '', is_active: true, is_featured: false }

// ── Form modal ────────────────────────────────────────────────
function CategoryForm({ initial, parentId, parentName, allCategories, onClose, onSaved, lang }) {
  const [form, setForm]       = useState({ ...BLANK, ...initial, parent_id: parentId || initial?.parent_id || null })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [showIcons, setShowIcons] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isEdit = !!initial?.id

  // Available parents — top-level only (no sub-sub)
  const parents = allCategories.filter(c => !c.parent_id && c.id !== initial?.id && c.type === 'directory')

  async function save() {
    if (!form.name_mm && !form.name) { setError('အမည် ထည့်ပါ'); return }
    setSaving(true)
    const payload = {
      name:           form.name || form.name_mm,
      name_mm:        form.name_mm || form.name,
      icon:           form.icon || '📦',
      type:           form.type,
      sort_order:     parseInt(form.sort_order) || 0,
      parent_id:      form.parent_id || null,
      description_mm: form.description_mm || null,
      is_active:      form.is_active,
      is_featured:    form.is_featured || false,
      updated_at:     new Date().toISOString(),
    }
    const { error: err } = isEdit
      ? await supabase.from('categories').update(payload).eq('id', initial.id)
      : await supabase.from('categories').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#140020]">
      <div className="flex-1 flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8">
          <div>
            <p className="font-display font-bold text-white">
              {isEdit ? (lang === 'mm' ? '✏️ ပြင်ဆင်မည်' : '✏️ Edit Category')
                      : (lang === 'mm' ? '➕ Category ထည့်မည်' : '➕ Add Category')}
            </p>
            {(parentId || form.parent_id) && (
              <p className="text-[10px] text-brand-300 mt-0.5">
                Sub-category of: {parentName || allCategories.find(c => c.id === form.parent_id)?.name_mm || '—'}
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center">
            <X size={16} className="text-white/60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-24">
          {/* Icon picker */}
          <div>
            <label className="block text-xs text-white/50 mb-2">Icon</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowIcons(s => !s)}
                className="w-14 h-14 rounded-2xl bg-white/8 border border-white/12 text-3xl flex items-center justify-center hover:bg-white/12 transition-colors"
              >
                {form.icon}
              </button>
              <div>
                <p className="text-sm text-white/70">{form.icon}</p>
                <button onClick={() => setShowIcons(s => !s)} className="text-[10px] text-brand-300 hover:text-brand-200">
                  {showIcons ? 'Close' : 'Pick icon →'}
                </button>
              </div>
            </div>
            {showIcons && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => { set('icon', ic); setShowIcons(false) }}
                    className={`w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-colors ${form.icon === ic ? 'bg-brand-600/60 border border-brand-400/40' : 'bg-white/5 hover:bg-white/10'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Names */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">
              {lang === 'mm' ? 'Category အမည် (မြန်မာ)' : 'Name (Myanmar)'} *
            </label>
            <input autoFocus value={form.name_mm} onChange={e => set('name_mm', e.target.value)}
              className="input-dark font-myanmar" placeholder="ဥပမာ: စားသောက်ဆိုင်" />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Name (English)</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              className="input-dark" placeholder="e.g. Restaurant & Food" />
          </div>

          {/* Parent category (only for new, non-top-level) */}
          {!parentId && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5">
                {lang === 'mm' ? 'အဓိက Category (Sub-category ဆိုရင်)' : 'Parent Category (if sub-category)'}
              </label>
              <select value={form.parent_id || ''} onChange={e => set('parent_id', e.target.value || null)}
                className="input-dark">
                <option value="">{lang === 'mm' ? '— Top-level category —' : '— Top-level category —'}</option>
                {parents.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name_mm || c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Type — only for top-level */}
          {!form.parent_id && !parentId && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5">Type</label>
              <div className="flex gap-2">
                {[
                  { v: 'directory', mm: '📍 Directory',  en: '📍 Directory'  },
                  { v: 'news',      mm: '📰 News',       en: '📰 News'       },
                  { v: 'event',     mm: '📅 Event',      en: '📅 Event'      },
                ].map(t => (
                  <button key={t.v} onClick={() => set('type', t.v)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${form.type === t.v ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>
                    {lang === 'mm' ? t.mm : t.en}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'ဖော်ပြချက် (optional)' : 'Description (optional)'}</label>
            <input value={form.description_mm} onChange={e => set('description_mm', e.target.value)}
              className="input-dark font-myanmar text-sm" placeholder={lang === 'mm' ? 'အကျဉ်းဖော်ပြချက်...' : 'Short description...'} />
          </div>

          {/* Sort order + active */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-white/50 mb-1.5">Sort Order</label>
              <input type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)}
                className="input-dark" min="0" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-white/50 mb-1.5">Status</label>
              <div className="flex gap-2">
                <button onClick={() => set('is_active', !form.is_active)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${form.is_active ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
                  {form.is_active ? (lang === 'mm' ? '✓ Active' : '✓ Active') : (lang === 'mm' ? '○ Hidden' : '○ Hidden')}
                </button>
                {!form.parent_id && !parentId && (
                  <button onClick={() => set('is_featured', !form.is_featured)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${form.is_featured ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
                    {form.is_featured ? '⭐ Home မှာပြ' : '☆ Home မပြ'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}

          <button onClick={save} disabled={saving || (!form.name_mm && !form.name)}
            className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
            <Save size={15} />
            {saving ? '...' : isEdit ? (lang === 'mm' ? 'သိမ်းမည်' : 'Save') : (lang === 'mm' ? 'ထည့်မည်' : 'Add')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Category Row ──────────────────────────────────────────────
function CategoryRow({ cat, subcats, allCats, lang, onEdit, onDelete, onAddSub, onToggle }) {
  const [open, setOpen] = useState(false)
  const subsOfSub = (id) => (allCats || []).filter(c => c.parent_id === id)

  return (
    <div className={`rounded-2xl overflow-hidden border transition-all ${cat.is_active ? 'border-white/10 bg-white/3' : 'border-white/5 bg-white/1 opacity-60'}`}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xl flex-shrink-0">{cat.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-display font-semibold ${cat.is_active ? 'text-white' : 'text-white/50'}`}>
            {lang === 'mm' ? (cat.name_mm || cat.name) : cat.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] text-white/30 bg-white/6 px-1.5 py-0.5 rounded-full">{cat.type}</span>
            {subcats.length > 0 && (
              <span className="text-[9px] text-brand-300">{subcats.length} sub</span>
            )}
            {!cat.is_active && <span className="text-[9px] text-white/30">hidden</span>}
            {cat.is_featured && <span className="text-[9px] text-amber-400">⭐ home</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {subcats.length > 0 && (
            <button onClick={() => setOpen(o => !o)}
              className="w-7 h-7 rounded-lg bg-white/6 flex items-center justify-center hover:bg-white/10 transition-colors">
              {open ? <ChevronDown size={13} className="text-white/50" /> : <ChevronRight size={13} className="text-white/50" />}
            </button>
          )}
          <button onClick={() => onAddSub(cat)}
            className="w-7 h-7 rounded-lg bg-brand-600/20 flex items-center justify-center hover:bg-brand-600/35 transition-colors"
            title="Add sub-category">
            <Plus size={12} className="text-brand-300" />
          </button>
          <button onClick={() => onToggle(cat)}
            className="w-7 h-7 rounded-lg bg-white/6 flex items-center justify-center hover:bg-white/10 transition-colors"
            title={cat.is_active ? 'Hide' : 'Show'}>
            {cat.is_active ? <Eye size={12} className="text-white/50" /> : <EyeOff size={12} className="text-white/30" />}
          </button>
          <button onClick={() => onEdit(cat)}
            className="w-7 h-7 rounded-lg bg-white/6 flex items-center justify-center hover:bg-white/10 transition-colors">
            <Pencil size={11} className="text-white/50" />
          </button>
          <button onClick={() => onDelete(cat)}
            className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-colors">
            <Trash2 size={11} className="text-red-400" />
          </button>
        </div>
      </div>

      {/* Subcategories */}
      {open && subcats.length > 0 && (
        <div className="border-t border-white/6 bg-white/2">
          {subcats.map(sub => (
            <div key={sub.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/4 last:border-0 ${!sub.is_active ? 'opacity-50' : ''}`}>
              <span className="w-3 text-white/20 text-xs">↳</span>
              <span className="text-base">{sub.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-display font-semibold text-white/80">
                  {lang === 'mm' ? (sub.name_mm || sub.name) : sub.name}
                </p>
                <div className="flex items-center gap-1">
                  {!sub.is_active && <span className="text-[9px] text-white/25">hidden</span>}
                  {subsOfSub(sub.id).length > 0 && <span className="text-[9px] text-brand-300/70">{subsOfSub(sub.id).length} sub</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onAddSub(sub)}
                  className="w-6 h-6 rounded-lg bg-brand-600/15 flex items-center justify-center hover:bg-brand-600/30 transition-colors"
                  title="Add sub-sub-category">
                  <Plus size={10} className="text-brand-300" />
                </button>
                <button onClick={() => onToggle(sub)}
                  className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                  {sub.is_active ? <Eye size={10} className="text-white/40" /> : <EyeOff size={10} className="text-white/25" />}
                </button>
                <button onClick={() => onEdit(sub)}
                  className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <Pencil size={9} className="text-white/40" />
                </button>
                <button onClick={() => onDelete(sub)}
                  className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-colors">
                  <Trash2 size={9} className="text-red-400/70" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function CategoryManagerPage() {
  const { lang }      = useLang()
  const { isModerator, isLoggedIn } = useAuth()
  useSEO({ title: 'Category Manager' })

  const [cats, setCats]   = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setType] = useState('directory')
  const [formData, setFormData] = useState(null)   // null=closed, {initial,parentId,parentName}
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .order('name_mm')
    setCats(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Split top-level and subs — fixed to avoid duplicates
  const topLevel = cats.filter(c => !c.parent_id && c.type === typeFilter)
  const searchedTop = search
    ? topLevel.filter(c => (c.name_mm || '').includes(search) || (c.name || '').toLowerCase().includes(search.toLowerCase()))
    : topLevel

  function subsOf(id) { return cats.filter(c => c.parent_id === id) }

  async function handleDelete(cat) {
    const subs = subsOf(cat.id)
    const msg = subs.length > 0
      ? (lang === 'mm' ? `"${cat.name_mm || cat.name}" ကို ဖျက်ရင် Sub-category ${subs.length} ခုလည်း ဖျက်မည်။ ဆက်မည်လား?` : `Deleting "${cat.name}" will also delete ${subs.length} sub-categories. Continue?`)
      : (lang === 'mm' ? `"${cat.name_mm || cat.name}" ကို ဖျက်မည်လား?` : `Delete "${cat.name}"?`)
    if (!confirm(msg)) return
    await supabase.from('categories').delete().eq('id', cat.id)
    load()
  }

  async function handleToggle(cat) {
    await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    load()
  }

  const totalActive  = cats.filter(c => c.is_active && c.type === typeFilter).length
  const totalHidden  = cats.filter(c => !c.is_active && c.type === typeFilter).length

  return (
    <div className="pb-12">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              📂 {lang === 'mm' ? 'Category စီမံမည်' : 'Category Manager'}
            </h1>
            <p className="text-xs text-white/40 mt-0.5 font-myanmar">
              {lang === 'mm' ? 'Admin/Mod — Category နှင့် Sub-category စီမံ' : 'Manage categories & sub-categories'}
            </p>
          </div>
          <button
            onClick={() => setFormData({ initial: null, parentId: null, parentName: null })}
            className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"
          >
            <Plus size={14} /> {lang === 'mm' ? 'ထည့်မည်' : 'Add'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-2 px-4 mb-4">
        <div className="flex-1 card-dark rounded-2xl p-3 text-center">
          <p className="font-display font-bold text-lg text-white">{totalActive}</p>
          <p className="text-[9px] text-white/40">{lang === 'mm' ? 'Active' : 'Active'}</p>
        </div>
        <div className="flex-1 card-dark rounded-2xl p-3 text-center">
          <p className="font-display font-bold text-lg text-white/50">{totalHidden}</p>
          <p className="text-[9px] text-white/30">{lang === 'mm' ? 'Hidden' : 'Hidden'}</p>
        </div>
        <div className="flex-1 card-dark rounded-2xl p-3 text-center">
          <p className="font-display font-bold text-lg text-brand-300">{cats.filter(c => c.parent_id && c.type === typeFilter).length}</p>
          <p className="text-[9px] text-white/40">Sub-cats</p>
        </div>
      </div>

      {/* Type filter */}
      <div className="px-4 mb-3">
        <div className="relative">
          <select value={typeFilter} onChange={e => setType(e.target.value)}
            className="select-dark font-semibold">
            {[
              { v: 'directory', mm: '📍 Directory' },
              { v: 'news',      mm: '📰 News'      },
              { v: 'event',     mm: '📅 Event'     },
            ].map(t => (
              <option key={t.v} value={t.v} style={{ backgroundColor: '#1a0030' }}>{t.mm}</option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === 'mm' ? 'Category ရှာရန်...' : 'Search categories...'}
          className="input-dark text-sm font-myanmar w-full"
        />
      </div>

      {/* Category tree */}
      <div className="px-4 space-y-2">
        {loading ? (
          [1,2,3,4,5].map(n => <div key={n} className="h-14 rounded-2xl shimmer" />)
        ) : searchedTop.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="text-4xl mb-3">📂</span>
            <p className="text-white/40 font-display font-semibold">
              {search ? (lang === 'mm' ? 'မတွေ့ပါ' : 'Not found') : (lang === 'mm' ? 'Category မရှိသေး' : 'No categories yet')}
            </p>
            <button onClick={() => setFormData({ initial: null, parentId: null, parentName: null })}
              className="btn-primary text-xs px-4 py-2 mt-3">
              <Plus size={12} className="inline mr-1" />
              {lang === 'mm' ? 'ပထမဆုံး Category ထည့်မည်' : 'Add First Category'}
            </button>
          </div>
        ) : (
          searchedTop.map(cat => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              subcats={subsOf(cat.id)}
              allCats={cats}
              lang={lang}
              onEdit={c => setFormData({ initial: c, parentId: c.parent_id, parentName: cats.find(p => p.id === c.parent_id)?.name_mm })}
              onDelete={handleDelete}
              onAddSub={c => setFormData({ initial: null, parentId: c.id, parentName: c.name_mm || c.name })}
              onToggle={handleToggle}
            />
          ))
        )}
      </div>

      {/* Tip */}
      <div className="mx-4 mt-6 card-dark rounded-2xl p-4">
        <p className="text-[10px] text-white/30 font-myanmar leading-relaxed">
          💡 {lang === 'mm'
            ? '+ ကို နှိပ်ရင် Sub-category ထည့်နိုင် • Eye icon နှိပ်ရင် ဖျောက်/ပြနိုင် • Sort Order နည်းလေ အပေါ်ရောက်လေ'
            : 'Tap + to add sub-categories • Eye = show/hide • Lower sort order = higher position'}
        </p>
      </div>

      {/* Form modal */}
      {formData !== null && (
        <CategoryForm
          initial={formData.initial}
          parentId={formData.parentId}
          parentName={formData.parentName}
          allCategories={cats}
          lang={lang}
          onClose={() => setFormData(null)}
          onSaved={() => { setFormData(null); load() }}
        />
      )}
    </div>
  )
}
