import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Edit3, Eye, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { supabase } from '../lib/supabase'
import { useSEO } from '../hooks/useSEO'
import { EmptyState } from '../components/UI'
import { getOptimizedUrl } from '../lib/cloudinary'
import { confirmDialog } from '../lib/confirmDialog'

const STATUS_META = {
  pending:   { label_mm: 'စစ်ဆေးဆဲ',   label_en: 'Pending',   icon: Clock,        cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  approved:  { label_mm: 'အတည်ပြုပြီး', label_en: 'Approved',  icon: CheckCircle,  cls: 'bg-green-500/15 text-green-400 border-green-500/30' },
  rejected:  { label_mm: 'ငြင်းပယ်ပြီး', label_en: 'Rejected',  icon: XCircle,      cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  suspended: { label_mm: 'ရပ်ဆိုင်းထား', label_en: 'Suspended', icon: AlertCircle,  cls: 'bg-white/10 text-white/50 border-white/15' },
}

export default function MySubmissionsPage() {
  const navigate = useNavigate()
  const { user, isLoggedIn, profile } = useAuth()
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'ကျွန်တော့်တင်ထားသောများ' : 'My Submissions' })

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('listings')
        .select('id, name, name_mm, status, cover_url, logo_url, is_verified, is_featured, view_count, rating_avg, rating_count, category:categories(icon, name, name_mm), created_at, updated_at')
        .eq('submitted_by', user.id)
        .order('created_at', { ascending: false })
      setItems(data || [])
    } catch (e) { console.warn(e) }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    if (!(await confirmDialog(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete this listing?'))) return
    const { error } = await supabase.from('listings').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(i => i.id !== id))
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70dvh] px-8 text-center">
        <Plus size={48} className="text-brand-400 mb-4" />
        <h2 className="font-display font-bold text-xl text-white mb-2">
          {lang === 'mm' ? 'Login လိုအပ်သည်' : 'Login Required'}
        </h2>
        <p className="text-white/50 font-myanmar mb-6">
          {lang === 'mm' ? 'သင့်တင်ထားသောလုပ်ငန်းများ ကြည့်ရန် Login ဝင်ပါ' : 'Sign in to see your submissions'}
        </p>
        <button onClick={() => navigate('/login')} className="btn-primary">
          {lang === 'mm' ? 'Login ဝင်ရောက်မည်' : 'Sign In'}
        </button>
      </div>
    )
  }

  const counts = {
    all: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    approved: items.filter(i => i.status === 'approved').length,
    rejected: items.filter(i => i.status === 'rejected').length,
  }

  const filtered = tab === 'all' ? items : items.filter(i => i.status === tab)

  const TABS = [
    { id: 'all',      label_mm: 'အားလုံး',    label_en: 'All',      n: counts.all },
    { id: 'pending',  label_mm: 'စစ်ဆေးဆဲ',   label_en: 'Pending',  n: counts.pending },
    { id: 'approved', label_mm: 'အတည်ပြုပြီး', label_en: 'Approved', n: counts.approved },
    { id: 'rejected', label_mm: 'ငြင်းပယ်',   label_en: 'Rejected', n: counts.rejected },
  ]

  return (
    <div className="pb-8 min-h-[80dvh]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              📝 {lang === 'mm' ? 'ကျွန်တော့်တင်ထားသောများ' : 'My Submissions'}
            </h1>
            <p className="text-[10px] text-white/40 mt-0.5 font-myanmar">
              {lang === 'mm' ? items.length + ' ခု တင်ထားသည်' : items.length + ' submissions'}
            </p>
          </div>
        </div>
        <button onClick={() => navigate('/submit')} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0">
          <Plus size={14} /> {lang === 'mm' ? 'ထည့်မည်' : 'New'}
        </button>
      </div>

      {/* Tabs */}
      {items.length > 0 && (
        <div className="flex gap-2 px-4 mb-3 overflow-x-auto scrollbar-hide pb-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ' + (
                tab === t.id
                  ? 'bg-brand-600/60 text-brand-200 border border-brand-400/40'
                  : 'bg-white/5 text-white/50 border border-white/10'
              )}
            >
              {lang === 'mm' ? t.label_mm : t.label_en}
              {t.n > 0 && <span className="bg-white/20 px-1.5 rounded-full">{t.n}</span>}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="px-4 space-y-2">
        {loading ? (
          [1, 2, 3].map(n => <div key={n} className="h-24 rounded-2xl bg-white/4 animate-pulse" />)
        ) : items.length === 0 ? (
          <EmptyState
            icon="📝"
            title={lang === 'mm' ? 'တင်ထားတာ မရှိသေး' : 'No submissions yet'}
            message={lang === 'mm' ? 'Directory မှာ လုပ်ငန်းစတင်တင်ပါ' : 'Start by submitting a business to the directory'}
          />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-white/40 font-myanmar text-sm">
              {lang === 'mm' ? 'ဤ status တွင် မရှိပါ' : 'Nothing in this status'}
            </p>
          </div>
        ) : (
          filtered.map(item => {
            const meta = STATUS_META[item.status] || STATUS_META.pending
            const Icon = meta.icon
            const img = item.cover_url || item.logo_url
            const displayName = lang === 'mm' ? (item.name_mm || item.name) : item.name
            return (
              <div key={item.id} className="card-dark rounded-2xl overflow-hidden">
                <div className="flex gap-3 p-3">
                  {/* Thumb */}
                  <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {img ? (
                      <img src={getOptimizedUrl(img, { width: 120 })} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-2xl">{item.category?.icon || '🏢'}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p className="text-sm font-semibold text-white truncate font-myanmar flex-1">
                        {displayName}
                      </p>
                      {item.is_featured && <span className="text-[10px] text-gold-400 flex-shrink-0">⭐</span>}
                      {item.is_verified && <span className="text-[10px] text-gold-400 flex-shrink-0">✓</span>}
                    </div>
                    <p className="text-[10px] text-white/40 mt-0.5 truncate font-myanmar">
                      {item.category?.icon} {lang === 'mm' ? (item.category?.name_mm || item.category?.name) : item.category?.name}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ' + meta.cls}>
                        <Icon size={10} /> {lang === 'mm' ? meta.label_mm : meta.label_en}
                      </span>
                      {item.view_count > 0 && (
                        <span className="text-[10px] text-white/40">👁 {item.view_count}</span>
                      )}
                      {item.rating_count > 0 && (
                        <span className="text-[10px] text-amber-400">★ {Number(item.rating_avg).toFixed(1)} ({item.rating_count})</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-white/8 flex">
                  <button
                    onClick={() => navigate('/directory/' + item.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-white/60 hover:bg-white/5 transition-colors"
                  >
                    <Eye size={12} /> {lang === 'mm' ? 'ကြည့်' : 'View'}
                  </button>
                  <div className="w-px bg-white/8" />
                  <button
                    onClick={() => navigate('/directory/' + item.id + '/edit')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-brand-300 hover:bg-brand-600/10 transition-colors"
                  >
                    <Edit3 size={12} /> {lang === 'mm' ? 'ပြင်' : 'Edit'}
                  </button>
                  <div className="w-px bg-white/8" />
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={12} /> {lang === 'mm' ? 'ဖျက်' : 'Delete'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
