import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, MapPin, Plus, X, Minus, Info, Search, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { uploadImage } from '../lib/cloudinary'
import { ImageUploader } from '../components/UI'
import { useAppConfig } from '../contexts/AppConfigContext'
import IconPicker from '../components/IconPicker'
import LocationPicker from '../components/LocationPicker'
import { BusinessHoursEditor } from '../components/BusinessHours'
import { confirmDialog } from '../lib/confirmDialog'
import { showError } from '../lib/toast'

function Field({ label, children, required, optional }) {
  return (
    <div>
      <label className="block text-xs text-white/50 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
        {optional && <span className="text-white/25 font-normal ml-1">(optional)</span>}
      </label>
      {children}
    </div>
  )
}

function SectionHeader({ num, title, subtitle }) {
  return (
    <div className="border-t border-white/8 pt-5">
      <div className="flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-600 to-brand-700 text-white text-xs font-display font-bold flex items-center justify-center flex-shrink-0 border border-brand-400/40">
          {num}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-display font-bold text-white font-myanmar leading-tight">{title}</p>
          {subtitle && <p className="text-[10px] text-white/30 font-myanmar mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

export default function SubmitListingPage() {
  const navigate = useNavigate()
  const { profile, isLoggedIn, isAdmin, isModerator } = useAuth()
  const { t, lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'လုပ်ငန်း / ဝန်ဆောင်မှု ထည့်မည်' : 'Submit Listing' })

  const config = useAppConfig()
  const [categories, setCategories] = useState([])
  const [catSearch, setCatSearch] = useState('')
  const [form, setForm] = useState({
    name: '', name_mm: '', description_mm: '', description: '',
    category_id: '', city: '', township: '', ward: '',
    address: '', address_mm: '',
    phones: ['', ''],
    viber: '', telegram: '', whatsapp: '', facebook: '', website: '',
    latitude: '', longitude: '', business_type: 'shop',
    hours: null,
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
  const [showMapPicker, setShowMapPicker] = useState(false)

  // Menu items state
  const [menuItems, setMenuItems] = useState([])
  const [editingMenuItem, setEditingMenuItem] = useState(null)
  const [menuFormOpen, setMenuFormOpen] = useState(false)
  const [menuForm, setMenuForm] = useState({ name: '', price: '', description: '', images: [] })
  const [menuImageLoading, setMenuImageLoading] = useState(false)
  const [menuError, setMenuError] = useState('')
  const [dupError, setDupError] = useState(null)

  useEffect(() => {
    supabase.from('categories').select('*').eq('type', 'directory').eq('is_active', true).order('sort_order').then(({ data }) => setCategories(data || []))
  }, [])

  function setFormField(key, value) { setForm(f => ({ ...f, [key]: value })) }

  function updatePhone(index, value) {
    const newPhones = [...form.phones]
    newPhones[index] = value
    setFormField('phones', newPhones)
  }
  function addPhone() { if (form.phones.length < 5) setFormField('phones', [...form.phones, '']) }
  function removePhone(index) { if (form.phones.length > 1) setFormField('phones', form.phones.filter((_, i) => i !== index)) }

  async function handleLogoUpload(file) {
    setLogoUploading(true)
    try { setLogo(await uploadImage(file, 'listings/logos')) } catch (err) { console.warn('Logo upload failed:', err) }
    setLogoUploading(false)
  }
  async function handleCoverUpload(file) {
    setCoverUploading(true)
    try { setCoverImg(await uploadImage(file, 'listings/covers')) } catch (err) { console.warn('Cover upload failed:', err) }
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

  const openMenuForm = (item = null) => {
    if (item) {
      setEditingMenuItem(item)
      setMenuForm({ name: item.name, price: item.price, description: item.description, images: item.images || [] })
    } else {
      setEditingMenuItem(null)
      setMenuForm({ name: '', price: '', description: '', images: [] })
    }
    setMenuFormOpen(true)
    setMenuError('')
  }
  const closeMenuForm = () => {
    setMenuFormOpen(false); setEditingMenuItem(null)
    setMenuForm({ name: '', price: '', description: '', images: [] }); setMenuError('')
  }
  const handleMenuImageUpload = async (file) => {
    if (menuForm.images.length >= 5) { setMenuError(lang === 'mm' ? 'အများဆုံး ၅ ပုံသာ တင်နိုင်ပါသည်' : 'Maximum 5 images'); return }
    setMenuImageLoading(true)
    const url = await uploadImage(file, 'menu')
    setMenuForm(prev => ({ ...prev, images: [...prev.images, url] }))
    setMenuImageLoading(false)
  }
  const removeMenuImage = (index) => setMenuForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }))
  const saveMenuItem = () => {
    if (!menuForm.name.trim()) { setMenuError(lang === 'mm' ? 'အမည် ထည့်ပါ' : 'Name required'); return }
    const newItem = {
      id: editingMenuItem?.id || Date.now().toString(),
      name: menuForm.name.trim(),
      price: menuForm.price.trim(),
      description: menuForm.description.trim(),
      images: menuForm.images,
    }
    if (editingMenuItem) setMenuItems(prev => prev.map(i => i.id === editingMenuItem.id ? newItem : i))
    else setMenuItems(prev => [...prev, newItem])
    closeMenuForm()
  }
  const deleteMenuItem = async (id) => {
    if (await confirmDialog(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete this item?')) setMenuItems(prev => prev.filter(i => i.id !== id))
  }

  async function checkDuplicates() {
    const nameToCheck = form.name_mm || form.name;
    const phoneToCheck = form.phones[0] || null;

    if (!nameToCheck) return false;

    try {
      // Fetch potential matches based on name OR phone
      let query = supabase.from('listings').select('id, name, name_mm, phone_1, latitude, longitude');
      
      let conditions = [];
      if (nameToCheck) conditions.push(`name.ilike.%${nameToCheck}%`, `name_mm.ilike.%${nameToCheck}%`);
      if (phoneToCheck) conditions.push(`phone_1.eq.${phoneToCheck}`);
      
      if (conditions.length > 0) {
        query = query.or(conditions.join(','));
      }

      const { data } = await query.limit(10);
      
      if (data && data.length > 0) {
        for (const match of data) {
          const matchName = (match.name_mm || match.name || '').trim().toLowerCase();
          const inputName = nameToCheck.trim().toLowerCase();
          
          const nameMatches = matchName === inputName || matchName.includes(inputName) || inputName.includes(matchName);
          const phoneMatches = phoneToCheck && match.phone_1 === phoneToCheck;
          
          // Check distance if coords exist
          let distMatches = false;
          if (form.latitude && match.latitude) {
             const latDiff = Math.abs(form.latitude - match.latitude);
             const lonDiff = Math.abs(form.longitude - match.longitude);
             // Very close (approx 100 meters)
             if (latDiff < 0.001 && lonDiff < 0.001) distMatches = true;
          }

          // If EVERYTHING matches (Name + Phone/Distance) -> Block
          if (nameMatches && (phoneMatches || distMatches)) {
            setDupError(match);
            return true;
          }
        }
      }
    } catch (e) {
      console.warn('Duplicate check failed:', e);
    }
    return false;
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    if ((!form.name && !form.name_mm) || !form.category_id) return
    
    const isDup = await checkDuplicates();
    if (isDup) return; // တူနေရင် တင်ခွင့်မပြု
    
    setDupError(null);
    setSubmitting(true)
    try {
      const phoneColumns = {}
      form.phones.forEach((phone, idx) => { if (phone) phoneColumns['phone_' + (idx + 1)] = phone })
      const { phones, ...restData } = form
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
        status: 'approved',
        report_count: 0,
      })
      if (error) throw error
      setDone(true)
    } catch (err) {
      console.error('Submit listing failed:', err)
      showError(err.message)
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

  const canSubmit = !submitting && (form.name_mm || form.name) && form.category_id

  // Business type — clearer labels
  const BUSINESS_TYPES = [
    { value: 'shop',    emoji: '🏪', label: lang === 'mm' ? 'ဆိုင်' : 'Shop',       desc: lang === 'mm' ? 'လူကိုယ်တိုင် လာရောက်' : 'Walk-in' },
    { value: 'service', emoji: '🛠',  label: lang === 'mm' ? 'ဝန်ဆောင်မှု' : 'Service', desc: lang === 'mm' ? 'ဖုန်း / အွန်လိုင်း' : 'Phone/Online' },
    { value: 'home',    emoji: '🏠', label: lang === 'mm' ? 'အိမ်မှ' : 'Home-based', desc: lang === 'mm' ? 'အိမ်မှ လုပ်ငန်း' : 'From home' },
  ]

  // Category search filter
  const catQuery = catSearch.trim().toLowerCase()
  const filteredCategories = catQuery
    ? categories.filter(c =>
        (c.name_mm || '').toLowerCase().includes(catQuery) ||
        (c.name || '').toLowerCase().includes(catQuery)
      )
    : categories
  const visibleParents = filteredCategories.filter(c => !c.parent_id)

  return (
    <div className="pb-28">
      {/* Sticky header with Save */}
      <div
        className="sticky z-40 bg-[#0d0015]/95 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4 py-3"
        style={{ top: 'var(--header-h)' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0"
        >
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display font-bold text-base text-white font-myanmar truncate px-2">
          {t('submit_title')}
        </h1>
        <button
          type="submit"
          form="submit-listing-form"
          disabled={!canSubmit}
          className={
            'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-display font-bold transition-all ' +
            (canSubmit
              ? 'bg-brand-600 text-white hover:bg-brand-500 shadow-md shadow-brand-900/40'
              : 'bg-white/8 text-white/30 cursor-not-allowed')
          }
        >
          {submitting
            ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Check size={14} />}
          {submitting ? '' : (lang === 'mm' ? 'သိမ်း' : 'Save')}
        </button>
      </div>

      {!isLoggedIn && (
        <div className="mx-4 mt-4 mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-2">
          <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300 font-myanmar">
            {lang === 'mm'
              ? 'အကောင့်မဖွင့်ဘဲ လုပ်ငန်းတင်နိုင်ပါသည်။ အကောင့်ဖွင့်ပြီးတင်ပါက Points ရရှိမည်ဖြစ်သည်။'
              : 'You can submit without an account. Registered users earn points.'}
          </p>
        </div>
      )}

      <form id="submit-listing-form" onSubmit={handleSubmit} className="px-4 pt-4 space-y-4">

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

        {/* ① အခြေခံအချက် */}
        <SectionHeader num="1" title={lang === 'mm' ? 'အခြေခံအချက်' : 'Basic Info'} subtitle={lang === 'mm' ? 'လုပ်ငန်း အမည်နှင့် အမျိုးအစား' : 'Name & category'} />

        <Field label={t('name_mm_label')} required>
          <input
            type="text"
            value={form.name_mm}
            onChange={e => setFormField('name_mm', e.target.value)}
            className="input-dark font-myanmar"
            placeholder={lang === 'mm' ? 'လုပ်ငန်း / ဝန်ဆောင်မှု အမည်...' : 'Business name (Myanmar)'}
          />
        </Field>

        <Field label={t('name_en')} optional>
          <input
            type="text"
            value={form.name}
            onChange={e => setFormField('name', e.target.value)}
            className="input-dark"
            placeholder="Business Name (English)"
          />
        </Field>

        <Field label={t('category_label')} required>
          {/* Category search */}
          {categories.length > 8 && (
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={catSearch}
                onChange={e => setCatSearch(e.target.value)}
                className="input-dark pl-9 text-sm w-full"
                placeholder={lang === 'mm' ? 'Category ရှာရန်...' : 'Search category...'}
              />
              {catSearch && (
                <button type="button" onClick={() => setCatSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <select
              value={form.category_id}
              onChange={e => setFormField('category_id', e.target.value)}
              className="select-dark flex-1"
              required
            >
              <option value="">{t('category_placeholder')}</option>
              {visibleParents.map(parent => {
                const subs = filteredCategories.filter(c => c.parent_id === parent.id)
                if (subs.length === 0) {
                  return <option key={parent.id} value={parent.id}>{parent.icon} {parent.name_mm || parent.name}</option>
                }
                return (
                  <optgroup key={parent.id} label={(parent.icon || '') + ' ' + (parent.name_mm || parent.name)}>
                    {subs.map(sub => (
                      <option key={sub.id} value={sub.id}>  {sub.icon} {sub.name_mm || sub.name}</option>
                    ))}
                  </optgroup>
                )
              })}
              {catQuery && visibleParents.length === 0 && (
                <option value="" disabled>
                  {lang === 'mm' ? 'ရှာတွေ့မှု မရှိ' : 'No matches'}
                </option>
              )}
            </select>

            {isLoggedIn ? (
              <button
                type="button"
                onClick={() => setShowQuickCat(true)}
                className="w-10 h-10 flex-shrink-0 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-white/50 hover:text-brand-300 hover:border-brand-400/30 transition-colors"
                title={lang === 'mm' ? 'Category အသစ်ထည့်မည်' : 'Add new category'}
              >
                <Plus size={16} />
              </button>
            ) : (
              <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-white/30 cursor-not-allowed" title={lang === 'mm' ? 'Account ဖွင့်ပါ' : 'Sign up'}>
                <span className="text-[10px]">🔒</span>
              </div>
            )}
          </div>
          {!isLoggedIn && (
            <p className="text-[10px] text-amber-400 mt-1 font-myanmar">
              {lang === 'mm' ? 'Category အသစ်ထည့်ချင်ပါက Account ဖွင့်ပါ' : 'Sign up to add new category'}
            </p>
          )}
        </Field>

        <Field label={t('desc_label')} optional>
          <textarea
            value={form.description_mm}
            onChange={e => setFormField('description_mm', e.target.value)}
            className="input-dark font-myanmar resize-none h-20"
            placeholder={t('desc_placeholder')}
          />
        </Field>

        {/* ② ဆက်သွယ်ရေး */}
        <SectionHeader num="2" title={lang === 'mm' ? 'ဆက်သွယ်ရေး' : 'Contact'} subtitle={lang === 'mm' ? 'ဖုန်း၊ Viber၊ Telegram' : 'Phone & social'} />

        <div className="space-y-2">
          <label className="block text-xs text-white/50">{lang === 'mm' ? 'ဖုန်းနံပါတ်များ' : 'Phone numbers'}</label>
          {form.phones.map((phone, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={e => updatePhone(idx, e.target.value)}
                className="input-dark flex-1"
                placeholder={'ဖုန်း ' + (idx + 1) + ' (09xxxxxxxxx)'}
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
          <Field label="Viber"><input type="tel" value={form.viber} onChange={e => setFormField('viber', e.target.value)} className="input-dark" placeholder="09xxxxxxxxx" /></Field>
          <Field label="WhatsApp"><input type="tel" value={form.whatsapp} onChange={e => setFormField('whatsapp', e.target.value)} className="input-dark" placeholder="09xxxxxxxxx" /></Field>
        </div>

        <Field label="Telegram"><input type="text" value={form.telegram} onChange={e => setFormField('telegram', e.target.value)} className="input-dark" placeholder="@username" /></Field>
        <Field label="Facebook Page" optional><input type="url" value={form.facebook} onChange={e => setFormField('facebook', e.target.value)} className="input-dark" placeholder="https://facebook.com/..." /></Field>
        <Field label="Website" optional><input type="url" value={form.website} onChange={e => setFormField('website', e.target.value)} className="input-dark" placeholder="https://..." /></Field>

        {/* ③ တည်နေရာ */}
        <SectionHeader num="3" title={lang === 'mm' ? 'တည်နေရာ' : 'Location'} subtitle={lang === 'mm' ? 'လိပ်စာ၊ မြို့၊ GPS' : 'Address & map'} />

        <Field label={lang === 'mm' ? 'လုပ်ငန်းအမျိုးအစား' : 'Business type'}>
          <div className="grid grid-cols-3 gap-2">
            {BUSINESS_TYPES.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormField('business_type', opt.value)}
                className={
                  'p-2.5 rounded-xl border text-center transition-colors ' +
                  (form.business_type === opt.value
                    ? 'bg-brand-600/50 border-brand-400/60 text-brand-200'
                    : 'bg-white/5 border-white/10 text-white/50')
                }
              >
                <p className="text-lg leading-none mb-1">{opt.emoji}</p>
                <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                <p className="text-[9px] text-white/40 mt-0.5 leading-tight">{opt.desc}</p>
              </button>
            ))}
          </div>
        </Field>

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

        <Field label={t('ward_label')}>
          <input type="text" value={form.ward} onChange={e => setFormField('ward', e.target.value)} className="input-dark font-myanmar" placeholder={t('ward_placeholder')} />
        </Field>

        <Field label={t('address_label')}>
          <input type="text" value={form.address_mm} onChange={e => setFormField('address_mm', e.target.value)} className="input-dark font-myanmar" placeholder={t('address_placeholder')} />
        </Field>

        {/* GPS */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={getMyLocation}
            disabled={locationLoading}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-brand-300 hover:border-brand-400/30 transition-colors"
          >
            <MapPin size={12} />
            {locationLoading ? (lang === 'mm' ? 'ရှာနေသည်...' : 'Locating...') : (lang === 'mm' ? 'GPS ရယူမည်' : 'Use GPS')}
          </button>
          <button
            type="button"
            onClick={() => setShowMapPicker(true)}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-brand-300 hover:border-brand-400/30 transition-colors"
          >
            <MapPin size={12} /> {lang === 'mm' ? 'မြေပုံမှ ရွေးမည်' : 'Pick on map'}
          </button>
        </div>

        {(form.latitude || form.longitude) && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-white/40 mb-1">Latitude</label>
              <input type="text" value={form.latitude} onChange={e => setFormField('latitude', e.target.value)} className="input-dark text-xs" placeholder="16.xxxxxx" />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-white/40 mb-1">Longitude</label>
              <input type="text" value={form.longitude} onChange={e => setFormField('longitude', e.target.value)} className="input-dark text-xs" placeholder="97.xxxxxx" />
            </div>
          </div>
        )}

        {/* ④ ဖွင့်ချိန် */}
        <SectionHeader num="4" title={lang === 'mm' ? 'ဖွင့်ချိန်' : 'Business Hours'} subtitle={lang === 'mm' ? 'ဖွင့်/ပိတ် အချိန်' : 'Optional — open hours'} />
        <BusinessHoursEditor value={form.hours} onChange={h => setFormField('hours', h)} lang={lang} />

        {/* ⑤ မီနူး */}
        <SectionHeader num="5" title={lang === 'mm' ? 'မီနူး / ဝန်ဆောင်မှုများ' : 'Menu / Services'} subtitle={lang === 'mm' ? 'Optional — စားသောက်ဆိုင်၊ ဆိုင်များအတွက်' : 'Optional — for shops/restaurants'} />

        <button
          type="button"
          onClick={() => openMenuForm()}
          className="w-full btn-primary py-3 flex items-center justify-center gap-2 text-sm"
        >
          <Plus size={18} /> {lang === 'mm' ? 'မီနူးအသစ်ထည့်မည်' : 'Add Menu Item'}
        </button>

        {menuItems.length === 0 ? (
          <div className="text-center py-3 text-white/30 text-xs font-myanmar">
            {lang === 'mm' ? 'မီနူးစာရင်း မရှိသေးပါ' : 'No menu items yet'}
          </div>
        ) : (
          <div className="space-y-2">
            {menuItems.map((item) => (
              <div key={item.id} className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-white truncate font-myanmar">{item.name}</h3>
                      {item.price && (
                        <span className="text-xs bg-brand-600/30 text-brand-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {item.price} Ks
                        </span>
                      )}
                    </div>
                    {item.description && <p className="text-xs text-white/50 mt-1 line-clamp-2 font-myanmar">{item.description}</p>}
                    {item.images && item.images.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {item.images.map((img, i) => (
                          <img key={i} src={img} alt="menu" className="w-8 h-8 rounded object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button type="button" onClick={() => openMenuForm(item)} className="p-1.5 text-white/40 hover:text-white transition-colors">✏️</button>
                    <button type="button" onClick={() => deleteMenuItem(item.id)} className="p-1.5 text-red-400/70 hover:text-red-400 transition-colors">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline Submit (bottom of form) */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn-primary w-full mt-4 disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              {t('uploading')}
            </span>
          ) : t('submit_btn')}
        </button>

        <p className="text-[11px] text-white/30 text-center font-myanmar pb-2">{t('submit_notice')}</p>
      </form>

      {/* Quick category modal */}
      {showQuickCat && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[#140020] pt-safe">
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
              <IconPicker value={quickCat.icon} onChange={(icon) => setQuickCat(q => ({...q, icon}))} label={null} />
            </div>
          </div>
        </div>
      )}

      {/* Menu Item Modal */}
      {menuFormOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 pt-safe">
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
                  {lang === 'mm' ? 'အမည်' : 'Item Name'} <span className="text-red-400">*</span>
                </label>
                <input type="text" value={menuForm.name}
                  onChange={e => setMenuForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input-dark w-full" placeholder={lang === 'mm' ? 'ဥပမာ: မုန့်တီ' : 'e.g. Mohinga'} />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  {lang === 'mm' ? 'ဈေးနှုန်း (ကျပ်)' : 'Price (Ks)'}
                </label>
                <input type="text" value={menuForm.price}
                  onChange={e => setMenuForm(prev => ({ ...prev, price: e.target.value }))}
                  className="input-dark w-full" placeholder="2000" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5 font-myanmar">
                  {lang === 'mm' ? 'ဖော်ပြချက်' : 'Description'}
                </label>
                <textarea value={menuForm.description}
                  onChange={e => setMenuForm(prev => ({ ...prev, description: e.target.value }))}
                  rows="2" className="input-dark w-full resize-none"
                  placeholder={lang === 'mm' ? 'အနှစ်ချုပ် ဖော်ပြချက်...' : 'Brief description...'} />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  {lang === 'mm' ? 'ပုံများ (အများဆုံး ၅ ပုံ)' : 'Images (max 5)'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {menuForm.images.map((img, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/20">
                      <img src={img} alt="menu" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeMenuImage(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white text-xs">
                        ✕
                      </button>
                    </div>
                  ))}
                  {menuForm.images.length < 5 && (
                    <ImageUploader onUpload={handleMenuImageUpload} loading={menuImageLoading} label="+" className="aspect-square w-full" />
                  )}
                </div>
                {menuError && <p className="text-xs text-red-400 mt-2">{menuError}</p>}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={saveMenuItem} className="flex-1 btn-primary py-2 text-sm">
                  {lang === 'mm' ? 'သိမ်းမည်' : 'Save'}
                </button>
                <button type="button" onClick={closeMenuForm} className="flex-1 btn-ghost py-2 text-sm">
                  {lang === 'mm' ? 'မလုပ်တော့ပါ' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map Picker */}
      {showMapPicker && (
        <LocationPicker
          onSelect={(latLng) => {
            setFormField('latitude', latLng.lat.toFixed(7))
            setFormField('longitude', latLng.lng.toFixed(7))
            setShowMapPicker(false)
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </div>
  )
}
