import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X, ShieldCheck, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ListingCard, Skeleton, EmptyState } from '../components/UI'
import { useAppConfig } from '../hooks/useAppConfig'
import { useLang } from '../contexts/LangContext'

export default function DirectoryPage() {
  const config = useAppConfig()
  const { lang } = useLang()
  const cities = ['All', ...(config.cities || [])]
  const [searchParams, setSearchParams] = useSearchParams()
  const [listings, setListings] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [total, setTotal] = useState(0)

  const [q, setQ] = useState(searchParams.get('q') || '')
  const [city, setCity] = useState(searchParams.get('city') || 'All')
  const [catId, setCatId] = useState(searchParams.get('cat') || '')
  const [verifiedOnly, setVerifiedOnly] = useState(searchParams.get('verified') === 'true')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  // Top-level categories only — no duplicates
  const topCategories = categories.filter(c => !c.parent_id)

  // Active category (could be sub)
  const activeCat = categories.find(c => c.id === catId)
  // Which top-level is active
  const activeTopId = activeCat?.parent_id || (activeCat && !activeCat.parent_id ? activeCat.id : null)
  // Sub-categories of active top-level
  const subCategories = activeTopId ? categories.filter(c => c.parent_id === activeTopId) : []

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .eq('type', 'directory')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setCategories(data || []))
  }, [])

  const loadListings = useCallback(async (reset = true) => {
    setLoading(true)
    const currentPage = reset ? 0 : page
    if (reset) setPage(0)

    let query = supabase
      .from('listings')
      .select('*, category:categories(name, name_mm, icon)', { count: 'exact' })
      .eq('status', 'approved')
      .order('is_verified', { ascending: false })
      .order('is_featured', { ascending: false })
      .order('rating_avg', { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)

    if (q.trim()) query = query.or(`name.ilike.%${q}%,name_mm.ilike.%${q}%,description.ilike.%${q}%`)
    if (city !== 'All') query = query.eq('city', city)
    if (catId) query = query.eq('category_id', catId)
    if (verifiedOnly) query = query.eq('is_verified', true)

    const { data, count } = await query
    if (reset) setListings(data || [])
    else setListings(prev => [...prev, ...(data || [])])
    setTotal(count || 0)
    setLoading(false)
  }, [q, city, catId, verifiedOnly, page])

  useEffect(() => { loadListings(true) }, [q, city, catId, verifiedOnly])

  function clearFilters() {
    setQ(''); setCity('All'); setCatId(''); setVerifiedOnly(false)
  }

  const hasFilters = q || city !== 'All' || catId || verifiedOnly

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky filter area */}
      <div className="sticky top-[97px] z-40 px-4 py-3 space-y-2 glass border-b border-white/8">

        {/* Search input */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="လုပ်ငန်းအမည် ရှာရန်..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="input-dark pl-9 pr-10 text-sm"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Quick filter row */}
        <div className="flex items-center gap-2">
          {/* Verified Owner */}
          <button
            onClick={() => setVerifiedOnly(v => !v)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              verifiedOnly
                ? 'border-gold-500/50 text-gold-400'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
            }`}
            style={verifiedOnly ? { background: 'linear-gradient(135deg, rgba(212,175,55,0.18), rgba(212,175,55,0.08))' } : {}}
          >
            <ShieldCheck size={12} className={verifiedOnly ? 'text-gold-400' : ''} />
            Verified
          </button>

          {/* City dropdown */}
          <div className="relative flex-shrink-0">
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              className={`appearance-none pl-3 pr-7 py-1.5 rounded-full text-xs font-semibold border outline-none transition-colors cursor-pointer ${
                city !== 'All'
                  ? 'border-gold-500/40 text-gold-400'
                  : 'bg-white/5 border-white/10 text-white/60'
              }`}
              style={{
                backgroundColor: city !== 'All' ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
                fontFamily: 'Pyidaungsu, DM Sans, sans-serif'
              }}
            >
              {cities.map(c => (
                <option key={c} value={c} style={{ backgroundColor: '#1a0030', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}>
                  {c === 'All' ? '📍 ခပ်သိမ်း' : c}
                </option>
              ))}
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          </div>

          {/* Clear all */}
          {hasFilters && (
            <button onClick={clearFilters} className="flex-shrink-0 w-6 h-6 rounded-full bg-white/8 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Category dropdown */}
        <div className="relative">
          <select
            value={catId}
            onChange={e => setCatId(e.target.value)}
            className="select-dark"
          >
            <option value="" style={{ backgroundColor: '#1a0030' }}>
              {lang === 'mm' ? '📂 အမျိုးအစားအားလုံး' : '📂 All Categories'}
            </option>
            {topCategories.map(cat => {
              const subs = categories.filter(c => c.parent_id === cat.id)
              if (subs.length === 0) {
                return <option key={cat.id} value={cat.id} style={{ backgroundColor: '#1a0030' }}>{cat.icon} {cat.name_mm || cat.name}</option>
              }
              return (
                <optgroup key={cat.id} label={`${cat.icon} ${cat.name_mm || cat.name}`} style={{ backgroundColor: '#1a0030' }}>
                  <option value={cat.id} style={{ backgroundColor: '#1a0030' }}>　 အားလုံး</option>
                  {subs.map(sub => (
                    <option key={sub.id} value={sub.id} style={{ backgroundColor: '#1a0030' }}>　 {sub.icon} {sub.name_mm || sub.name}</option>
                  ))}
                </optgroup>
              )
            })}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        </div>
      </div>

      {/* Results count */}
      <div className="px-4 py-2 flex items-center justify-between flex-wrap gap-1">
        <p className="text-[11px] text-white/40">
          {loading ? 'ရှာဖွေနေသည်...' : `${total.toLocaleString()} ရလဒ်`}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {verifiedOnly && (
            <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border border-gold-500/40 text-gold-400" style={{ background: 'rgba(212,175,55,0.12)' }}>
              <ShieldCheck size={9} /> Verified Only
            </span>
          )}
          {activeCat && (
            <span className="badge bg-brand-700/60 text-brand-200">{activeCat?.icon} {activeCat?.name_mm || activeCat?.name}</span>
          )}
        </div>
      </div>

      {/* Listings */}
      <div className="px-4 space-y-2 pb-6">
        {loading && listings.length === 0
          ? [1,2,3,4,5].map(n => <Skeleton key={n} className="h-24" />)
          : listings.length === 0
          ? <EmptyState icon="🔍" title="လုပ်ငန်း မတွေ့ပါ" message="ရှာဖွေမှုကို ပြောင်းလဲကြည့်ပါ" />
          : listings.map(l => <ListingCard key={l.id} listing={l} />)
        }

        {listings.length < total && !loading && (
          <button
            onClick={() => { setPage(p => p + 1); loadListings(false) }}
            className="w-full btn-ghost text-sm mt-2"
          >
            ထပ်တင်ရန် ({total - listings.length} ကျန်)
          </button>
        )}
      </div>
    </div>
  )
}
