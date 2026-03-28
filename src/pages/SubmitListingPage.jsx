import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, MapPin, Plus, X, Minus, Trash2, Edit2, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { uploadImage } from '../lib/cloudinary'
import { ImageUploader } from '../components/UI'
import { useAppConfig } from '../contexts/AppConfigContext'

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

export default function SubmitListingPage() {
  const navigate = useNavigate()
  const { profile, isLoggedIn } = useAuth()
  const { t, lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'လုပ်ငန်း / ဝန်ဆောင်မှု ထည့်မည်' : 'Submit Listing' })

  const config = useAppConfig()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({
    name: '', name_mm: '', description_mm: '', description: '',
    category_id: '', city: '', township: '', ward: '',
    address: '', address_mm: '',
    phones: ['', ''],  // dynamic phone numbers
    viber: '', telegram: '', whatsapp: '', facebook: '', website: '',
    latitude: '', longitude: '', business_type: 'shop',
  })
  const [logo, setLogo] = useState(null)
  const [coverImg, setCoverImg] = useState(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [showQuickCat, setShowQuickCat] = useState(false)
  const [quickCat, setQuickCat] = useState({ name_mm: '', name: '', icon: '📦', parent_id: '' })
  const [addingCat, setAddingCat] = useState(false)

  // Menu items state
  const [menuItems, setMenuItems] = useState([])
  const [editingMenuItem, setEditingMenuItem] = useState(null)
  const [menuFormOpen, setMenuFormOpen] = useState(false)
  const [menuForm, setMenuForm] = useState({
    name: '',
    price: '',
    description: '',
    images: [],
  })
  const [menuImageLoading, setMenuImageLoading] = useState(false)
  const [menuError, setMenuError] = useState('')

  useEffect(() => {
    supabase.from('categories').select('*').eq('type', 'directory').eq('is_active', true).order('sort_order').then(({ data }) => setCategories(data || []))
  }, [])

  function setFormField(key, value) { setForm(f => ({ ...f, [key]: value })) }

  function updatePhone(index, value) {
    const newPhones = [...form.phones]
    newPhones[index] = value
    setFormField('phones', newPhones)
  }

  function addPhone() {
    if (form.phones.length < 5) {
      setFormField('phones', [...form.phones, ''])
    }
  }

  function removePhone(index) {
    if (form.phones.length > 1) {
      const newPhones = form.phones.filter((_, i) => i !== index)
      setFormField('phones', newPhones)
    }
  }

  async function handleLogoUpload(file) {
    setLogoUploading(true)
    try {
      const url = await uploadImage(file, 'listings/logos')
      setLogo(url)
    } catch (err) { console.warn('Logo upload failed:', err) }
    setLogoUploading(false)
  }

  async function handleCoverUpload(file) {
    setCoverUploading(true)
    try {
      const url = await uploadImage(file, 'listings/covers')
      setCoverImg(url)
    } catch (err) { console.warn('Cover upload failed:', err) }
    setCoverUploading(false)
  }

  function getMyLocation() {
    if (!navigator.geolocation) return
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setFormField('latitude', pos.coords.latitude.toFixed(7))
        setFormField('longitude', pos.coords.longitude.toFixed(7))
        setLocationLoading(false)
      },
      () => setLocationLoading(false)
    )
  }

  async function handleQuickAddCat() {
    if (!quickCat.name_mm.trim()) return
    setAddingCat(true)
    try {
      const { data: newCat } = await supabase.from('categories').insert({
        name: quickCat.name || quickCat.name_mm.trim(),
        name_mm: quickCat.name_mm.trim(),
        icon: quickCat.icon || '📦',
        type: 'directory',
        parent_id: quickCat.parent_id || null,
        sort_order: 999,
        is_active: true,
      }).select().single()
      const { data: cats } = await supabase.from('categories').select('*').eq('type', 'directory').eq('is_active', true).order('sort_order')
      setCategories(cats || [])
      if (newCat) setFormField('category_id', newCat.id)
      setQuickCat({ name_mm: '', name: '', icon: '📦', parent_id: '' })
      setShowQuickCat(false)
    } catch (e) { console.warn(e) }
    setAddingCat(false)
  }

  // Menu functions
  const openMenuForm = (item = null) => {
    if (item) {
      setEditingMenuItem(item)
      setMenuForm({
        name: item.name,
        price: item.price,
        description: item.description,
        images: item.images || [],
      })
    } else {
      setEditingMenuItem(null)
      setMenuForm({ name: '', price: '', description: '', images: [] })
    }
    setMenuFormOpen(true)
    setMenuError('')
  }

  const closeMenuForm = () => {
    setMenuFormOpen(false)
    setEditingMenuItem(null)
    setMenuForm({ name: '', price: '', description: '', images: [] })
    setMenuError('')
  }

  const handleMenuImageUpload = async (file) => {
    if (menuForm.images.length >= 5) {
      setMenuError(lang === 'mm' ? 'အများဆုံး ၅ ပုံသာ တင်နိုင်ပါသည်' : 'Maximum 5 images allowed')
      return
    }
    setMenuImageLoading(true)
    const url = await uploadImage(file, 'menu')
    setMenuForm(prev => ({ ...prev, images: [...prev.images, url] }))
    setMenuImageLoading(false)
  }

  const removeMenuImage = (index) => {
    setMenuForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }))
  }

  const saveMenuItem = () => {
    if (!menuForm.name.trim()) {
      setMenuError(lang === 'mm' ? 'အမည် ထည့်ပါ' : 'Name required')
      return
    }
    const newItem = {
      id: editingMenuItem?.id || Date.now().toString(),
      name: menuForm.name.trim(),
      price: menuForm.price.trim(),
      description: menuForm.description.trim(),
      images: menuForm.images,
    }
    if (editingMenuItem) {
      setMenuItems(prev => prev.map(item => item.id === editingMenuItem.id ? newItem : item))
    } else {
      setMenuItems(prev => [...prev, newItem])
    }
    closeMenuForm()
  }

  const deleteMenuItem = (id) => {
    if (confirm(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete this item?')) {
      setMenuItems(prev => prev.filter(item => item.id !== id))
    }
  }

  // Submit form – immediate approval
  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.category_id) return
    setSubmitting(true)
    try {
      // Map phones to individual columns
      const phoneColumns = {}
      form.phones.forEach((phone, idx) => {
        if (phone) phoneColumns[`phone_${idx + 1}`] = phone
      })

      // Remove the 'phones' array from the data to be inserted
      const { phones, ...restData } = form

      // Determine submitted_by: if logged in, use profile.id; otherwise null
      const submittedBy = isLoggedIn && profile ? profile.id : null

      const { error } = await supabase.from('listings').insert({
        ...restData,
        ...phoneColumns,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        logo_url: logo,
        cover_url: coverImg,
        images: [],
        menu_items: menuItems.length > 0 ? menuItems : null,
        submitted_by: submittedBy,
        status: 'approved',          // ← Immediate approval
        report_count: 0,
      })
      if (error) throw error
      setDone(true)
    } catch (err) {
      console.error('Submit listing failed:', err)
      alert(`Error: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) return (
    <div className="min-h-[80dvh] flex items-center justify-center px-8 text-center">
      <div>
        <CheckCircle size={56} className="text-green-400 mx-auto mb-4" />
        <h2 className="font-display font-bold text-2xl text-white mb-2">{t('submit_success_title')}</h2>
        <p className="text-white/50 font-myanmar mb-6">{t('submit_success_desc')}</p>
        <button onClick={() => navigate('/directory')} className="btn-primary">{t('go_directory')}</button>
      </div>
    </div>
  )

  return (
    <div className="pb-8">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display font-bold text-lg text-white">{t('submit_title')}</h1>
      </div>

      {/* Info banner for anonymous users */}
      {!isLoggedIn && (
        <div className="mx-4 mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-2">
          <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300 font-myanmar">
            {lang === 'mm' 
              ? 'အကောင့်မဖွင့်ဘဲ လုပ်ငန်းတင်နိုင်ပါသည်။ အကောင့်ဖွင့်ပြီးတင်ပါက Points ရရှိမည်ဖြစ်သည်။'
              : 'You can submit a listing without an account. Registered users will earn points.'}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="px-4 space-y-4">
        {/* Logo + Cover */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-2">{t('logo_label')}</label>
            {logo ? (
              <div className="relative h-24">
                <img src={logo} alt="" className="w-full h-full rounded-2xl object-contain bg-white/5" />
                <button type="button" onClick={() => setLogo(null)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px]">✕</button>
              </div>
            ) : <ImageUploader onUpload={handleLogoUpload} loading={logoUploading} label={t('upload_logo')} />}
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-2">Cover ပုံ</label>
            {coverImg ? (
              <div className="relative h-24">
                <img src={coverImg} alt="" className="w-full h-full rounded-2xl object-cover" />
                <button type="button" onClick={() => setCoverImg(null)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px]">✕</button>
              </div>
            ) : <ImageUploader onUpload={handleCoverUpload} loading={coverUploading} label="Cover တင်ရန်" />}
          </div>
        </div>

        {/* Basic info */}
        <Field label={t('name_en')} required>
          <input type="text" value={form.name} onChange={e => setFormField('name', e.target.value)} className="input-dark" placeholder="Business Name" required />
        </Field>

        <Field label={t('name_mm_label')}>
          <input type="text" value={form.name_mm} onChange={e => setFormField('name_mm', e.target.value)} className="input-dark font-myanmar" placeholder="လုပ်ငန်း / ဝန်ဆောင်မှု အမည်..." />
        </Field>

        <Field label={t('category_label')} required>
          <div className="flex gap-2">
            <select value={form.category_id} onChange={e => setFormField('category_id', e.target.value)} className="select-dark flex-1" required>
              <option value="">{t('category_placeholder')}</option>
              {categories.filter(c => !c.parent_id).map(parent => {
                const subs = categories.filter(c => c.parent_id === parent.id)
                if (subs.length === 0) {
                  return <option key={parent.id} value={parent.id}>{parent.icon} {parent.name_mm || parent.name}</option>
                }
                return (
                  <optgroup key={parent.id} label={`${parent.icon} ${parent.name_mm || parent.name}`}>
                    {subs.map(sub => (
                      <option key={sub.id} value={sub.id}>  {sub.icon} {sub.name_mm || sub.name}</option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
            <button type="button" onClick={() => setShowQuickCat(true)}
              className="w-10 h-10 flex-shrink-0 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-white/50 hover:text-brand-300 hover:border-brand-400/30 transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </Field>

        {/* Quick category modal */}
        {showQuickCat && (
          <div className="fixed inset-0 z-[9999] flex flex-col bg-[#140020]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <button type="button" onClick={() => setShowQuickCat(false)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0">
                <X size={18} className="text-white" />
              </button>
              <h2 className="font-display font-bold text-base text-white font-myanmar">➕ Category ထည့်မည်</h2>
              <button type="button" onClick={handleQuickAddCat} disabled={!quickCat.name_mm.trim() || addingCat}
                className="btn-primary text-xs px-4 py-2 disabled:opacity-50">
                {addingCat ? '...' : 'ထည့်မည်'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Category အမည် (မြန်မာ) *</label>
                <input autoFocus value={quickCat.name_mm}
                  onChange={e => setQuickCat(q => ({...q, name_mm: e.target.value}))}
                  className="input-dark font-myanmar" placeholder="ဥပမာ: Freelance, အဝတ်လျှော်, Construction" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Sub-category ဖြစ်ရင် Parent ရွေးပါ</label>
                <select value={quickCat.parent_id}
                  onChange={e => setQuickCat(q => ({...q, parent_id: e.target.value}))}
                  className="select-dark">
                  <option value="">မရွေး (Top-level category)</option>
                  {categories.filter(c => !c.parent_id).map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name_mm || c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Icon</label>
                <div className="flex gap-1.5 flex-wrap">
                  {['📦','🏠','🔧','💄','👕','🎓','📚','🏥','🚗','🍜','💻','📱','🌿','🎵','🎮','💰','🛍️','✂️','🎭','🏋️','🧹','🚿','🔌','🎨'].map(ic => (
                    <button type="button" key={ic}
                      onClick={() => setQuickCat(q => ({...q, icon: ic}))}
                      className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center ${quickCat.icon === ic ? 'bg-brand-600/60 border border-brand-400/50' : 'bg-white/5'}`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <Field label={t('desc_label')}>
          <textarea value={form.description_mm} onChange={e => setFormField('description_mm', e.target.value)} className="input-dark font-myanmar resize-none h-20" placeholder={t('desc_placeholder')} />
        </Field>

        {/* Location section */}
        <div className="border-t border-white/8 pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-white/40 font-display font-semibold uppercase tracking-wider">တည်နေရာ</p>
            <button
              type="button"
              onClick={getMyLocation}
              disabled={locationLoading}
              className="flex items-center gap-1.5 text-xs text-brand-300 hover:text-brand-200 transition-colors"
            >
              <MapPin size={12} />
              {locationLoading ? 'ရှာနေသည်...' : 'GPS ရယူမည်'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('city_label')}>
              <select value={form.city} onChange={e => setFormField('city', e.target.value)} className="select-dark">
                <option value="">-- ရွေးပါ --</option>
                {(config.cities || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Township">
              <input type="text" value={form.township} onChange={e => setFormField('township', e.target.value)} className="input-dark" placeholder="Township..." />
            </Field>
          </div>

          <div className="mt-3">
            <Field label="လုပ်ငန်းအမျိုးအစား">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'shop',    label: '🏪 ဆိုင်',          desc: 'ရုပ်ပိုင်းဆိုင်ရာ' },
                  { value: 'service', label: '🛠 ဝန်ဆောင်မှု',    desc: 'ဆက်သွယ်မှုဖြင့်' },
                  { value: 'home',    label: '🏠 အိမ်မှ',          desc: 'Home-based' },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setFormField('business_type', opt.value)}
                    className={`p-2.5 rounded-xl border text-center transition-colors ${form.business_type === opt.value ? 'bg-brand-600/50 border-brand-400/60 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>
                    <p className="text-sm">{opt.label}</p>
                    <p className="text-[9px] text-white/40 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="mt-3">
            <Field label={t('ward_label')}>
              <input type="text" value={form.ward} onChange={e => setFormField('ward', e.target.value)} className="input-dark font-myanmar" placeholder={t('ward_placeholder')} />
            </Field>
          </div>

          <div className="mt-3">
            <Field label={t('address_label')}>
              <input type="text" value={form.address_mm} onChange={e => setFormField('address_mm', e.target.value)} className="input-dark font-myanmar" placeholder={t('address_placeholder')} />
            </Field>
          </div>

          {(form.latitude || form.longitude) && (
            <div className="mt-3 flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-white/50 mb-1.5">Latitude</label>
                <input type="text" value={form.latitude} onChange={e => setFormField('latitude', e.target.value)} className="input-dark text-xs" placeholder="16.xxxxxx" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-white/50 mb-1.5">Longitude</label>
                <input type="text" value={form.longitude} onChange={e => setFormField('longitude', e.target.value)} className="input-dark text-xs" placeholder="97.xxxxxx" />
              </div>
            </div>
          )}
          {!form.latitude && (
            <button type="button" onClick={() => { setFormField('latitude', ''); setFormField('longitude', '') }} className="mt-2 text-xs text-white/30 hover:text-white/50 transition-colors">
              + GPS coordinates ကိုယ်တိုင် ထည့်မည်
            </button>
          )}
        </div>

        {/* Contact section */}
        <div className="border-t border-white/8 pt-4">
          <p className="text-xs text-white/40 mb-3 font-display font-semibold uppercase tracking-wider">{t('contact_section')}</p>
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="block text-xs text-white/50">ဖုန်းနံပါတ်များ</label>
              {form.phones.map((phone, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => updatePhone(idx, e.target.value)}
                    className="input-dark flex-1"
                    placeholder={`ဖုန်း ${idx + 1} (09xxxxxxxxx)`}
                  />
                  {form.phones.length > 1 && (
                    <button type="button" onClick={() => removePhone(idx)} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors">
                      <Minus size={16} />
                    </button>
                  )}
                  {idx === form.phones.length - 1 && form.phones.length < 5 && (
                    <button type="button" onClick={addPhone} className="w-10 h-10 rounded-xl bg-brand-600/20 text-brand-300 flex items-center justify-center hover:bg-brand-600/30 transition-colors">
                      <Plus size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Viber">
                <input type="tel" value={form.viber} onChange={e => setFormField('viber', e.target.value)} className="input-dark" placeholder="09xxxxxxxxx" />
              </Field>
              <Field label="WhatsApp">
                <input type="tel" value={form.whatsapp} onChange={e => setFormField('whatsapp', e.target.value)} className="input-dark" placeholder="09xxxxxxxxx" />
              </Field>
            </div>

            <Field label="Telegram">
              <input type="text" value={form.telegram} onChange={e => setFormField('telegram', e.target.value)} className="input-dark" placeholder="@username" />
            </Field>

            <Field label="Facebook Page">
              <input type="url" value={form.facebook} onChange={e => setFormField('facebook', e.target.value)} className="input-dark" placeholder="https://facebook.com/..." />
            </Field>

            <Field label="Website">
              <input type="url" value={form.website} onChange={e => setFormField('website', e.target.value)} className="input-dark" placeholder="https://..." />
            </Field>
          </div>
        </div>

        {/* MENU SECTION with bigger button */}
        <div className="border-t border-white/8 pt-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-white/40 font-display font-semibold uppercase tracking-wider">
              {lang === 'mm' ? 'မီနူး / ဝန်ဆောင်မှုများ' : 'Menu / Services'}
            </p>
          </div>

          {/* Big "Add Menu Item" button */}
          <button
            type="button"
            onClick={() => openMenuForm()}
            className="w-full btn-primary py-3 mb-4 flex items-center justify-center gap-2 text-sm"
          >
            <Plus size={18} /> {lang === 'mm' ? 'မီနူးအသစ်ထည့်မည်' : 'Add Menu Item'}
          </button>

          {menuItems.length === 0 ? (
            <div className="text-center py-4 text-white/30 text-sm font-myanmar">
              {lang === 'mm' ? 'မီနူးစာရင်း မရှိသေးပါ' : 'No menu items added yet'}
            </div>
          ) : (
            <div className="space-y-3">
              {menuItems.map((item) => (
                <div key={item.id} className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-white">{item.name}</h3>
                        {item.price && (
                          <span className="text-xs bg-brand-600/30 text-brand-300 px-2 py-0.5 rounded-full">
                            {item.price} Ks
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-white/50 mt-1 line-clamp-2">{item.description}</p>
                      )}
                      {item.images && item.images.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {item.images.map((img, i) => (
                            <img key={i} src={img} alt="menu" className="w-8 h-8 rounded object-cover" />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openMenuForm(item)}
                        className="p-1.5 text-white/40 hover:text-white transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMenuItem(item.id)}
                        className="p-1.5 text-red-400/70 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit button */}
        <button type="submit" disabled={submitting || !form.name || !form.category_id} className="btn-primary w-full mt-2">
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              {t('uploading')}
            </span>
          ) : t('submit_btn')}
        </button>

        <p className="text-[11px] text-white/30 text-center font-myanmar pb-4">{t('submit_notice')}</p>
      </form>

      {/* Menu Item Modal */}
      {menuFormOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#140020] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-white/10">
            <div className="sticky top-0 bg-[#140020] p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-display font-bold text-white">
                {editingMenuItem
                  ? (lang === 'mm' ? 'မီနူးပြင်မည်' : 'Edit Menu Item')
                  : (lang === 'mm' ? 'မီနူးအသစ်ထည့်မည်' : 'Add Menu Item')}
              </h3>
              <button onClick={closeMenuForm} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-white/50 mb-1.5 font-myanmar">
                  {lang === 'mm' ? 'အမည်' : 'Item Name'} *
                </label>
                <input
                  type="text"
                  value={menuForm.name}
                  onChange={e => setMenuForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input-dark w-full"
                  placeholder={lang === 'mm' ? 'ဥပမာ: မုန့်တီ' : 'e.g. Mohinga'}
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  {lang === 'mm' ? 'ဈေးနှုန်း (ကျပ်)' : 'Price (Ks)'}
                </label>
                <input
                  type="text"
                  value={menuForm.price}
                  onChange={e => setMenuForm(prev => ({ ...prev, price: e.target.value }))}
                  className="input-dark w-full"
                  placeholder="2000"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5 font-myanmar">
                  {lang === 'mm' ? 'ဖော်ပြချက်' : 'Description'}
                </label>
                <textarea
                  value={menuForm.description}
                  onChange={e => setMenuForm(prev => ({ ...prev, description: e.target.value }))}
                  rows="2"
                  className="input-dark w-full resize-none"
                  placeholder={lang === 'mm' ? 'အနှစ်ချုပ် ဖော်ပြချက်...' : 'Brief description...'}
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  {lang === 'mm' ? 'ပုံများ (အများဆုံး ၅ ပုံ)' : 'Images (max 5)'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {menuForm.images.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/20">
                      <img src={img} alt="menu" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeMenuImage(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {menuForm.images.length < 5 && (
                    <ImageUploader
                      onUpload={handleMenuImageUpload}
                      loading={menuImageLoading}
                      label="+"
                      className="aspect-square w-full"
                    />
                  )}
                </div>
                {menuError && <p className="text-xs text-red-400 mt-2">{menuError}</p>}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={saveMenuItem}
                  className="flex-1 btn-primary py-2 text-sm"
                >
                  {lang === 'mm' ? 'သိမ်းမည်' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={closeMenuForm}
                  className="flex-1 btn-ghost py-2 text-sm"
                >
                  {lang === 'mm' ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}