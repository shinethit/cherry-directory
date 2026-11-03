import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, MapPin } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { useAuditLog } from '../hooks/useAuditLog'
import { uploadImage } from '../lib/cloudinary'
import { ImageUploader } from '../components/UI'
import { useAppConfig } from '../contexts/AppConfigContext'
import { BusinessHoursEditor } from '../components/BusinessHours'
import { showError, showSuccess } from '../lib/toast'
import { validateListing } from '../lib/validation'

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

export default function EditListingPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, isAdmin, isModerator, loading: authLoading } = useAuth()
  const { lang } = useLang()
  const { log } = useAuditLog()
  const config = useAppConfig()
  useSEO({ title: 'Edit Listing' })

  const [original, setOriginal] = useState(null)
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [adminFieldSaving, setAdminFieldSaving] = useState(false)

  async function load() {
    setLoadError(false)
    setNotFound(false)
    try {
      // A hung query used to spin the spinner forever with no retry.
      let timeoutId = null
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('load timed out')), 12000)
      })
      const [{ data: listing, error: listingErr }, { data: cats }] = await Promise.race([
        Promise.all([
          supabase.from('listings').select('*, category:categories(name, name_mm, icon)').eq('id', id).single(),
          supabase.from('categories').select('*').eq('type', 'directory').order('sort_order'),
        ]),
        timeout,
      ])
      if (timeoutId) clearTimeout(timeoutId)
      // .single() reports "no rows" as error PGRST116 — that is
      // not-found, not a load failure (error screen + retry is wrong).
      if (listingErr?.code === 'PGRST116') { setNotFound(true); return }
      if (listingErr) throw listingErr
      if (!listing) { setNotFound(true); return }

        const allowed = isAdmin || isModerator || listing.owner_id === profile?.id || listing.submitted_by === profile?.id
        setCanEdit(allowed)
        setCategories(cats || [])
        setOriginal(listing)
        setForm({
          name: listing.name || '',
          name_mm: listing.name_mm || '',
          description: listing.description || '',
          description_mm: listing.description_mm || '',
          category_id: listing.category_id || '',
          business_type: listing.business_type || '',
          city: listing.city || '',
          township: listing.township || '',
          ward: listing.ward || '',
          address: listing.address || '',
          address_mm: listing.address_mm || '',
          phone_1: listing.phone_1 || '',
          phone_2: listing.phone_2 || '',
          viber: listing.viber || '',
          telegram: listing.telegram || '',
          whatsapp: listing.whatsapp || '',
          facebook: listing.facebook || '',
          website: listing.website || '',
          logo_url: listing.logo_url || '',
          cover_url: listing.cover_url || '',
          latitude: listing.latitude?.toString() || '',
          longitude: listing.longitude?.toString() || '',
          gallery: listing.images || [],   // load existing gallery images
          hours: listing.hours || null,
        })
    } catch (e) { console.warn(e); setLoadError(true) }
  }

  useEffect(() => {
    // Don't decide canEdit until the auth/profile load settles: profile
    // is null on the first run, so canEdit was false and the owner saw a
    // flash of the "no permission" screen before the profile arrived.
    if (authLoading) return
    load()
  }, [id, profile, authLoading])

  function set(key, value) { setForm(f => ({ ...f, [key]: value })) }

  // Max 5 photos per listing: logo(1) + cover(1) + gallery(max 3)
  const MAX_GALLERY = 3
  const MAX_TOTAL   = 5

  function photoCount() {
    return (form?.logo_url ? 1 : 0) + (form?.cover_url ? 1 : 0) + (form?.gallery || []).length
  }

  async function handleLogoUpload(file) {
    if (photoCount() >= MAX_TOTAL) return
    setLogoUploading(true)
    try {
      const url = await uploadImage(file, 'listings/logos')
      set('logo_url', url)
    } catch (err) {
      console.warn('Logo upload failed:', err)
      showError('Logo တင်မရပါ — ထပ်ကြိုးစားပါ')
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleCoverUpload(file) {
    if (photoCount() >= MAX_TOTAL) return
    setCoverUploading(true)
    try {
      const url = await uploadImage(file, 'listings/covers')
      set('cover_url', url)
    } catch (err) {
      console.warn('Cover upload failed:', err)
      showError('Cover ပုံ တင်မရပါ — ထပ်ကြိုးစားပါ')
    } finally {
      setCoverUploading(false)
    }
  }

  const [galleryUploading, setGalleryUploading] = useState(false)

  async function handleGalleryUpload(file) {
    if ((form?.gallery || []).length >= MAX_GALLERY || photoCount() >= MAX_TOTAL) return
    setGalleryUploading(true)
    try {
      const url = await uploadImage(file, 'listings/gallery')
      set('gallery', [...(form?.gallery || []), url])
    } catch (err) {
      console.warn('Gallery upload failed:', err)
      showError('ပုံ တင်မရပါ — ထပ်ကြိုးစားပါ')
    } finally {
      setGalleryUploading(false)
    }
  }

  function removeGalleryPhoto(idx) {
    set('gallery', (form?.gallery || []).filter((_, i) => i !== idx))
  }

  function getMyLocation() {
    if (!navigator.geolocation) { showError('GPS ရှာမရပါ — မြေပုံပေါ်မှာ ရွေးပေးပါ'); return }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(pos => {
      set('latitude', pos.coords.latitude.toFixed(7))
      set('longitude', pos.coords.longitude.toFixed(7))
      setLocationLoading(false)
    }, () => {
      setLocationLoading(false)
      showError('GPS ရှာမရပါ — မြေပုံပေါ်မှာ ရွေးပေးပါ')
    }, { timeout: 10000, maximumAge: 60000 })
  }

  async function handleSave(e) {
    if (e) e.preventDefault()
    if (!canEdit) { showError('ဤလုပ်ငန်းကို ပြင်ဆင်ခွင့် မရှိပါ'); return }
    // Myanmar-only trap: a listing with only name_mm must be saveable.
    // Require a name in EITHER language, never English alone.
    if (!form?.name?.trim() && !form?.name_mm?.trim()) {
      showError('လုပ်ငန်းအမည် (မြန်မာ သို့မဟုတ် English) တစ်ခု ထည့်ပါ')
      return
    }
    // parseFloat('abc') is NaN, and NaN JSON-serializes to null — the old
    // code silently erased the pin with no warning. Reject non-numeric
    // coordinates, then run the shared listing validation.
    const lat = form.latitude ? parseFloat(form.latitude) : null
    const lng = form.longitude ? parseFloat(form.longitude) : null
    if ((form.latitude && Number.isNaN(lat)) || (form.longitude && Number.isNaN(lng))) {
      showError('Latitude/Longitude သည် ဂဏန်း ဖြစ်ရမည်')
      return
    }
    const validation = validateListing({
      name: form.name,
      name_mm: form.name_mm,
      category_id: form.category_id,
      phone_1: form.phone_1,
      phone_2: form.phone_2,
      website: form.website,
      latitude: lat,
      longitude: lng,
    })
    if (!validation.isValid) {
      showError(validation.errors.join(' '))
      return
    }
    setSaving(true)

    const { gallery, ...formWithoutGallery } = form
    const updates = {
      ...formWithoutGallery,
      images: gallery || [],                             // save gallery as images[]
      latitude: lat,
      longitude: lng,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('listings').update(updates).eq('id', id)
    if (error) {
      console.error('Save listing failed:', error)
      showError(error.message || 'သိမ်းမရပါ — ထပ်ကြိုးစားပါ')
      setSaving(false)
      return
    }

    // Audit log with diff (best-effort — a log failure must not fake a save failure)
    try {
      await log({
        action: 'update',
        table: 'listings',
        id,
        name: form.name,
        before: original,
        after: { ...original, ...updates },
      })
    } catch (logErr) { console.warn('Audit log failed:', logErr) }

    setSaved(true)
    showSuccess('သိမ်းပြီးပါပြီ')
    setSaving(false)
    setTimeout(() => setSaved(false), 2500)
    // Refresh original snapshot
    setOriginal(prev => ({ ...prev, ...updates }))
  }

  if (loadError) return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] px-8 text-center space-y-3">
      <p className="text-sm text-red-400 font-myanmar">Data တင်ရာတွင် အမှားဖြစ်သွားသည်</p>
      <button onClick={() => load()} className="btn-primary text-sm px-5 py-2.5">ပြန်ကြိုးစားမည်</button>
      <button onClick={() => navigate('/directory')} className="btn-ghost text-sm">ပြန်သွားမည်</button>
    </div>
  )

  if (notFound) return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] px-8 text-center space-y-3">
      <p className="text-5xl">😶</p>
      <p className="text-white/60 font-myanmar">ဤလုပ်ငန်း မရှိတော့ပါ</p>
      <button onClick={() => navigate('/directory')} className="btn-primary text-sm px-5 py-2.5">Directory သို့</button>
    </div>
  )

  if (!form || authLoading) return (
    <div className="flex items-center justify-center min-h-[60dvh]">
      <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!canEdit) return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] px-8 text-center">
      <span className="text-4xl mb-4">🔒</span>
      <p className="text-white/60 font-myanmar">ဤလုပ်ငန်းကို ပြင်ဆင်ခွင့် မရှိပါ</p>
      <button onClick={() => navigate(-1)} className="btn-ghost mt-4 text-sm">ပြန်သွားမည်</button>
    </div>
  )

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 glass sticky top-[var(--header-h)] z-40 border-b border-white/8">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="font-display font-bold text-sm text-white">လုပ်ငန်းပြင်မည်</h1>
            <p className="text-[10px] text-white/40 truncate max-w-[180px]">{original?.name}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => document.getElementById('edit-listing-form')?.requestSubmit()}
          disabled={saving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-display font-semibold transition-all ${
            saved ? 'bg-green-500/20 border border-green-500/40 text-green-400' : 'btn-primary'
          }`}
        >
          {saving
            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : saved
            ? <><span>✓</span> Saved</>
            : <><Save size={14} /> Save</>
          }
        </button>
      </div>

      <form id="edit-listing-form" onSubmit={handleSave} className="px-4 space-y-5 pt-4">

        {/* Photos — max 5 total (logo + cover + gallery max 3) */}
        <div className="space-y-3">
          {/* Photo counter */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-white/50">ပုံများ</label>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
              photoCount() >= MAX_TOTAL
                ? 'bg-red-500/15 border-red-500/30 text-red-400'
                : 'bg-white/8 border-white/10 text-white/50'
            }`}>
              {photoCount()} / {MAX_TOTAL} ပုံ
            </span>
          </div>

          {/* Logo + Cover */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-white/40 mb-1.5">Logo (1 ပုံ)</label>
              {form.logo_url ? (
                <div className="relative h-24">
                  <img src={form.logo_url} alt="" className="w-full h-full rounded-2xl object-contain bg-white/5 border border-white/10" />
                  <button type="button" onClick={() => set('logo_url', '')} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px]">✕</button>
                </div>
              ) : (
                <ImageUploader onUpload={handleLogoUpload} loading={logoUploading} label={photoCount() >= MAX_TOTAL ? 'Limit ပြည့်' : 'Logo တင်မည်'} />
              )}
            </div>
            <div>
              <label className="block text-[10px] text-white/40 mb-1.5">Cover (1 ပုံ)</label>
              {form.cover_url ? (
                <div className="relative h-24">
                  <img src={form.cover_url} alt="" className="w-full h-full rounded-2xl object-cover border border-white/10" />
                  <button type="button" onClick={() => set('cover_url', '')} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px]">✕</button>
                </div>
              ) : (
                <ImageUploader onUpload={handleCoverUpload} loading={coverUploading} label={photoCount() >= MAX_TOTAL ? 'Limit ပြည့်' : 'Cover တင်မည်'} />
              )}
            </div>
          </div>

          {/* Gallery (max 3 extra) */}
          <div>
            <label className="block text-[10px] text-white/40 mb-1.5">Gallery (max {MAX_GALLERY} ပုံ)</label>
            <div className="grid grid-cols-3 gap-2">
              {(form.gallery || []).map((url, i) => (
                <div key={i} className="relative aspect-square">
                  <img src={url} alt="" className="w-full h-full rounded-xl object-cover border border-white/10" />
                  <button
                    type="button"
                    onClick={() => removeGalleryPhoto(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px]"
                  >✕</button>
                </div>
              ))}
              {(form.gallery || []).length < MAX_GALLERY && photoCount() < MAX_TOTAL && (
                <label className="aspect-square flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 hover:border-brand-400/40 cursor-pointer transition-colors">
                  <span className="text-xl text-white/20">+</span>
                  <span className="text-[9px] text-white/30 mt-0.5">ထပ်ထည့်</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleGalleryUpload(e.target.files[0]) }} />
                </label>
              )}
              {photoCount() >= MAX_TOTAL && (
                <div className="aspect-square flex items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5">
                  <p className="text-[9px] text-red-400/70 text-center px-2 font-myanmar">ပုံ limit ပြည့်ပြီ</p>
                </div>
              )}
            </div>
            <p className="text-[9px] text-white/25 mt-1.5">Logo + Cover + Gallery = အများဆုံး {MAX_TOTAL} ပုံ (Cloudinary free plan ကိုင်တွယ်ရန်)</p>
          </div>
        </div>

        {/* Basic — name in EITHER language is enough (Myanmar-only listings must save) */}
        <Field label="လုပ်ငန်းအမည် (English)">
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className="input-dark" />
        </Field>
        <Field label="လုပ်ငန်းအမည် (မြန်မာ)">
          <input type="text" value={form.name_mm} onChange={e => set('name_mm', e.target.value)} className="input-dark font-myanmar" />
        </Field>
        <p className="text-[10px] text-white/30 font-myanmar -mt-2">အမည် တစ်ခု (မြန်မာ သို့မဟုတ် English) ရှိရမည်</p>
        <Field label="အမျိုးအစား">
          <select value={form.category_id} onChange={e => set('category_id', e.target.value)} className="select-dark">
            <option value="">— ရွေးချယ်ရန် —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name_mm || c.name}</option>)}
          </select>
        </Field>
        <Field label="ဖော်ပြချက် (မြန်မာ)">
          <textarea value={form.description_mm} onChange={e => set('description_mm', e.target.value)} className="input-dark font-myanmar resize-none h-24" />
        </Field>

        {/* Admin-only: status */}
        {(isAdmin || isModerator) && (
          <div className="border border-amber-500/20 rounded-2xl p-4 space-y-3 bg-amber-500/5">
            <p className="text-xs text-amber-400 font-display font-semibold uppercase tracking-wider">Admin Controls</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select
                  value={original?.status || 'pending'}
                  disabled={adminFieldSaving}
                  onChange={async e => {
                    if (adminFieldSaving) return
                    setAdminFieldSaving(true)
                    const newStatus = e.target.value
                    const prevStatus = original?.status
                    setOriginal(p => ({ ...p, status: newStatus }))
                    const { error } = await supabase.from('listings').update({ status: newStatus }).eq('id', id)
                    if (error) {
                      console.error('Status update failed:', error)
                      showError(error.message || 'Status ပြောင်းမရပါ')
                      setOriginal(p => ({ ...p, status: prevStatus }))
                      setAdminFieldSaving(false)
                      return
                    }
                    try {
                      await log({ action: newStatus === 'approved' ? 'approve' : 'reject', table: 'listings', id, name: form.name, before: { status: prevStatus }, after: { status: newStatus } })
                    } catch (logErr) { console.warn('Audit log failed:', logErr) }
                    setAdminFieldSaving(false)
                  }}
                  className="input-dark"
                >
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                  <option value="suspended">suspended</option>
                </select>
              </Field>
              <Field label="Featured">
                <select
                  value={original?.is_featured ? 'yes' : 'no'}
                  disabled={adminFieldSaving}
                  onChange={async e => {
                    if (adminFieldSaving) return
                    setAdminFieldSaving(true)
                    const val = e.target.value === 'yes'
                    const prev = original?.is_featured
                    setOriginal(p => ({ ...p, is_featured: val }))
                    const { error } = await supabase.from('listings').update({ is_featured: val }).eq('id', id)
                    if (error) {
                      console.error('Featured update failed:', error)
                      showError(error.message || 'Featured ပြောင်းမရပါ')
                      setOriginal(p => ({ ...p, is_featured: prev }))
                    }
                    setAdminFieldSaving(false)
                  }}
                  className="input-dark"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes ⭐</option>
                </select>
              </Field>
            </div>
          </div>
        )}

        {/* Location */}
        <div className="border-t border-white/8 pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-white/40 font-display font-semibold uppercase tracking-wider">တည်နေရာ</p>
            <button type="button" onClick={getMyLocation} disabled={locationLoading} className="flex items-center gap-1.5 text-xs text-brand-300 hover:text-brand-200 transition-colors">
              <MapPin size={12} /> {locationLoading ? 'ရှာနေသည်...' : 'GPS ရယူမည်'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="မြို့">
              <select value={form.city} onChange={e => set('city', e.target.value)} className="select-dark">
                {(config.cities || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Township">
              <input type="text" value={form.township} onChange={e => set('township', e.target.value)} className="input-dark" />
            </Field>
          </div>
          <div className="mt-3 space-y-3">
            <Field label="Ward / ရပ်ကွက်">
              <input type="text" value={form.ward} onChange={e => set('ward', e.target.value)} className="input-dark font-myanmar" />
            </Field>
            <Field label="လိပ်စာ (မြန်မာ)">
              <input type="text" value={form.address_mm} onChange={e => set('address_mm', e.target.value)} className="input-dark font-myanmar" />
            </Field>
            {(form.latitude || form.longitude) && (
              <div className="flex gap-2">
                <Field label="Latitude">
                  <input type="text" value={form.latitude} onChange={e => set('latitude', e.target.value)} className="input-dark text-xs" />
                </Field>
                <Field label="Longitude">
                  <input type="text" value={form.longitude} onChange={e => set('longitude', e.target.value)} className="input-dark text-xs" />
                </Field>
              </div>
            )}
          </div>
        </div>

        {/* Contact */}
        <div className="border-t border-white/8 pt-4">
          <p className="text-xs text-white/40 mb-3 font-display font-semibold uppercase tracking-wider">ဆက်သွယ်ရေး</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="ဖုန်း (၁)"><input type="tel" value={form.phone_1} onChange={e => set('phone_1', e.target.value)} className="input-dark" placeholder="09xxxxxxxxx" /></Field>
              <Field label="ဖုန်း (၂)"><input type="tel" value={form.phone_2} onChange={e => set('phone_2', e.target.value)} className="input-dark" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Viber"><input type="tel" value={form.viber} onChange={e => set('viber', e.target.value)} className="input-dark" /></Field>
              <Field label="WhatsApp"><input type="tel" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} className="input-dark" /></Field>
            </div>
            <Field label="Telegram"><input type="text" value={form.telegram} onChange={e => set('telegram', e.target.value)} className="input-dark" placeholder="@username" /></Field>
            <Field label="Facebook"><input type="url" value={form.facebook} onChange={e => set('facebook', e.target.value)} className="input-dark" placeholder="https://facebook.com/..." /></Field>
            <Field label="Website"><input type="url" value={form.website} onChange={e => set('website', e.target.value)} className="input-dark" placeholder="https://..." /></Field>
          </div>
        </div>

        {/* Business Hours */}
        <div className="border-t border-white/8 pt-4">
          <p className="text-xs text-white/40 mb-3 font-display font-semibold uppercase tracking-wider">
            {lang === 'mm' ? 'ဖွင့်ချိန်' : 'Business Hours'}
          </p>
          <BusinessHoursEditor value={form.hours} onChange={h => set('hours', h)} lang={lang} />
        </div>

        {/* View history link */}
        <div className="border-t border-white/8 pt-4 pb-2 flex items-center justify-between">
          <p className="text-xs text-white/30 font-myanmar">ပြောင်းလဲမှုမှတ်တမ်း ကြည့်ရန်</p>
          <button type="button" onClick={() => navigate(`/admin?tab=audit&target=${id}`)} className="text-xs text-brand-300 hover:text-brand-200 transition-colors">
            Audit Log →
          </button>
        </div>

        {/* In-form submit — the header Save button calls form.requestSubmit() */}
        <button
          type="submit"
          disabled={saving}
          className={`w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-display font-semibold transition-all ${
            saved ? 'bg-green-500/20 border border-green-500/40 text-green-400' : 'btn-primary'
          }`}
        >
          {saving
            ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : saved
            ? <><span>✓</span> Saved</>
            : <><Save size={14} /> Save</>
          }
        </button>

      </form>
    </div>
  )
}