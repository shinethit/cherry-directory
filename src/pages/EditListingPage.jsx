import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, MapPin, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { useAuditLog } from '../hooks/useAuditLog'
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

export default function EditListingPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, isAdmin, isModerator } = useAuth()
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

  useEffect(() => {
    async function load() {
      const [{ data: listing }, { data: cats }] = await Promise.all([
        supabase.from('listings').select('*, category:categories(name, name_mm, icon)').eq('id', id).single(),
        supabase.from('categories').select('*').eq('type', 'directory').order('sort_order'),
      ])
      if (!listing) { navigate('/directory'); return }

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
      })
    }
    load()
  }, [id, profile])

  function set(key, value) { setForm(f => ({ ...f, [key]: value })) }

  // Max 5 photos per listing: logo(1) + cover(1) + gallery(max 3)
  const MAX_GALLERY = 3
  const MAX_TOTAL   = 5

  function photoCount() {
    return (form.logo_url ? 1 : 0) + (form.cover_url ? 1 : 0) + (form.gallery || []).length
  }

  async function handleLogoUpload(file) {
    if (photoCount() >= MAX_TOTAL) return
    setLogoUploading(true)
    const url = await uploadImage(file, 'listings/logos')
    set('logo_url', url)
    setLogoUploading(false)
  }

  async function handleCoverUpload(file) {
    if (photoCount() >= MAX_TOTAL) return
    setCoverUploading(true)
    const url = await uploadImage(file, 'listings/covers')
    set('cover_url', url)
    setCoverUploading(false)
  }

  const [galleryUploading, setGalleryUploading] = useState(false)

  async function handleGalleryUpload(file) {
    if ((form.gallery || []).length >= MAX_GALLERY || photoCount() >= MAX_TOTAL) return
    setGalleryUploading(true)
    const url = await uploadImage(file, 'listings/gallery')
    set('gallery', [...(form.gallery || []), url])
    setGalleryUploading(false)
  }

  function removeGalleryPhoto(idx) {
    set('gallery', (form.gallery || []).filter((_, i) => i !== idx))
  }

  function getMyLocation() {
    if (!navigator.geolocation) return
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(pos => {
      set('latitude', pos.coords.latitude.toFixed(7))
      set('longitude', pos.coords.longitude.toFixed(7))
      setLocationLoading(false)
    }, () => setLocationLoading(false))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!canEdit || !form.name) return
    setSaving(true)

    const { gallery, ...formWithoutGallery } = form
    const updates = {
      ...formWithoutGallery,
      images: gallery || [],                             // save gallery as images[]
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      updated_at: new Date().toISOString(),
    }

    await supabase.from('listings').update(updates).eq('id', id)

    // Audit log with diff
    await log({
      action: 'update',
      table: 'listings',
      id,
      name: form.name,
      before: original,
      after: { ...original, ...updates },
    })

    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2500)
    // Refresh original snapshot
    setOriginal(prev => ({ ...prev, ...updates }))
  }

  if (!form) return (
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
      <div className="flex items-center justify-between px-4 py-3 glass sticky top-[97px] z-40 border-b border-white/8">
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
          onClick={handleSave}
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

      <form onSubmit={handleSave} className="px-4 space-y-5 pt-4">

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

        {/* Basic */}
        <Field label="လုပ်ငန်းအမည် (English)" required>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className="input-dark" required />
        </Field>
        <Field label="လုပ်ငန်းအမည် (မြန်မာ)">
          <input type="text" value={form.name_mm} onChange={e => set('name_mm', e.target.value)} className="input-dark font-myanmar" />
        </Field>
        <Field label="အမျိုးအစား">
          <select value={form.category_id} onChange={e => set('category_id', e.target.value)} className="input-dark">
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
                  onChange={async e => {
                    const newStatus = e.target.value
                    await supabase.from('listings').update({ status: newStatus }).eq('id', id)
                    await log({ action: newStatus === 'approved' ? 'approve' : 'reject', table: 'listings', id, name: form.name, before: { status: original?.status }, after: { status: newStatus } })
                    setOriginal(p => ({ ...p, status: newStatus }))
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
                  onChange={async e => {
                    const val = e.target.value === 'yes'
                    await supabase.from('listings').update({ is_featured: val }).eq('id', id)
                    setOriginal(p => ({ ...p, is_featured: val }))
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
              <select value={form.city} onChange={e => set('city', e.target.value)} className="input-dark">
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

        {/* View history link */}
        <div className="border-t border-white/8 pt-4 pb-2 flex items-center justify-between">
          <p className="text-xs text-white/30 font-myanmar">ပြောင်းလဲမှုမှတ်တမ်း ကြည့်ရန်</p>
          <button type="button" onClick={() => navigate(`/admin?tab=audit&target=${id}`)} className="text-xs text-brand-300 hover:text-brand-200 transition-colors">
            Audit Log →
          </button>
        </div>

      </form>
    </div>
  )
}
