import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, MapPin, Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { uploadImage } from '../lib/cloudinary'
import { ImageUploader } from '../components/UI'
import { useAppConfig } from '../hooks/useAppConfig'



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
  const { profile } = useAuth()
  const { t, lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'လုပ်ငန်း / ဝန်ဆောင်မှု ထည့်မည်' : 'Submit Listing' })

  const config = useAppConfig()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({
    name: '', name_mm: '', description_mm: '', description: '',
    category_id: '', city: '', township: '', ward: '',
    address: '', address_mm: '', phone_1: '', phone_2: '',
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
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCat, setNewCat] = useState({ name_mm: '', name: '', parent_mm: '', icon: '📦', is_sub: false })
  const [addingCat, setAddingCat] = useState(false)

  useEffect(() => {
    supabase.from('categories').select('*').eq('type', 'directory').eq('is_active', true).order('sort_order').then(({ data }) => setCategories(data || []))
  }, [])

  function set(key, value) { setForm(f => ({ ...f, [key]: value })) }

  async function handleLogoUpload(file) {
    setLogoUploading(true)
    try {
      const url = await uploadImage(file, 'listings/logos')
      setLogo(url)
    } catch (err) {
      console.warn('Logo upload failed:', err)
    }
    setLogoUploading(false)
  }

  async function handleCoverUpload(file) {
    setCoverUploading(true)
    try {
      const url = await uploadImage(file, 'listings/covers')
      setCoverImg(url)
    } catch (err) {
      console.warn('Cover upload failed:', err)
    }
    setCoverUploading(false)
  }

  function getMyLocation() {
    if (!navigator.geolocation) return
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        set('latitude', pos.coords.latitude.toFixed(7))
        set('longitude', pos.coords.longitude.toFixed(7))
        setLocationLoading(false)
      },
      () => setLocationLoading(false)
    )
  }

  async function addQuickCategory() {
    if (!newCat.name_mm.trim()) return
    setAddingCat(true)
    try {
      // Check if user wants a sub-category
      let parentId = null
      if (newCat.is_sub && newCat.parent_mm.trim()) {
        // Find or create parent
        const existing = categories.find(c => c.name_mm === newCat.parent_mm.trim() && !c.parent_id)
        if (existing) {
          parentId = existing.id
        } else {
          const { data: newParent } = await supabase.from('categories').insert({
            name: newCat.parent_mm.trim(), name_mm: newCat.parent_mm.trim(),
            icon: '📁', type: 'directory', sort_order: 999, is_active: true
          }).select().single()
          parentId = newParent?.id
        }
      }
      const { data: newCatData } = await supabase.from('categories').insert({
        name: newCat.name || newCat.name_mm.trim(),
        name_mm: newCat.name_mm.trim(),
        icon: newCat.icon || '📦',
        type: 'directory',
        parent_id: parentId,
        sort_order: 999,
        is_active: true,
      }).select().single()
      // Reload categories and select new one
      const { data: cats } = await supabase.from('categories').select('*').eq('type', 'directory').eq('is_active', true).order('sort_order')
      setCategories(cats || [])
      if (newCatData) set('category_id', newCatData.id)
      setNewCat({ name_mm: '', name: '', parent_mm: '', icon: '📦', is_sub: false })
      setShowAddCat(false)
    } catch (e) { console.warn(e) }
    setAddingCat(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.category_id) return
    setSubmitting(true)
    try {
      await supabase.from('listings').insert({
        ...form,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        logo_url: logo,
        cover_url: coverImg,
        images: [],
        submitted_by: profile.id,
        status: 'pending',
      })
      setDone(true)
    } catch (err) {
      console.warn('Submit listing failed:', err)
    }
    setSubmitting(false)
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
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className="input-dark" placeholder="Business Name" required />
        </Field>

        <Field label={t('name_mm_label')}>
          <input type="text" value={form.name_mm} onChange={e => set('name_mm', e.target.value)} className="input-dark font-myanmar" placeholder="လုပ်ငန်း / ဝန်ဆောင်မှု အမည်..." />
        </Field>

        <Field label={t('category_label')} required>
          <div className="flex gap-2">
            <select value={form.category_id} onChange={e => set('category_id', e.target.value)} className="select-dark flex-1" required>
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
            <button type="button" onClick={() => setShowAddCat(true)}
              className="w-10 h-10 flex-shrink-0 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-white/50 hover:text-brand-300 hover:border-brand-400/30 transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </Field>

        {/* Quick-add category modal */}
        {showAddCat && (
          <div className="fixed inset-0 z-[9999] flex flex-col bg-[#140020]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <button onClick={() => setShowAddCat(false)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0">
                <X size={18} className="text-white" />
              </button>
              <h2 className="font-display font-bold text-base text-white">{lang === 'mm' ? '➕ Category ထည့်မည်' : '➕ Add Category'}</h2>
              <button onClick={addQuickCategory} disabled={!newCat.name_mm.trim() || addingCat}
                className="btn-primary text-xs px-4 py-2 disabled:opacity-50">
                {addingCat ? '...' : lang === 'mm' ? 'ထည့်မည်' : 'Add'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24">
              <div>
                <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'Category အမည် (မြန်မာ) *' : 'Category Name (Myanmar) *'}</label>
                <input autoFocus value={newCat.name_mm} onChange={e => setNewCat(n => ({...n, name_mm: e.target.value}))}
                  className="input-dark font-myanmar" placeholder="ဥပမာ: House Hold, Education, Construction" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'Category အမည် (English)' : 'Category Name (English)'}</label>
                <input value={newCat.name} onChange={e => setNewCat(n => ({...n, name: e.target.value}))}
                  className="input-dark" placeholder="e.g. House Hold, Education" />
              </div>
              <div className="flex items-center gap-3 py-2">
                <button type="button" onClick={() => setNewCat(n => ({...n, is_sub: !n.is_sub}))}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-colors ${newCat.is_sub ? 'bg-brand-600/20 border-brand-400/30 text-brand-200' : 'bg-white/5 border-white/10 text-white/50'}`}>
                  {newCat.is_sub ? '✓' : '○'} {lang === 'mm' ? 'Sub-category ဖြစ်သည်' : 'This is a sub-category'}
                </button>
              </div>
              {newCat.is_sub && (
                <div>
                  <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'Parent Category (မြန်မာ)' : 'Parent Category'}</label>
                  <select value={newCat.parent_mm} onChange={e => setNewCat(n => ({...n, parent_mm: e.target.value}))}
                    className="select-dark">
                    <option value="">{lang === 'mm' ? 'Parent Category ရွေးပါ...' : 'Select parent...'}</option>
                    {categories.filter(c => !c.parent_id).map(c => (
                      <option key={c.id} value={c.name_mm}>{c.icon} {c.name_mm || c.name}</option>
                    ))}
                    <option value="__new__">{lang === 'mm' ? '+ အသစ်ထည့်မည်...' : '+ Add new parent...'}</option>
                  </select>
                  {newCat.parent_mm === '__new__' && (
                    <input value="" onChange={e => setNewCat(n => ({...n, parent_mm: e.target.value}))}
                      className="input-dark font-myanmar mt-2" placeholder={lang === 'mm' ? 'Parent Category အမည်...' : 'Parent category name...'} />
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">Icon</label>
                <div className="flex gap-1.5 flex-wrap">
                  {['📦','🏠','🔧','💄','👕','🎓','📚','🏥','🚗','🍜','💻','📱','🌿','🎵','🎮','💰','🛍️','✂️','🎭','🏋️'].map(ic => (
                    <button type="button" key={ic} onClick={() => setNewCat(n => ({...n, icon: ic}))}
                      className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center ${newCat.icon === ic ? 'bg-brand-600/60 border border-brand-400/50' : 'bg-white/5'}`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <Field label={t('desc_label')}>
          <textarea value={form.description_mm} onChange={e => set('description_mm', e.target.value)} className="input-dark font-myanmar resize-none h-20" placeholder={t('desc_placeholder')} />
        </Field>

        {/* Location */}
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
              <select value={form.city} onChange={e => set('city', e.target.value)} className="select-dark">
                <option value="">-- ရွေးပါ --</option>
                {(config.cities || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Township">
              <input type="text" value={form.township} onChange={e => set('township', e.target.value)} className="input-dark" placeholder="Township..." />
            </Field>
          </div>

          {/* Business type */}
          <div className="mt-3">
            <Field label="လုပ်ငန်းအမျိုးအစား">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'shop',    label: '🏪 ဆိုင်',          desc: 'ရုပ်ပိုင်းဆိုင်ရာ' },
                  { value: 'service', label: '🛠 ဝန်ဆောင်မှု',    desc: 'ဆက်သွယ်မှုဖြင့်' },
                  { value: 'home',    label: '🏠 အိမ်မှ',          desc: 'Home-based' },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => set('business_type', opt.value)}
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
              <input type="text" value={form.ward} onChange={e => set('ward', e.target.value)} className="input-dark font-myanmar" placeholder={t('ward_placeholder')} />
            </Field>
          </div>

          <div className="mt-3">
            <Field label={t('address_label')}>
              <input type="text" value={form.address_mm} onChange={e => set('address_mm', e.target.value)} className="input-dark font-myanmar" placeholder={t('address_placeholder')} />
            </Field>
          </div>

          {/* GPS coordinates */}
          {(form.latitude || form.longitude) && (
            <div className="mt-3 flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-white/50 mb-1.5">Latitude</label>
                <input type="text" value={form.latitude} onChange={e => set('latitude', e.target.value)} className="input-dark text-xs" placeholder="16.xxxxxx" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-white/50 mb-1.5">Longitude</label>
                <input type="text" value={form.longitude} onChange={e => set('longitude', e.target.value)} className="input-dark text-xs" placeholder="97.xxxxxx" />
              </div>
            </div>
          )}
          {!form.latitude && (
            <button type="button" onClick={() => { set('latitude', ''); set('longitude', '') }} className="mt-2 text-xs text-white/30 hover:text-white/50 transition-colors">
              + GPS coordinates ကိုယ်တိုင် ထည့်မည်
            </button>
          )}
        </div>

        {/* Contact */}
        <div className="border-t border-white/8 pt-4">
          <p className="text-xs text-white/40 mb-3 font-display font-semibold uppercase tracking-wider">{t('contact_section')}</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('phone1_label')}>
                <input type="tel" value={form.phone_1} onChange={e => set('phone_1', e.target.value)} className="input-dark" placeholder="09xxxxxxxxx" />
              </Field>
              <Field label={t('phone2_label')}>
                <input type="tel" value={form.phone_2} onChange={e => set('phone_2', e.target.value)} className="input-dark" placeholder="(optional)" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Viber">
                <input type="tel" value={form.viber} onChange={e => set('viber', e.target.value)} className="input-dark" placeholder="09xxxxxxxxx" />
              </Field>
              <Field label="WhatsApp">
                <input type="tel" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} className="input-dark" placeholder="09xxxxxxxxx" />
              </Field>
            </div>

            <Field label="Telegram">
              <input type="text" value={form.telegram} onChange={e => set('telegram', e.target.value)} className="input-dark" placeholder="@username" />
            </Field>

            <Field label="Facebook Page">
              <input type="url" value={form.facebook} onChange={e => set('facebook', e.target.value)} className="input-dark" placeholder="https://facebook.com/..." />
            </Field>

            <Field label="Website">
              <input type="url" value={form.website} onChange={e => set('website', e.target.value)} className="input-dark" placeholder="https://..." />
            </Field>
          </div>
        </div>

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
    </div>
  )
}
