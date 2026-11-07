import { useState, useEffect, useRef } from 'react'
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
import { validateListing, normalizePhone, toLatinDigits } from '../lib/validation'
import { draftKey, saveDraft, loadDraft, clearDraft, debounce } from '../lib/draftStorage'

function Field({ label, children, required, optional }) {
  return (
    <div>
      <label className="block text-xs text-white/50 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
        {optional && <span className="text-white/60 font-normal ml-1">(optional)</span>}
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
          {subtitle && <p className="text-[10px] text-white/60 font-myanmar mt-0.5">{subtitle}</p>}
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
  const [menuForm, setMenuForm] = useState({ name: '', name_mm: '', price: '', description: '', images: [] })
  const [menuImageLoading, setMenuImageLoading] = useState(false)
  const [menuError, setMenuError] = useState('')
  const [dupError, setDupError] = useState(null)
  // v9.17 (Issue 2): submit draft autosave — same mechanism as Edit
  // (cherry-submit-draft). A draft restores on mount with a small note.
  const [draftRestored, setDraftRestored] = useState(false)
  const saveDraftDebounced = useRef(null)
  // B22: bypass once the user confirms the listing is genuinely different.
  // A ref (not state) so the banner button can set it and submit in one tap.
  const dupBypassRef = useRef(false)
  // B2: inline error + scroll target when required fields are missing.
  const [submitError, setSubmitError] = useState('')
  const nameInputRef = useRef(null)
  const catSelectRef = useRef(null)

  useEffect(() => {
    supabase.from('categories').select('*').eq('type', 'directory').eq('is_active', true).order('sort_order').then(({ data }) => setCategories(data || []))
  }, [])

  // v9.17 (Issue 2): restore an unsaved submit draft, then autosave the
  // form (debounced ~500 ms) on every change. Cleared on success.
  // SB9 (v9.20): the draft also covers the logo/cover URLs and menu
  // items — they used to be lost on reload despite the draft.
  useEffect(() => {
    const d = loadDraft(draftKey('submit'))
    if (d?.form) {
      const { logo: dLogo, coverImg: dCover, menuItems: dMenu, ...dForm } = d.form
      setForm(prev => ({ ...prev, ...dForm }))
      if (dLogo) setLogo(dLogo)
      if (dCover) setCoverImg(dCover)
      if (Array.isArray(dMenu) && dMenu.length) setMenuItems(dMenu)
      setDraftRestored(true)
    }
  }, [])
  useEffect(() => {
    if (!saveDraftDebounced.current) {
      saveDraftDebounced.current = debounce(f => saveDraft(draftKey('submit'), f), 500)
    }
    saveDraftDebounced.current({ ...form, logo, coverImg, menuItems })
  }, [form, logo, coverImg, menuItems])

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
    try { setLogo(await uploadImage(file, 'listings/logos')) } catch (err) { console.warn('Logo upload failed:', err); showError(lang === 'mm' ? 'Logo တင်မရပါ — ပုံမပါဘဲ ဆက်တင်နိုင်ပါသည်' : 'Logo upload failed — you can continue without it') }
    setLogoUploading(false)
  }
  async function handleCoverUpload(file) {
    setCoverUploading(true)
    try { setCoverImg(await uploadImage(file, 'listings/covers')) } catch (err) { console.warn('Cover upload failed:', err); showError(lang === 'mm' ? 'Cover ပုံ တင်မရပါ — ပုံမပါဘဲ ဆက်တင်နိုင်ပါသည်' : 'Cover upload failed — you can continue without it') }
    setCoverUploading(false)
  }

  function getMyLocation() {
    if (!navigator.geolocation) { showError(lang === 'mm' ? 'GPS ရှာမရပါ — မြေပုံပေါ်မှာ ရွေးပေးပါ' : 'GPS is not available — please pick on the map'); return }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setFormField('latitude', pos.coords.latitude.toFixed(7))
        setFormField('longitude', pos.coords.longitude.toFixed(7))
        setLocationLoading(false)
      },
      () => {
        setLocationLoading(false)
        showError(lang === 'mm' ? 'GPS ရှာမရပါ — မြေပုံပေါ်မှာ ရွေးပေးပါ' : 'Could not find GPS location — please pick on the map')
      },
      // Without a timeout getCurrentPosition can spin forever.
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  async function handleQuickAddCat() {
    // Categories insert RLS is admin/mod-only — non-admins would get a
    // swallowed failure and the modal would close anyway. Gate the UI.
    if (!isAdmin && !isModerator) {
      showError(lang === 'mm' ? 'Category အသစ်ထည့်ရန် Admin/Moderator သာ ခွင့်ပြုသည်' : 'Only Admin/Moderator can add a category')
      return
    }
    if (!quickCat.name_mm.trim()) return
    setAddingCat(true)
    try {
      const { data: newCat, error } = await supabase.from('categories').insert({
        name: quickCat.name || quickCat.name_mm.trim(),
        name_mm: quickCat.name_mm.trim(),
        icon: quickCat.icon || '📦',
        type: 'directory',
        parent_id: quickCat.parent_id || null,
        sort_order: 999,
        is_active: true,
      }).select().single()
      if (error) throw error
      const { data: cats, error: catsErr } = await supabase.from('categories').select('*').eq('type', 'directory').eq('is_active', true).order('sort_order')
      // v9.25 regen #5: a resolve-with-error re-fetch wiped the
      // category picker with []. Keep the last good list on failure.
      if (!catsErr) setCategories(cats || [])
      if (newCat) setFormField('category_id', newCat.id)
      setQuickCat({ name_mm: '', name: '', icon: '📦', parent_id: '' })
      setShowQuickCat(false)
    } catch (e) {
      console.warn(e)
      showError(e?.message || (lang === 'mm' ? 'Category ထည့်မရပါ' : 'Could not add category'))
      // Keep the modal open so the user can retry — do not close on failure.
    }
    setAddingCat(false)
  }

  const openMenuForm = (item = null) => {
    if (item) {
      setEditingMenuItem(item)
      setMenuForm({ name: item.name, name_mm: item.name_mm || '', price: item.price, description: item.description, images: item.images || [] })
    } else {
      setEditingMenuItem(null)
      setMenuForm({ name: '', name_mm: '', price: '', description: '', images: [] })
    }
    setMenuFormOpen(true)
    setMenuError('')
  }
  const closeMenuForm = () => {
    setMenuFormOpen(false); setEditingMenuItem(null)
    setMenuForm({ name: '', name_mm: '', price: '', description: '', images: [] }); setMenuError('')
  }
  const handleMenuImageUpload = async (file) => {
    // M5 (v9.17): 1 image per menu item — the insert only ever saved
    // images[0], so images 2–5 were uploaded and then silently discarded.
    if (menuForm.images.length >= 1) { setMenuError(lang === 'mm' ? '၁ ပုံသာ တင်နိုင်ပါသည်' : 'Maximum 1 image'); return }
    setMenuImageLoading(true)
    try {
      const url = await uploadImage(file, 'menu')
      setMenuForm(prev => ({ ...prev, images: [...prev.images, url] }))
    } catch (err) {
      console.warn('Menu image upload failed:', err)
      setMenuError(lang === 'mm' ? 'ပုံ တင်မရပါ — ထပ်ကြိုးစားပါ' : 'Image upload failed — please try again')
    } finally {
      setMenuImageLoading(false)
    }
  }
  const removeMenuImage = (index) => setMenuForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }))
  const saveMenuItem = () => {
    if (!menuForm.name.trim()) { setMenuError(lang === 'mm' ? 'အမည် ထည့်ပါ' : 'Name required'); return }
    const newItem = {
      id: editingMenuItem?.id || Date.now().toString(),
      name: menuForm.name.trim(),
      name_mm: menuForm.name_mm.trim(),
      price: menuForm.price.trim(),
      description: menuForm.description.trim(),
      images: menuForm.images,
    }
    if (editingMenuItem) setMenuItems(prev => prev.map(i => i.id === editingMenuItem.id ? newItem : i))
    else setMenuItems(prev => [...prev, newItem])
    closeMenuForm()
  }
  const deleteMenuItem = async (id) => {
    if (await confirmDialog(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete this item?', { danger: true })) setMenuItems(prev => prev.filter(i => i.id !== id))
  }

  // Escape PostgREST .or() special characters so a name containing , ( ) %
  // cannot break the query or act as a wildcard. _ and \ must be escaped
  // too: _ is a LIKE wildcard and an unescaped \ breaks the escape itself.
  function escapePostgrestOr(value) {
    const BS = String.fromCharCode(92)
    return String(value ?? '')
      .replaceAll(BS, BS + BS)
      .replaceAll('%', BS + '%')
      .replaceAll('_', BS + '_')
      .replaceAll(',', BS + ',')
      .replaceAll('(', BS + '(')
      .replaceAll(')', BS + ')')
  }

  async function checkDuplicates() {
    const nameToCheck = form.name_mm || form.name;
    // All entered phones, canonicalised (Myanmar digits → Latin,
    // +95/0 prefix stripped) for comparison against every stored field.
    const phoneCanons = form.phones
      .map(p => (p ? normalizePhone(p) : null))
      .filter(Boolean);

    if (!nameToCheck) return false;

    try {
      // Fetch potential matches based on name OR any phone. The old check
      // only compared phone_1 and capped candidates at 10, so a duplicate
      // filed under phone_2–phone_5 (or past the cap) slipped through.
      let query = supabase.from('listings').select('id, name, name_mm, phone_1, phone_2, phone_3, phone_4, phone_5, latitude, longitude');

      let conditions = [];
      if (nameToCheck) conditions.push(`name.ilike.%${escapePostgrestOr(nameToCheck)}%`, `name_mm.ilike.%${escapePostgrestOr(nameToCheck)}%`);
      // SB1 (v9.20): the candidate fetch used RAW phone strings, while
      // stored phones are normalised (toLatinDigits at save) — a
      // +95… / Myanmar-digit spelling never fetched its own match, so the
      // canonical client-side comparison below never saw it. Query with
      // the canonical forms (already computed above) instead.
      for (const canonPhone of phoneCanons) {
        for (let i = 1; i <= 5; i++) conditions.push(`phone_${i}.eq.${escapePostgrestOr(canonPhone)}`);
      }

      if (conditions.length > 0) {
        query = query.or(conditions.join(','));
      }

      const { data, error } = await query.limit(50);
      if (error) throw error

      if (data && data.length > 0) {
        for (const match of data) {
          const matchName = (match.name_mm || match.name || '').trim().toLowerCase();
          const inputName = nameToCheck.trim().toLowerCase();

          const nameMatches = matchName === inputName || matchName.includes(inputName) || inputName.includes(matchName);
          // Compare canonical (digits-only, prefix-stripped) phones so
          // ၀၉… / +95… / 09… spellings of the same number match, across
          // all five stored phone fields.
          const matchCanons = [match.phone_1, match.phone_2, match.phone_3, match.phone_4, match.phone_5]
            .map(p => (p ? normalizePhone(p) : null))
            .filter(Boolean);
          const phoneMatches = phoneCanons.some(pc => matchCanons.includes(pc));

          // Check distance if coords exist
          let distMatches = false;
          if (form.latitude && match.latitude) {
             const latDiff = Math.abs(form.latitude - match.latitude);
             const lonDiff = Math.abs(form.longitude - match.longitude);
             // Very close (approx 100 meters)
             if (latDiff < 0.001 && lonDiff < 0.001) distMatches = true;
          }

          // Block only when name is similar AND (phone matches OR same place).
          // A shared phone alone (e.g. a building's shared number) never blocks.
          if (nameMatches && (phoneMatches || distMatches)) {
            setDupError(match);
            return true;
          }
        }
      }
    } catch (e) {
      console.warn('Duplicate check failed:', e);
      // A failed duplicate check must not block submission — the listing
      // still goes to Admin review, where a human can catch duplicates.
      showError(lang === 'mm' ? 'ထပ်နေမှု စစ်ဆေးမရပါ — Admin မှ စစ်ဆေးပေးမည်' : 'Duplicate check failed — Admin will review')
    }
    return false;
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    if ((!form.name && !form.name_mm) || !form.category_id) {
      // B2: never silently sit there — show a red inline error and scroll
      // to the missing field so the user sees what is needed.
      const msg = !form.name && !form.name_mm
        ? (lang === 'mm' ? 'လုပ်ငန်းအမည် (မြန်မာ သို့မဟုတ် English) ထည့်ပါ' : 'Please enter the business name')
        : (lang === 'mm' ? 'အမျိုးအစား ရွေးပါ' : 'Please choose a category')
      setSubmitError(msg)
      showError(msg)
      const target = (!form.name && !form.name_mm) ? nameInputRef.current : catSelectRef.current
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target?.focus({ preventScroll: true })
      return
    }
    setSubmitError('')

    // M1 (v9.17): explicit NaN guard before validation (mirror Edit) —
    // parseFloat('abc') is NaN and used to slip through as a null pin.
    const lat = form.latitude ? parseFloat(form.latitude) : null
    const lng = form.longitude ? parseFloat(form.longitude) : null
    if ((form.latitude && Number.isNaN(lat)) || (form.longitude && Number.isNaN(lng))) {
      const msg = lang === 'mm' ? 'Latitude/Longitude သည် ဂဏန်း ဖြစ်ရမည်' : 'Latitude/Longitude must be numbers'
      setSubmitError(msg)
      showError(msg)
      return
    }

    // Pre-submit validation (honest Burmese errors; Myanmar-only names pass).
    const validation = validateListing({
      name: form.name,
      name_mm: form.name_mm,
      category_id: form.category_id,
      phones: form.phones,
      website: form.website,
      latitude: lat,
      longitude: lng,
    })
    if (!validation.isValid) {
      setSubmitError(validation.errors.join(' '))
      showError(validation.errors.join(' '))
      return
    }

    // B22: skip the duplicate block once the user confirmed this is a
    // genuinely different business (same name / branch phone).
    const isDup = dupBypassRef.current ? false : await checkDuplicates();
    if (isDup) return; // တူနေရင် တင်ခွင့်မပြု

    setDupError(null);
    setSubmitting(true)
    try {
      // Normalize phones to Latin digits before saving, so stored numbers
      // are always Latin — Myanmar-digit input (၀၉…) used to be stored
      // verbatim and then broke tel:/WhatsApp links downstream.
      const phoneColumns = {}
      form.phones.forEach((phone, idx) => { if (phone) phoneColumns['phone_' + (idx + 1)] = toLatinDigits(phone) })
      const { phones, ...restData } = form
      const submittedBy = isLoggedIn && profile ? profile.id : null

      // Client-generated id: the insert must not .select() the row back
      // (guest SELECT on a pending listing is not guaranteed), but the
      // menu_items rows below need the new listing id.
      const newListingId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0')}`

      const { error } = await supabase.from('listings').insert({
        id: newListingId,
        ...restData,
        ...phoneColumns,
        viber: form.viber ? toLatinDigits(form.viber) : form.viber,
        whatsapp: form.whatsapp ? toLatinDigits(form.whatsapp) : form.whatsapp,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        logo_url: logo,
        cover_url: coverImg,
        images: [],
        menu_items: menuItems.length > 0 ? menuItems : null,
        submitted_by: submittedBy,
        // Guest insert is allowed ONLY with status 'pending' (RLS) — never 'approved'.
        status: 'pending',
        report_count: 0,
      })
      if (error) throw error
      // Menu items were only written to the listings.menu_items JSONB,
      // which nothing reads — ListingDetailPage and MenuPage read the
      // menu_items table. Insert them there too (JSONB stays as backup).
      if (menuItems.length > 0) {
        const { error: menuErr } = await supabase.from('menu_items').insert(
          menuItems.map((item, idx) => ({
            listing_id: newListingId,
            name: item.name,
            name_mm: item.name_mm || null,
            description: item.description || null,
            price: item.price ? parseFloat(item.price) : null,
            image_url: item.images?.[0] || null,
            sort_order: idx,
          }))
        )
        if (menuErr) {
          console.warn('Menu items insert failed (listing itself was saved):', menuErr)
          showError(lang === 'mm' ? 'လုပ်ငန်းတင်ပြီးပါပြီ — မီနူးတချို့ တင်မရပါ' : 'Listing saved — some menu items failed to save')
        }
      }
      setDone(true)
      // v9.17 (Issue 2): the draft is saved — clear it (and cancel any
      // pending debounced write, or it rewrites the draft a moment later).
      saveDraftDebounced.current?.cancel?.()
      clearDraft(draftKey('submit'))
      setDraftRestored(false)
    } catch (err) {
      console.error('Submit listing failed:', err)
      showError(lang === 'mm' ? 'တင်ရာတွင် အမှားဖြစ်သွားသည် — ပြန်ကြိုးစားမည်' : 'Could not submit — please check your connection and try again')
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

  // An in-flight logo/cover upload used to be ignored: the listing was
  // inserted with logo_url null and the finishing upload set state on the
  // success screen — the image was lost.
  const canSubmit = !submitting && !logoUploading && !coverUploading && (form.name_mm || form.name) && form.category_id

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
  // NICE (v9.17): the search filter must never hide the currently
  // selected category — a filtered-out selection rendered as blank.
  const selectedCategory = categories.find(c => c.id === form.category_id)
  const selectedCatVisible = !selectedCategory
    || visibleParents.some(p => p.id === selectedCategory.id)
    || filteredCategories.some(c => c.id === selectedCategory.id && visibleParents.some(p => p.id === c.parent_id))

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
          disabled={submitting}
          className={
            'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-display font-bold transition-all ' +
            (submitting
              ? 'bg-white/8 text-white/60 cursor-not-allowed'
              : 'btn-primary shadow-md shadow-brand-900/40')
          }
        >
          {submitting
            ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Check size={14} />}
          {submitting ? '' : (lang === 'mm' ? 'သိမ်းမည်' : 'Save')}
        </button>
      </div>

      {/* B2: the Save buttons are never disabled for missing fields — the
          reason is shown here instead, so the user always knows what is missing. */}
      {!canSubmit && !submitting && (
        <p className="mx-4 mt-3 text-xs text-red-400 font-myanmar">
          {lang === 'mm' ? 'အမည် နှင့် အမျိုးအစား လိုအပ်သည်' : 'Name and category are required'}
        </p>
      )}

      {!isLoggedIn && (
        <div className="mx-4 mt-4 mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-2">
          <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300 font-myanmar">
            {lang === 'mm'
              ? 'အကောင့်မဖွင့်ဘဲ လုပ်ငန်းတင်နိုင်ပါသည်။ Admin မှ စစ်ဆေးပြီးနောက် ထုတ်ဖော်မည်ဖြစ်ပါသည်။ အကောင့်ဖွင့်ပြီးတင်ပါက Points ရရှိမည်ဖြစ်သည်။'
              : 'You can submit without an account. Your listing appears only after Admin review. Registered users earn points.'}
          </p>
        </div>
      )}

      {dupError && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
          <Info size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-red-300 font-myanmar font-semibold">
              {lang === 'mm' ? 'ဤလုပ်ငန်း ရှိနှင့်ပြီးဖြစ်နိုင်သည်' : 'This listing may already exist'}
            </p>
            <p className="text-xs text-red-300/70 font-myanmar mt-0.5">
              {dupError.name_mm || dupError.name}
              {dupError.phone_1 ? ` • ${dupError.phone_1}` : ''}
            </p>
            <p className="text-[11px] text-white/60 font-myanmar mt-1">
              {lang === 'mm' ? 'အချက်အလက် မှားနေရင် ပြင်ပြီး ထပ်တင်ပါ — တူတဲ့လုပ်ငန်း ရှိပြီးသားဆို ထပ်တင်စရာ မလိုပါ' : 'If the details are wrong, correct them and resubmit — no need to submit a duplicate.'}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <button type="button" onClick={() => { dupBypassRef.current = true; setDupError(null); handleSubmit(); }} className="text-[11px] font-bold text-brand-300 underline">
                {lang === 'mm' ? 'ဒါက မတူသော လုပ်ငန်းပါ — ဆက်တင်မည်' : 'This is a different business — continue'}
              </button>
              <button type="button" onClick={() => setDupError(null)} className="text-[11px] text-red-300 underline">
                {lang === 'mm' ? 'ပိတ်မည်' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}

      <form id="submit-listing-form" onSubmit={handleSubmit} className="px-4 pt-4 space-y-4">

        {/* v9.17 (Issue 2): an unsaved draft was restored. */}
        {draftRestored && (
          <div className="rounded-xl bg-brand-600/10 border border-brand-400/25 px-3 py-2">
            <p className="text-[11px] text-brand-300 font-myanmar">မသိမ်းရသေး draft ပြန်ရသည်</p>
          </div>
        )}

        {/* Logo + Cover */}
        <p className="text-xs text-white/60 font-myanmar -mb-1">ပုံများ (optional)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-2">{t('logo_label')} (optional)</label>
            {logo ? (
              <div className="relative h-24">
                <img src={logo} alt={form.name_mm || form.name || 'Logo'} className="w-full h-full rounded-2xl object-contain bg-white/5" />
                <button type="button" onClick={() => setLogo(null)} className="absolute -top-2 -right-2 w-5 h-5 btn-danger rounded-full flex items-center justify-center text-white text-[10px]">✕</button>
              </div>
            ) : <ImageUploader onUpload={handleLogoUpload} loading={logoUploading} label={t('upload_logo')} />}
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-2">Cover ပုံ (optional)</label>
            {coverImg ? (
              <div className="relative h-24">
                <img src={coverImg} alt={form.name_mm || form.name || 'Cover'} className="w-full h-full rounded-2xl object-cover" />
                <button type="button" onClick={() => setCoverImg(null)} className="absolute -top-2 -right-2 w-5 h-5 btn-danger rounded-full flex items-center justify-center text-white text-[10px]">✕</button>
              </div>
            ) : <ImageUploader onUpload={handleCoverUpload} loading={coverUploading} label="Cover တင်ရန်" />}
          </div>
        </div>

        {/* ① အခြေခံအချက် */}
        <SectionHeader num="1" title={lang === 'mm' ? 'အခြေခံအချက်' : 'Basic Info'} subtitle={lang === 'mm' ? 'လုပ်ငန်း အမည်နှင့် အမျိုးအစား' : 'Name & category'} />

        {/* Issue 1 (v9.17): EITHER name is enough — the lone `required`
            on the Myanmar field lied (validation already enforces
            either-or). The * sits on the group, never on one language. */}
        <p className="text-xs text-white/50 mb-1.5">{t('name_mm_label')} <span className="text-red-400 ml-1">*</span> <span className="text-white/60 font-normal">({lang === 'mm' ? 'မြန်မာ သို့မဟုတ် English တစ်ခု' : 'Myanmar or English, one is enough'})</span></p>
        <Field label={t('name_mm_label')}>
          <input
            type="text"
            ref={nameInputRef}
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
        <p className="text-[10px] text-white/60 font-myanmar -mt-2">အမည် တစ်ခု (မြန်မာ သို့မဟုတ် English) ရှိရမည်</p>

        <Field label={t('category_label')} required>
          {/* Category search */}
          {categories.length > 8 && (
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={catSearch}
                onChange={e => setCatSearch(e.target.value)}
                className="input-dark pl-9 w-full"
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
              ref={catSelectRef}
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
                    {/* SB7/E9 (v9.20): the parent itself is selectable — a
                        listing can be filed directly under a parent category,
                        not only under its sub-categories. */}
                    <option key={parent.id} value={parent.id}>{parent.icon} {parent.name_mm || parent.name} (အားလုံး)</option>
                    {subs.map(sub => (
                      <option key={sub.id} value={sub.id}>  {sub.icon} {sub.name_mm || sub.name}</option>
                    ))}
                  </optgroup>
                )
              })}
              {selectedCategory && !selectedCatVisible && (
                <option key={selectedCategory.id} value={selectedCategory.id}>{selectedCategory.icon} {selectedCategory.name_mm || selectedCategory.name}</option>
              )}
              {catQuery && visibleParents.length === 0 && (
                <option value="" disabled>
                  {lang === 'mm' ? 'ရှာတွေ့မှု မရှိ' : 'No matches'}
                </option>
              )}
            </select>

            {(isAdmin || isModerator) ? (
              <button
                type="button"
                onClick={() => setShowQuickCat(true)}
                className="w-10 h-10 flex-shrink-0 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-white/50 hover:text-brand-300 hover:border-brand-400/30 transition-colors"
                title={lang === 'mm' ? 'Category အသစ်ထည့်မည်' : 'Add new category'}
              >
                <Plus size={16} />
              </button>
            ) : (
              <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-white/60 cursor-not-allowed" title={lang === 'mm' ? 'Category အသစ်ထည့်ရန် Admin/Moderator သာ ခွင့်ပြုသည်' : 'Only Admin/Moderator can add a category'}>
                <span className="text-[10px]">🔒</span>
              </div>
            )}
          </div>
          {!(isAdmin || isModerator) && (
            <p className="text-[10px] text-amber-400 mt-1 font-myanmar">
              {lang === 'mm' ? 'Category အသစ်ထည့်ချင်ပါက Admin ကို ဆက်သွယ်ပါ' : 'Contact an Admin to add a new category'}
            </p>
          )}
        </Field>

        {/* B19: business type belongs with the basic info, not Location. */}
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
                <p className="text-[9px] text-white/60 mt-0.5 leading-tight">{opt.desc}</p>
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('desc_label')} optional>
          <textarea
            value={form.description_mm}
            onChange={e => setFormField('description_mm', e.target.value)}
            className="input-dark font-myanmar resize-none h-20"
            placeholder={t('desc_placeholder')}
          />
        </Field>

        <Field label={lang === 'mm' ? 'ဖော်ပြချက် (English)' : 'Description (English)'} optional>
          <textarea
            value={form.description}
            onChange={e => setFormField('description', e.target.value)}
            className="input-dark resize-none h-20"
            placeholder="Description in English (optional)"
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
                <button type="button" onClick={() => removePhone(idx)} className="w-10 h-10 rounded-xl btn-danger flex items-center justify-center transition-colors">
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
              <label className="block text-[10px] text-white/60 mb-1">Latitude</label>
              <input type="text" value={form.latitude} onChange={e => setFormField('latitude', e.target.value)} className="input-dark" placeholder="16.xxxxxx" />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-white/60 mb-1">Longitude</label>
              <input type="text" value={form.longitude} onChange={e => setFormField('longitude', e.target.value)} className="input-dark" placeholder="97.xxxxxx" />
            </div>
          </div>
        )}

        {/* ④ ဖွင့်ချိန် */}
        <SectionHeader num="4" title={lang === 'mm' ? 'ဖွင့်ချိန်' : 'Business Hours'} subtitle={lang === 'mm' ? 'ဖွင့်/ပိတ် အချိန်' : 'Optional — open hours'} />
        <BusinessHoursEditor value={form.hours} onChange={h => setFormField('hours', h)} lang={lang} />

        {/* ⑤ မီနူး */}
        <SectionHeader num="5" title={lang === 'mm' ? 'မီနူး / ဝန်ဆောင်မှုများ (မဖြစ်မနေ မဟုတ်)' : 'Menu / Services (Optional)'} subtitle={lang === 'mm' ? 'Optional — စားသောက်ဆိုင်၊ ဆိုင်များအတွက်' : 'Optional — for shops/restaurants'} />

        <button
          type="button"
          onClick={() => openMenuForm()}
          className="w-full btn-primary py-3 flex items-center justify-center gap-2 text-sm"
        >
          <Plus size={18} /> {lang === 'mm' ? 'မီနူးအသစ်ထည့်မည်' : 'Add Menu Item'}
        </button>

        {menuItems.length === 0 ? (
          <div className="text-center py-3 text-white/60 text-xs font-myanmar">
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
                    <button type="button" onClick={() => openMenuForm(item)} aria-label="ပြင်မည်" className="p-2.5 text-white/60 hover:text-white transition-colors">✏️</button>
                    <button type="button" onClick={() => deleteMenuItem(item.id)} aria-label="ဖျက်မည်" className="p-2.5 text-red-400/70 hover:text-red-400 transition-colors">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline Submit (bottom of form) — never disabled for missing
            fields (B2): tapping it scrolls to the missing field and shows
            the red inline error above. */}
        {submitError && (
          <p className="text-xs text-red-400 font-myanmar text-center -mb-1">{submitError}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full mt-4 disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              {t('uploading')}
            </span>
          ) : t('submit_btn')}
        </button>

        <p className="text-[11px] text-white/60 text-center font-myanmar pb-2">{t('submit_notice')}</p>
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
              <input value={quickCat.name_mm}
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
          <div className="bg-[#1a0030] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-white/10">
            <div className="sticky top-0 bg-[#1a0030] p-4 border-b border-white/10 flex justify-between items-center">
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
                <label className="block text-xs text-white/50 mb-1.5 font-myanmar">
                  {lang === 'mm' ? 'အမည် (မြန်မာ)' : 'Item Name (Myanmar)'}
                </label>
                <input type="text" value={menuForm.name_mm}
                  onChange={e => setMenuForm(prev => ({ ...prev, name_mm: e.target.value }))}
                  className="input-dark w-full font-myanmar" placeholder={lang === 'mm' ? 'ဥပမာ: မုန့်တီ' : 'e.g. မုန့်တီ'} />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  {lang === 'mm' ? 'ဈေးနှုန်း (ကျပ်)' : 'Price (Ks)'}
                </label>
                <input type="number" inputMode="decimal" value={menuForm.price}
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
                  {lang === 'mm' ? 'ပုံ (၁ ပုံ)' : 'Image (1)'}  {/* M5 (v9.17): 1 image per item — images 2–5 were discarded on save */}
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
                  {menuForm.images.length < 1 && (
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
