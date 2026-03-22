import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ListingCard, Skeleton, EmptyState } from '../components/UI'

const CITIES = ['All', 'Taunggyi', 'Kalaw', 'Pindaya', 'Nyaungshwe', 'Loikaw']

export default function DirectoryPage() {
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

  useEffect(() => {
    supabase.from('categories').select('*').eq('type', 'directory').eq('is_active', true).order('sort_order').then(({ data }) => setCategories(data || []))
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
  const activeCat = categories.find(c => c.id === catId)

  return (
    <div className="flex flex-col min-h-full">
      {/* Search bar */}
      <div className="sticky top-[97px] z-40 px-4 py-3 space-y-3 glass border-b border-white/8">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="ဆိုင်အမည် ရှာရန်..."
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

        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${showFilters ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/60'}`}
          >
            <SlidersHorizontal size={12} /> Filters {hasFilters && '•'}
          </button>

          {/* Verified Owner filter pill */}
          <button
            onClick={() => setVerifiedOnly(v => !v)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              verifiedOnly
                ? 'border-gold-500/50 text-gold-400'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
            }`}
            style={verifiedOnly ? {
              background: 'linear-gradient(135deg, rgba(212,175,55,0.18), rgba(212,175,55,0.08))',
            } : {}}
          >
            <ShieldCheck size={12} className={verifiedOnly ? 'text-gold-400' : ''} />
            Verified Owner
          </button>

          {/* Category pills */}
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCatId(catId === cat.id ? '' : cat.id)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${catId === cat.id ? 'bg-brand-600/60 border-brand-400/50 text-brand-200' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}
            >
              {cat.icon} {cat.name_mm || cat.name}
            </button>
          ))}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="space-y-2 pt-1">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {CITIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCity(c)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors ${city === c ? 'bg-gold-500/20 border-gold-500/40 text-gold-400' : 'bg-white/5 border-white/10 text-white/50'}`}
                >
                  {c === 'All' ? '📍 ခပ်သိမ်း' : c}
                </button>
              ))}
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-brand-300 hover:text-brand-200 transition-colors">
                ✕ Filter ဖယ်ရှားရန်
              </button>
            )}
          </div>
        )}
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

      {/* Listing grid */}
      <div className="px-4 space-y-2 pb-6">
        {loading && listings.length === 0
          ? [1,2,3,4,5].map(n => <Skeleton key={n} className="h-24" />)
          : listings.length === 0
          ? <EmptyState icon="🔍" title="ဆိုင် မတွေ့ပါ" message="ရှာဖွေမှုကို ပြောင်းလဲကြည့်ပါ" />
          : listings.map(l => <ListingCard key={l.id} listing={l} />)
        }

        {/* Load more */}
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
