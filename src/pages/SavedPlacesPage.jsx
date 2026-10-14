import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Plus, Trash2, ExternalLink, Edit2, X, Home, Briefcase, Utensils, ShoppingBag, Heart, GraduationCap, Plane, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import LocationPicker from '../components/LocationPicker'

export const CATEGORIES = [
  { id: 'home',     icon: Home,         mm: 'အိမ်',       en: 'Home',     color: 'text-emerald-400 bg-emerald-500/15' },
  { id: 'work',     icon: Briefcase,    mm: 'အလုပ်',      en: 'Work',     color: 'text-blue-400 bg-blue-500/15' },
  { id: 'food',     icon: Utensils,     mm: 'အစားအသောက်', en: 'Food',     color: 'text-amber-400 bg-amber-500/15' },
  { id: 'shopping', icon: ShoppingBag,  mm: 'ဈေးဝယ်',     en: 'Shopping', color: 'text-pink-400 bg-pink-500/15' },
  { id: 'health',   icon: Heart,        mm: 'ကျန်းမာရေး',  en: 'Health',   color: 'text-red-400 bg-red-500/15' },
  { id: 'school',   icon: GraduationCap,mm: 'ပညာရေး',     en: 'Education',color: 'text-indigo-400 bg-indigo-500/15' },
  { id: 'travel',   icon: Plane,        mm: 'ခရီးသွား',   en: 'Travel',   color: 'text-cyan-400 bg-cyan-500/15' },
  { id: 'other',    icon: Star,         mm: 'အခြား',      en: 'Other',    color: 'text-white/60 bg-white/8' },
]

export default function SavedPlacesPage() {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useAuth()
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'သိမ်းထားသောနေရာများ' : 'Saved Places' })

  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all')

  async function load() {
    if (!user) { setLoading(false); return }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setPlaces(data || [])
    } catch (e) { console.warn(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  async function handleDelete(id) {
    if (!confirm(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?')) return
    await supabase.from('saved_places').delete().eq('id', id)
    setPlaces(prev => prev.filter(p => p.id !== id))
  }

  function openGoogleMaps(lat, lng) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank')
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70dvh] px-8 text-center">
        <MapPin size={48} className="text-brand-400 mb-4" />
        <h2 className="font-display font-bold text-xl text-white mb-2">
          {lang === 'mm' ? 'Login လိုအပ်သည်' : 'Login Required'}
        </h2>
        <p className="text-white/50 font-myanmar mb-6">
          {lang === 'mm' ? 'နေရာ သိမ်းရန် Login ဝင်ပါ' : 'Please sign in to save places'}
        </p>
        <button onClick={() => navigate('/login')} className="btn-primary">
          {lang === 'mm' ? 'Login ဝင်ရောက်မည်' : 'Sign In'}
        </button>
      </div>
    )
  }

  const filtered = filter === 'all' ? places : places.filter(p => p.category === filter)

  return (
    <div className="pb-8 min-h-[80dvh]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              📍 {lang === 'mm' ? 'သိမ်းထားသောနေရာများ' : 'Saved Places'}
            </h1>
            <p className="text-[10px] text-white/40 mt-0.5 font-myanmar">
              {lang === 'mm' ? `${places.length} ခု သိမ်းထားသည်` : `${places.length} places saved`}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"
        >
          <Plus size={14} /> {lang === 'mm' ? 'ထည့်မည်' : 'Add'}
        </button>
      </div>

      {/* Filter */}
      {places.length > 0 && (
        <div className="px-4 mb-3 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setFilter('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-brand-600/60 text-brand-200 border border-brand-400/40'
                : 'bg-white/5 text-white/50 border border-white/10'
            }`}
          >
            {lang === 'mm' ? 'အားလုံး' : 'All'} ({places.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = places.filter(p => p.category === cat.id).length
            if (count === 0) return null
            return (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === cat.id
                    ? 'bg-brand-600/60 text-brand-200 border border-brand-400/40'
                    : 'bg-white/5 text-white/50 border border-white/10'
                }`}
              >
                {lang === 'mm' ? cat.mm : cat.en} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* List */}
      <div className="px-4 space-y-2">
        {loading ? (
          [1, 2, 3].map(n => (
            <div key={n} className="h-24 rounded-2xl bg-white/4 animate-pulse" />
          ))
        ) : places.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="text-5xl mb-4">📍</span>
            <p className="font-display font-semibold text-white/40">
              {lang === 'mm' ? 'သိမ်းထားတာ မရှိသေး' : 'No saved places yet'}
            </p>
            <p className="text-xs text-white/25 mt-1 font-myanmar max-w-xs">
              {lang === 'mm'
                ? 'သွားချင်တဲ့ နေရာ၊ မှတ်ထားချင်တဲ့ နေရာတွေကို သိမ်းထားပါ'
                : 'Save locations you want to remember'}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-white/40 font-myanmar">
              {lang === 'mm' ? 'ဤ Category တွင် မရှိပါ' : 'No places in this category'}
            </p>
          </div>
        ) : (
          filtered.map(place => (
            <PlaceCard
              key={place.id}
              place={place}
              lang={lang}
              onDelete={() => handleDelete(place.id)}
              onEdit={() => { setEditing(place); setShowForm(true) }}
              onOpenMap={() => openGoogleMaps(place.latitude, place.longitude)}
            />
          ))
        )}
      </div>

      {showForm && (
        <PlaceForm
          lang={lang}
          initial={editing}
          userId={user.id}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

export function PlaceCard({ place, lang, onDelete, onEdit, onOpenMap }) {
  const cat = CATEGORIES.find(c => c.id === place.category) || CATEGORIES[7]
  const Icon = cat.icon

  return (
    <div className="card-dark rounded-2xl p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.color}`}>
        <Icon size={18} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-sm text-white truncate">
          {place.name_mm || place.name}
        </p>
        {place.address_mm && (
          <p className="text-[10px] text-white/50 mt-0.5 font-myanmar line-clamp-1">
            📍 {place.address_mm}
          </p>
        )}
        {place.note && (
          <p className="text-[10px] text-white/40 mt-0.5 font-myanmar line-clamp-1">
            💬 {place.note}
          </p>
        )}
        <p className="text-[9px] text-white/25 mt-1 font-mono">
          {parseFloat(place.latitude).toFixed(4)}, {parseFloat(place.longitude).toFixed(4)}
        </p>
      </div>

      <div className="flex flex-col gap-1 flex-shrink-0">
        <button
          onClick={onOpenMap}
          className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center hover:bg-blue-500/25"
          title={lang === 'mm' ? 'Google Maps' : 'Google Maps'}
        >
          <ExternalLink size={12} />
        </button>
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-lg bg-white/8 text-white/50 flex items-center justify-center hover:bg-white/15"
          title={lang === 'mm' ? 'ပြင်မည်' : 'Edit'}
        >
          <Edit2 size={12} />
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20"
          title={lang === 'mm' ? 'ဖျက်မည်' : 'Delete'}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

export function PlaceForm({ lang, initial, userId, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    name_mm: initial?.name_mm || '',
    category: initial?.category || 'other',
    address_mm: initial?.address_mm || '',
    note: initial?.note || '',
    latitude: initial?.latitude || '',
    longitude: initial?.longitude || '',
  })
  const [showMap, setShowMap] = useState(false)
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.name && !form.name_mm) return
    if (!form.latitude || !form.longitude) {
      alert(lang === 'mm' ? 'မြေပုံပေါ်မှ နေရာရွေးပါ' : 'Please pick a location on the map')
      return
    }
    setSaving(true)
    const payload = {
      ...form,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      user_id: userId,
      updated_at: new Date().toISOString(),
    }
    if (initial) {
      await supabase.from('saved_places').update(payload).eq('id', initial.id)
    } else {
      await supabase.from('saved_places').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0015] overflow-y-auto pt-safe">
      <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0">
        <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <X size={18} className="text-white" />
        </button>
        <h2 className="font-display font-bold text-base text-white">
          {initial
            ? (lang === 'mm' ? 'နေရာ ပြင်မည်' : 'Edit Place')
            : (lang === 'mm' ? 'နေရာ ထည့်မည်' : 'Add Place')}
        </h2>
        <button
          onClick={save}
          disabled={saving || (!form.name && !form.name_mm)}
          className="btn-primary text-xs px-4 py-2 disabled:opacity-50"
        >
          {saving ? '...' : (lang === 'mm' ? 'သိမ်း' : 'Save')}
        </button>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">
        <div>
          <label className="block text-xs text-white/50 mb-1.5">
            {lang === 'mm' ? 'နေရာအမည် (မြန်မာ)' : 'Name (Myanmar)'} *
          </label>
          <input
            autoFocus
            value={form.name_mm}
            onChange={e => set('name_mm', e.target.value)}
            className="input-dark font-myanmar"
            placeholder={lang === 'mm' ? 'ဥပမာ: အိမ်၊ ဆေးရုံ' : 'e.g. Home, Hospital'}
          />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">Name (English)</label>
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="input-dark"
            placeholder="e.g. Home, Hospital"
          />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">
            {lang === 'mm' ? 'အမျိုးအစား' : 'Category'}
          </label>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => set('category', cat.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    form.category === cat.id
                      ? 'bg-brand-600/60 border-brand-400/50 text-brand-200'
                      : 'bg-white/5 border-white/10 text-white/50'
                  }`}
                >
                  <Icon size={11} />
                  {lang === 'mm' ? cat.mm : cat.en}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">
            📍 {lang === 'mm' ? 'မြေပုံပေါ်မှ နေရာရွေးပါ' : 'Pick location on map'} *
          </label>
          {form.latitude && form.longitude ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3">
              <MapPin size={16} className="text-emerald-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-emerald-400 font-mono">
                  {parseFloat(form.latitude).toFixed(5)}, {parseFloat(form.longitude).toFixed(5)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="text-[10px] text-brand-300 hover:text-brand-200"
              >
                {lang === 'mm' ? 'ပြောင်း' : 'Change'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/15 text-white/40 text-sm hover:border-brand-400/30 hover:text-brand-300 transition-colors"
            >
              <MapPin size={14} />
              {lang === 'mm' ? 'မြေပုံပေါ်မှ ရွေးမည်' : 'Pick on Map'}
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">
            {lang === 'mm' ? 'လိပ်စာ (optional)' : 'Address (optional)'}
          </label>
          <input
            value={form.address_mm}
            onChange={e => set('address_mm', e.target.value)}
            className="input-dark font-myanmar"
            placeholder={lang === 'mm' ? 'လိပ်စာ...' : 'Address...'}
          />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">
            {lang === 'mm' ? 'မှတ်ချက် (optional)' : 'Note (optional)'}
          </label>
          <textarea
            value={form.note}
            onChange={e => set('note', e.target.value)}
            className="input-dark font-myanmar resize-none h-20"
            placeholder={lang === 'mm' ? 'ဥပမာ: ဒီနေရာမှာ ဈေးဝယ်ရတာ အဆင်ပြေတယ်' : 'e.g. Good shopping area'}
          />
        </div>
      </div>

      {showMap && (
        <LocationPicker
          onSelect={(latLng) => {
            set('latitude', latLng.lat.toFixed(7))
            set('longitude', latLng.lng.toFixed(7))
            setShowMap(false)
          }}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  )
}
