import { useState, useEffect } from 'react'
import { Phone, Plus, Pencil, Trash2, X, Save, Clock, DollarSign } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useAppConfig } from '../contexts/AppConfigContext'
import { useSEO } from '../hooks/useSEO'

// ── Category config ───────────────────────────────────────────
const CATS = [
  { id: 'all',         mm: 'အားလုံး',     en: 'All',          icon: '🆘', color: 'text-white/60'   },
  { id: 'hospital',    mm: 'ဆေးရုံ',      en: 'Hospital',     icon: '🏥', color: 'text-red-400'    },
  { id: 'ambulance',   mm: 'ဆေးယာဉ်',    en: 'Ambulance',    icon: '🚑', color: 'text-red-400'    },
  { id: 'police',      mm: 'ရဲစခန်း',     en: 'Police',       icon: '👮', color: 'text-blue-400'   },
  { id: 'fire',        mm: 'မီးသတ်',      en: 'Fire',         icon: '🚒', color: 'text-orange-400' },
  { id: 'electricity', mm: 'လျှပ်စစ်',   en: 'Electricity',  icon: '⚡', color: 'text-amber-400'  },
  { id: 'water',       mm: 'ရေ',          en: 'Water',        icon: '💧', color: 'text-cyan-400'   },
  { id: 'rescue',      mm: 'ကယ်ဆယ်',     en: 'Rescue',       icon: '🆘', color: 'text-green-400'  },
  { id: 'other',       mm: 'အခြား',       en: 'Other',        icon: '📞', color: 'text-white/50'   },
]

const CAT_BG = {
  hospital:    'from-red-600/15 to-red-700/5   border-red-500/20',
  ambulance:   'from-red-600/15 to-red-700/5   border-red-500/20',
  police:      'from-blue-600/15 to-blue-700/5  border-blue-500/20',
  fire:        'from-orange-600/15 to-orange-700/5 border-orange-500/20',
  electricity: 'from-amber-600/15 to-amber-700/5  border-amber-500/20',
  water:       'from-cyan-600/15 to-cyan-700/5   border-cyan-500/20',
  rescue:      'from-green-600/15 to-green-700/5  border-green-500/20',
  other:       'from-white/5 to-transparent border-white/10',
  gas:         'from-amber-600/15 to-amber-700/5  border-amber-500/20',
}

// ── Contact Card ──────────────────────────────────────────────
function ContactCard({ contact, lang, isMod, onEdit, onDelete }) {
  const cat = CATS.find(c => c.id === contact.category) || CATS[CATS.length - 1]
  const bg  = CAT_BG[contact.category] || CAT_BG.other
  const phones = [contact.phone_1, contact.phone_2, contact.phone_3].filter(Boolean)

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 space-y-3 ${bg}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <span className="text-2xl flex-shrink-0 mt-0.5">{cat.icon}</span>
          <div className="min-w-0">
            <h3 className="font-display font-bold text-sm text-white leading-snug">
              {lang === 'mm' ? (contact.name_mm || contact.name) : contact.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {contact.is_24h && (
                <span className="flex items-center gap-0.5 text-[9px] text-green-400 bg-green-500/15 border border-green-500/20 px-1.5 py-0.5 rounded-full">
                  <Clock size={8} /> 24h
                </span>
              )}
              {contact.is_free && (
                <span className="flex items-center gap-0.5 text-[9px] text-amber-400 bg-amber-500/15 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                  <DollarSign size={8} /> {lang === 'mm' ? 'အခမဲ့' : 'Free'}
                </span>
              )}
              {contact.address_mm || contact.address ? (
                <span className="text-[9px] text-white/30 font-myanmar">
                  📍 {lang === 'mm' ? (contact.address_mm || contact.address) : contact.address}
                </span>
              ) : null}
            </div>
            {(contact.note_mm || contact.note) && (
              <p className="text-[10px] text-white/50 mt-1 font-myanmar">
                {lang === 'mm' ? (contact.note_mm || contact.note) : contact.note}
              </p>
            )}
          </div>
        </div>

        {/* Admin edit/delete */}
        {isMod && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => onEdit(contact)}
              className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors">
              <Pencil size={11} className="text-white/50" />
            </button>
            <button onClick={() => onDelete(contact.id)}
              className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-colors">
              <Trash2 size={11} className="text-red-400" />
            </button>
          </div>
        )}
      </div>

      {/* Phone buttons */}
      <div className="flex gap-2 flex-wrap">
        {phones.map((phone, i) => (
          <a
            key={i}
            href={`tel:${phone}`}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-display font-bold text-sm transition-all active:scale-95 ${
              i === 0
                ? 'bg-green-500 text-white shadow-lg shadow-green-900/40 flex-1 justify-center'
                : 'bg-white/10 border border-white/15 text-white/70 hover:bg-white/15'
            }`}
          >
            <Phone size={14} />
            {phone}
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Edit / Add form ───────────────────────────────────────────
const BLANK = {
  category: 'hospital', name: '', name_mm: '',
  phone_1: '', phone_2: '', phone_3: '',
  address: '', address_mm: '', note_mm: '',
  township: '', is_24h: false, is_free: false, sort_order: 0,
}

function ContactForm({ initial, onClose, onSaved, lang }) {
  const [form, setForm] = useState(initial || BLANK)
  const [saving, setSaving]   = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.name_mm && !form.name) return
    if (!form.phone_1) return
    setSaving(true)
    const payload = { ...form, updated_at: new Date().toISOString() }
    if (initial?.id) {
      await supabase.from('emergency_contacts').update(payload).eq('id', initial.id)
    } else {
      await supabase.from('emergency_contacts').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0d0015] overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/8 sticky top-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
            <X size={18} className="text-white" />
          </button>
          <h2 className="font-display font-bold text-base text-white">
            {initial?.id
              ? (lang === 'mm' ? 'ပြင်ဆင်မည်' : 'Edit Contact')
              : (lang === 'mm' ? 'ထည့်သွင်းမည်' : 'Add Contact')}
          </h2>
        </div>
        <button
          onClick={save}
          disabled={saving || (!form.name_mm && !form.name) || !form.phone_1}
          className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 disabled:opacity-50"
        >
          <Save size={13} /> {saving ? '...' : lang === 'mm' ? 'သိမ်းမည်' : 'Save'}
        </button>
      </div>

      <div className="px-4 py-4 space-y-4 pb-24">
        {/* Category */}
        <div>
          <label className="block text-xs text-white/50 mb-2">{lang === 'mm' ? 'အမျိုးအစား' : 'Category'}</label>
          <div className="flex gap-2 flex-wrap">
            {CATS.filter(c => c.id !== 'all').map(c => (
              <button key={c.id} onClick={() => set('category', c.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  form.category === c.id
                    ? 'bg-brand-600/60 border-brand-400/50 text-brand-200'
                    : 'bg-white/5 border-white/10 text-white/50'
                }`}>
                {c.icon} {lang === 'mm' ? c.mm : c.en}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'အမည် (မြန်မာ)' : 'Name (Myanmar)'} *</label>
            <input autoFocus value={form.name_mm} onChange={e => set('name_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: ပြည်သူ့ဆေးရုံ" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-white/50 mb-1.5">Name (English)</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="input-dark" placeholder="e.g. General Hospital" />
          </div>
        </div>

        {/* Phones */}
        <div className="space-y-2">
          <label className="block text-xs text-white/50">ဖုန်းနံပါတ် *</label>
          {[
            ['phone_1', 'ဖုန်း (၁) — ပင်မ *'],
            ['phone_2', 'ဖုန်း (၂) — optional'],
            ['phone_3', 'ဖုန်း (၃) — optional'],
          ].map(([k, lbl]) => (
            <div key={k}>
              <label className="block text-[10px] text-white/40 mb-1">{lbl}</label>
              <input type="tel" value={form[k]} onChange={e => set(k, e.target.value)}
                className="input-dark font-mono" placeholder="081-xxxx / 09-xxxxxxxxx" />
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'လိပ်စာ' : 'Address'}</label>
          <input value={form.address_mm} onChange={e => set('address_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: ဗိုလ်ချုပ်လမ်း" />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1.5">{lang === 'mm' ? 'မှတ်ချက်' : 'Note'}</label>
          <input value={form.note_mm} onChange={e => set('note_mm', e.target.value)} className="input-dark font-myanmar" placeholder="ဥပမာ: နေ့ပိုင်း ၈နာရီ — ညပိုင်း ၅နာရီ" />
        </div>

        <div className="flex gap-3">
          <button onClick={() => set('is_24h', !form.is_24h)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
              form.is_24h ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-white/50'
            }`}>
            <Clock size={13} /> 24 နာရီ
          </button>
          <button onClick={() => set('is_free', !form.is_free)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
              form.is_free ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/10 text-white/50'
            }`}>
            <DollarSign size={13} /> {lang === 'mm' ? 'အခမဲ့' : 'Free'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function EmergencyPage() {
  const { lang }                    = useLang()
  const { user, isModerator }       = useAuth()
  const config                      = useAppConfig()
  useSEO({ title: lang === 'mm' ? 'အရေးပေါ် ဆက်သွယ်ရေး' : 'Emergency Contacts' })

  const [contacts, setContacts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [catFilter, setCatFilter] = useState('all')
  const [editTarget, setEditTarget] = useState(null)  // null=closed, {}=new, {id}=edit
  const [showForm, setShowForm]    = useState(false)

  async function load() {
    setLoading(true)
    try {
    const { data } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    setContacts(data || [])
    } catch (e) { console.warn(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id) {
    if (!confirm(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete this contact?')) return
    await supabase.from('emergency_contacts').update({ is_active: false }).eq('id', id)
    load()
  }

  const filtered = catFilter === 'all'
    ? contacts
    : contacts.filter(c => c.category === catFilter)

  // Group by category for display
  const grouped = CATS.filter(c => c.id !== 'all').map(cat => ({
    ...cat,
    items: filtered.filter(c => c.category === cat.id),
  })).filter(g => g.items.length > 0)

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-white">
            🆘 {lang === 'mm' ? 'အရေးပေါ် ဆက်သွယ်ရေး' : 'Emergency Contacts'}
          </h1>
          <p className="text-xs text-white/40 mt-0.5 font-myanmar">
            {lang === 'mm' ? `${config.app_city || 'မြို့'} • တစ်ချက်နှိပ်ပြီး ဖုန်းခေါ်နိုင်` : 'One-tap calling'}
          </p>
        </div>
        {isModerator && (
          <button
            onClick={() => { setEditTarget(null); setShowForm(true) }}
            className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"
          >
            <Plus size={14} /> {lang === 'mm' ? 'ထည့်မည်' : 'Add'}
          </button>
        )}
      </div>

      {/* SOS banner — most critical */}
      <div className="mx-4 mb-4 p-4 rounded-2xl bg-red-500/15 border border-red-500/30">
        <p className="text-[10px] text-red-400/70 font-display uppercase tracking-wider mb-2">
          {lang === 'mm' ? '🚨 အရေးပေါ် နံပါတ်များ' : '🚨 Emergency Numbers'}
        </p>
        <div className="flex gap-2">
          {[
            { label: 'Police', number: '199', icon: '👮' },
            { label: 'Fire', number: '191', icon: '🚒' },
            { label: 'Ambulance', number: '192', icon: '🚑' },
          ].map(({ label, number, icon }) => (
            <a key={number} href={`tel:${number}`}
              className="flex-1 flex flex-col items-center py-3 rounded-xl bg-red-500/20 border border-red-500/25 hover:bg-red-500/30 active:scale-95 transition-all">
              <span className="text-xl mb-1">{icon}</span>
              <p className="font-mono font-bold text-red-300 text-sm">{number}</p>
              <p className="text-[9px] text-red-400/60">{label}</p>
            </a>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div className="px-4 mb-4">
        <div className="relative">
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="select-dark"
          >
            {CATS.map(cat => (
              <option key={cat.id} value={cat.id} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                {cat.icon} {lang === 'mm' ? cat.mm : cat.en}
              </option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      {/* Contact list grouped by category */}
      <div className="px-4 space-y-5 pb-24">
        {loading ? (
          [1,2,3].map(n => <div key={n} className="h-28 rounded-2xl shimmer" />)
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <span className="text-4xl mb-3">📞</span>
            <p className="font-display font-semibold text-white/40">
              {lang === 'mm' ? 'ဆက်သွယ်ရေး မရှိသေး' : 'No contacts yet'}
            </p>
            {isModerator && (
              <p className="text-xs text-white/25 mt-1 font-myanmar">
                {lang === 'mm' ? '"ထည့်မည်" ကို နှိပ်ပြီး ထည့်သွင်းပါ' : 'Tap "Add" to add the first contact'}
              </p>
            )}
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{group.icon}</span>
                <p className={`text-[10px] font-display font-bold uppercase tracking-wider ${group.color}`}>
                  {lang === 'mm' ? group.mm : group.en}
                </p>
                <div className="flex-1 h-px bg-white/8" />
              </div>
              <div className="space-y-3">
                {group.items.map(c => (
                  <ContactCard
                    key={c.id}
                    contact={c}
                    lang={lang}
                    isMod={isModerator}
                    onEdit={contact => { setEditTarget(contact); setShowForm(true) }}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit / Add form */}
      {showForm && (
        <ContactForm
          initial={editTarget}
          lang={lang}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
          onSaved={() => { setShowForm(false); setEditTarget(null); load() }}
        />
      )}
    </div>
  )
}