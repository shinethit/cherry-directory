import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Edit2, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSEO } from '../hooks/useSEO'
import { useAuditLog } from '../hooks/useAuditLog'
import { uploadImage } from '../lib/cloudinary'
import { ImageUploader } from '../components/UI'

function PriceDisplay({ price, priceMax }) {
  if (!price) return <span className="text-white/30 text-xs">—</span>
  const fmt = n => Number(n).toLocaleString() + ' Ks'
  return (
    <span className="text-gold-400 text-sm font-bold font-display">
      {priceMax ? `${fmt(price)} – ${fmt(priceMax)}` : fmt(price)}
    </span>
  )
}

function MenuItem({ item, canEdit, onEdit, onDelete }) {
  return (
    <div className={`flex gap-3 p-3 rounded-xl transition-colors ${item.is_available ? '' : 'opacity-50'}`}>
      {item.image_url && (
        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 border border-white/8">
          <img src={item.image_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-display font-semibold text-white">{item.name}</p>
            {item.name_mm && <p className="text-[10px] text-white/50 font-myanmar">{item.name_mm}</p>}
            {item.unit && <p className="text-[9px] text-white/40 mt-0.5">({item.unit})</p>}
            {item.description && <p className="text-xs text-white/40 mt-0.5 font-myanmar line-clamp-2">{item.description}</p>}
            <div className="mt-1.5">
              <PriceDisplay price={item.price} priceMax={item.price_max} />
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => onEdit(item)} className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors">
                <Edit2 size={12} className="text-white/50" />
              </button>
              <button onClick={() => onDelete(item.id)} className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center hover:bg-red-500/25 transition-colors">
                <Trash2 size={12} className="text-red-400" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {item.is_featured && <span className="text-[9px] text-gold-400 bg-gold-500/15 px-1.5 py-0.5 rounded-full border border-gold-500/20">⭐ Popular</span>}
          {!item.is_available && <span className="text-[9px] text-red-400/70 bg-red-500/10 px-1.5 py-0.5 rounded-full">Unavailable</span>}
        </div>
      </div>
    </div>
  )
}

function ItemForm({ listingId, categoryId, item, categories, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: item?.name || '',
    name_mm: item?.name_mm || '',
    description: item?.description || '',
    price: item?.price || '',
    price_max: item?.price_max || '',
    unit: item?.unit || '',
    image_url: item?.image_url || '',
    category_id: item?.category_id || categoryId || '',
    is_available: item?.is_available ?? true,
    is_featured: item?.is_featured ?? false,
  })
  const [imgLoading, setImgLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleImg(file) {
    setImgLoading(true)
    const url = await uploadImage(file, 'listings/menu')
    set('image_url', url)
    setImgLoading(false)
  }

  return (
    <div className="card-dark rounded-2xl p-4 space-y-3 border border-brand-400/20">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Name (EN) *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} className="input-dark text-sm py-2" placeholder="Item name" required />
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Name (မြ)</label>
          <input value={form.name_mm} onChange={e => set('name_mm', e.target.value)} className="input-dark text-sm py-2 font-myanmar" placeholder="အမည်..." />
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-white/40 mb-1">Description</label>
        <input value={form.description} onChange={e => set('description', e.target.value)} className="input-dark text-sm py-2 font-myanmar" placeholder="ဖော်ပြချက်..." />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Price (Ks)</label>
          <input type="number" value={form.price} onChange={e => set('price', e.target.value)} className="input-dark text-sm py-2" placeholder="1000" />
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Max Price (range)</label>
          <input type="number" value={form.price_max} onChange={e => set('price_max', e.target.value)} className="input-dark text-sm py-2" placeholder="5000" />
        </div>
        <div>
          <label className="block text-[10px] text-white/40 mb-1">Unit (e.g., ပိဿာ, ကျပ်သား)</label>
          <input value={form.unit} onChange={e => set('unit', e.target.value)} className="input-dark text-sm py-2" placeholder="Unit" />
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-white/40 mb-1">Category</label>
        <select value={form.category_id} onChange={e => set('category_id', e.target.value)} className="select-dark text-sm">
          <option value="">— No category —</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name_mm || c.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-[10px] text-white/40 mb-1">ပုံ</label>
        {form.image_url ? (
          <div className="relative w-24 h-24">
            <img src={form.image_url} alt="" className="w-full h-full object-cover rounded-xl border border-white/10" />
            <button type="button" onClick={() => set('image_url', '')} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px]">✕</button>
          </div>
        ) : (
          <ImageUploader onUpload={handleImg} loading={imgLoading} label="Item ပုံတင်မည်" />
        )}
      </div>

      <div className="flex gap-3">
        {[
          { key: 'is_available', label: 'Available' },
          { key: 'is_featured', label: '⭐ Popular' },
        ].map(({ key, label }) => (
          <button key={key} type="button" onClick={() => set(key, !form[key])} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${form[key] ? 'bg-brand-600/40 border-brand-400/40 text-brand-200' : 'bg-white/5 border-white/10 text-white/40'}`}>
            {form[key] && <Check size={10} />} {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => onSave(form)} className="btn-primary flex-1 text-sm py-2">Save</button>
        <button type="button" onClick={onCancel} className="btn-ghost flex-1 text-sm py-2">Cancel</button>
      </div>
    </div>
  )
}

export default function MenuPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, isAdmin, isModerator } = useAuth()
  const { log } = useAuditLog()
  useSEO({ title: 'Menu Management' })

  const [listing, setListing] = useState(null)
  const [menuCategories, setMenuCategories] = useState([])
  const [items, setItems] = useState([])
  const [editItem, setEditItem] = useState(null)
  const [newCatName, setNewCatName] = useState('')
  const [newCatMm, setNewCatMm] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [collapsed, setCollapsed] = useState({})
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const { data: l } = await supabase.from('listings').select('id, name, name_mm, owner_id, submitted_by').eq('id', id).single()
        if (!l) { navigate('/directory'); return }
        setListing(l)
        setCanEdit(isAdmin || isModerator || l.owner_id === profile?.id || l.submitted_by === profile?.id)
        loadMenu()
      } catch (e) { console.warn(e) }
    }
    load()
  }, [id, profile])

  async function loadMenu() {
    const [{ data: cats }, { data: its }] = await Promise.all([
      supabase.from('menu_categories').select('*').eq('listing_id', id).order('sort_order'),
      supabase.from('menu_items').select('*').eq('listing_id', id).order('sort_order'),
    ])
    setMenuCategories(cats || [])
    setItems(its || [])
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    const { data } = await supabase.from('menu_categories').insert({ listing_id: id, name: newCatName.trim(), name_mm: newCatMm.trim() || null, sort_order: menuCategories.length }).select().single()
    setMenuCategories(prev => [...prev, data])
    setNewCatName(''); setNewCatMm(''); setAddingCat(false)
  }

  async function deleteCategory(catId) {
    if (!confirm('Category ဖျက်မည်။ ထိုCategory ထဲရှိ items များ Uncategorized ဖြစ်သွားမည်?')) return
    await supabase.from('menu_categories').delete().eq('id', catId)
    setMenuCategories(prev => prev.filter(c => c.id !== catId))
  }

  async function saveItem(form) {
    const payload = {
      ...form,
      listing_id: id,
      price: form.price ? parseFloat(form.price) : null,
      price_max: form.price_max ? parseFloat(form.price_max) : null,
      category_id: form.category_id || null,
      unit: form.unit || null,
    }

    if (editItem && editItem !== 'new') {
      const { data } = await supabase.from('menu_items').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editItem.id).select().single()
      setItems(prev => prev.map(i => i.id === data.id ? data : i))
      await log({ action: 'update', table: 'menu_items', id: editItem.id, name: form.name, before: editItem, after: data })
    } else {
      const { data } = await supabase.from('menu_items').insert({ ...payload, sort_order: items.length }).select().single()
      setItems(prev => [...prev, data])
      await log({ action: 'create', table: 'menu_items', id: data.id, name: form.name, after: data })
    }
    setEditItem(null)
  }

  async function deleteItem(itemId) {
    if (!confirm('Item ဖျက်မည်လား?')) return
    const item = items.find(i => i.id === itemId)
    await supabase.from('menu_items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
    await log({ action: 'delete', table: 'menu_items', id: itemId, name: item?.name, before: item })
  }

  const uncategorized = items.filter(i => !i.category_id)

  return (
    <div className="pb-10">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="font-display font-bold text-base text-white">Menu & Prices</h1>
            <p className="text-[10px] text-white/40 truncate max-w-[180px]">{listing?.name_mm || listing?.name}</p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditItem('new')}
            className="flex items-center gap-1.5 btn-primary text-xs px-3 py-2"
          >
            <Plus size={14} /> Item ထည့်မည်
          </button>
        )}
      </div>

      <div className="px-4 space-y-4">
        {/* New item form */}
        {editItem === 'new' && (
          <ItemForm
            listingId={id}
            categories={menuCategories}
            onSave={saveItem}
            onCancel={() => setEditItem(null)}
          />
        )}

        {/* Uncategorized items */}
        {uncategorized.length > 0 && (
          <div className="card-dark rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8">
              <p className="text-xs font-display font-bold text-white/50 uppercase tracking-wider">General</p>
            </div>
            <div className="divide-y divide-white/5">
              {uncategorized.map(item => (
                <div key={item.id}>
                  {editItem?.id === item.id ? (
                    <div className="p-3">
                      <ItemForm listingId={id} categoryId={null} item={item} categories={menuCategories} onSave={saveItem} onCancel={() => setEditItem(null)} />
                    </div>
                  ) : (
                    <MenuItem item={item} canEdit={canEdit} onEdit={setEditItem} onDelete={deleteItem} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category groups */}
        {menuCategories.map(cat => {
          const catItems = items.filter(i => i.category_id === cat.id)
          const isCollapsed = collapsed[cat.id]
          return (
            <div key={cat.id} className="card-dark rounded-2xl overflow-hidden border border-white/6">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <button onClick={() => setCollapsed(c => ({ ...c, [cat.id]: !c[cat.id] }))} className="flex items-center gap-2 flex-1 text-left">
                  <p className="text-sm font-display font-bold text-white">{cat.name_mm || cat.name}</p>
                  <span className="text-[10px] text-white/30 bg-white/8 px-1.5 py-0.5 rounded-full">{catItems.length}</span>
                  {isCollapsed ? <ChevronDown size={14} className="ml-auto text-white/30" /> : <ChevronUp size={14} className="ml-auto text-white/30" />}
                </button>
                {canEdit && (
                  <div className="flex gap-1 ml-2">
                    <button onClick={() => setEditItem({ category_id: cat.id, _new: true })} className="w-6 h-6 rounded-lg bg-white/8 flex items-center justify-center text-white/40 hover:text-white/70">
                      <Plus size={11} />
                    </button>
                    <button onClick={() => deleteCategory(cat.id)} className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400/60 hover:text-red-400">
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <>
                  {editItem?._new && editItem?.category_id === cat.id && (
                    <div className="p-3">
                      <ItemForm listingId={id} categoryId={cat.id} categories={menuCategories} onSave={saveItem} onCancel={() => setEditItem(null)} />
                    </div>
                  )}
                  {catItems.length === 0 && !editItem?._new ? (
                    <p className="text-xs text-white/25 text-center py-4 font-myanmar">Item မရှိသေး</p>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {catItems.map(item => (
                        <div key={item.id}>
                          {editItem?.id === item.id ? (
                            <div className="p-3">
                              <ItemForm listingId={id} categoryId={cat.id} item={item} categories={menuCategories} onSave={saveItem} onCancel={() => setEditItem(null)} />
                            </div>
                          ) : (
                            <MenuItem item={item} canEdit={canEdit} onEdit={setEditItem} onDelete={deleteItem} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}

        {/* Add category */}
        {canEdit && (
          <div>
            {addingCat ? (
              <div className="card-dark rounded-2xl p-4 space-y-3 border border-white/10">
                <p className="text-xs font-display font-semibold text-white/60">Category အသစ် ထည့်မည်</p>
                <input value={newCatName} onChange={e => setNewCatName(e.target.value)} className="input-dark text-sm" placeholder="Category name (English)" />
                <input value={newCatMm} onChange={e => setNewCatMm(e.target.value)} className="input-dark text-sm font-myanmar" placeholder="Category name (မြန်မာ)" />
                <div className="flex gap-2">
                  <button onClick={addCategory} className="btn-primary flex-1 text-sm py-2">Add</button>
                  <button onClick={() => setAddingCat(false)} className="btn-ghost flex-1 text-sm py-2">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingCat(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-white/15 text-white/40 text-sm hover:border-brand-400/30 hover:text-brand-300 transition-colors">
                <Plus size={15} /> Category အသစ် ထည့်မည်
              </button>
            )}
          </div>
        )}

        {items.length === 0 && menuCategories.length === 0 && !editItem && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <span className="text-4xl mb-3">🍽️</span>
            <p className="text-white/50 font-display font-semibold">Menu မရှိသေး</p>
            {canEdit && <p className="text-xs text-white/30 mt-1 font-myanmar">"Item ထည့်မည်" ကို နှိပ်ပြီး စတင်ပါ</p>}
          </div>
        )}
      </div>
    </div>
  )
}