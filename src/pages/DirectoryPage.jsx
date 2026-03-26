import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, X, ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ListingCard, Skeleton, EmptyState } from '../components/UI'
import { useAppConfig } from '../contexts/AppConfigContext'
import { useLang } from '../contexts/LangContext'

export default function DirectoryPage() {
  const navigate = useNavigate()
  const config = useAppConfig()
  const { lang } = useLang()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Level 1: Categories (Top-level)
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [categoryLoading, setCategoryLoading] = useState(true)
  
  // Level 2: Subcategories
  const [subcategories, setSubcategories] = useState([])
  const [selectedSubcategory, setSelectedSubcategory] = useState(null)
  const [subcategoryLoading, setSubcategoryLoading] = useState(false)
  
  // Level 3: Listings
  const [listings, setListings] = useState([])
  const [listingsLoading, setListingsLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20
  
  // Direct listings state
  const [hasDirectListings, setHasDirectListings] = useState(false)
  const [directCount, setDirectCount] = useState(0)
  
  // Filters
  const [city, setCity] = useState(searchParams.get('city') || 'All')
  const [verifiedOnly, setVerifiedOnly] = useState(searchParams.get('verified') === 'true')
  
  // Debounced search
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '')
  const [q, setQ] = useState(searchParams.get('q') || '')
  const debounceTimer = useRef(null)

  // Debounce effect
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    
    debounceTimer.current = setTimeout(() => {
      setQ(searchInput)
    }, 500)
    
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [searchInput])
  
  const cities = ['All', ...(config.cities || [])]
  const cityLabels = {
    'All': { mm: '📍 ခပ်သိမ်း', en: 'All' },
    'Taunggyi': { mm: 'တောင်ကြီး', en: 'Taunggyi' },
    'Kalaw': { mm: 'ကလော', en: 'Kalaw' },
    'Pindaya': { mm: 'ပင်းတယ', en: 'Pindaya' },
    'Nyaungshwe': { mm: 'ညောင်ရွှေ', en: 'Nyaungshwe' },
    'Loikaw': { mm: 'လွိုင်ကော်', en: 'Loikaw' },
    'Hopong': { mm: 'ဟိုပုံး', en: 'Hopong' },
    'Aungban': { mm: 'အောင်ပန်း', en: 'Aungban' },
    'Ywangan': { mm: 'ရွာငံ', en: 'Ywangan' }
  }

  // Get total listings count for a category (including all subcategories)
  async function getCategoryTotalCount(categoryId) {
    try {
      const { data: subcats } = await supabase
        .from('categories')
        .select('id')
        .eq('parent_id', categoryId)
      
      const subcatIds = subcats?.map(s => s.id) || []
      const allCatIds = [categoryId, ...subcatIds]
      
      const { count } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .in('category_id', allCatIds)
        .eq('status', 'approved')
      
      return count || 0
    } catch (e) {
      console.warn('getCategoryTotalCount error:', e)
      return 0
    }
  }

  // Load top-level categories with counts
  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    setCategoryLoading(true)
    try {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('type', 'directory')
        .eq('is_active', true)
        .is('parent_id', null)
        .order('sort_order')
      
      const categoriesWithCount = await Promise.all(
        (data || []).map(async (cat) => {
          const totalCount = await getCategoryTotalCount(cat.id)
          return { ...cat, listing_count: totalCount }
        })
      )
      setCategories(categoriesWithCount)
    } catch (e) { 
      console.warn('loadCategories error:', e) 
    }
    setCategoryLoading(false)
  }

  // Load subcategories with counts
  async function loadSubcategories(categoryId) {
    setSubcategoryLoading(true)
    setListings([])
    setSelectedSubcategory(null)
    try {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('type', 'directory')
        .eq('is_active', true)
        .eq('parent_id', categoryId)
        .order('sort_order')
      
      const subcatsWithCount = await Promise.all(
        (data || []).map(async (sub) => {
          const { count } = await supabase
            .from('listings')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', sub.id)
            .eq('status', 'approved')
          return { ...sub, listing_count: count || 0 }
        })
      )
      setSubcategories(subcatsWithCount)
    } catch (e) { 
      console.warn('loadSubcategories error:', e) 
    }
    setSubcategoryLoading(false)
  }

  // Check for direct listings under category
  async function checkDirectListings(categoryId) {
    try {
      const { count } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', categoryId)
        .eq('status', 'approved')
      
      setDirectCount(count || 0)
      setHasDirectListings((count || 0) > 0)
    } catch (e) {
      console.warn('checkDirectListings error:', e)
      setDirectCount(0)
      setHasDirectListings(false)
    }
  }

  // Load subcategories when category is selected
  useEffect(() => {
    if (selectedCategory) {
      loadSubcategories(selectedCategory.id)
      checkDirectListings(selectedCategory.id)
    } else {
      setSubcategories([])
      setSelectedSubcategory(null)
      setListings([])
      setHasDirectListings(false)
      setDirectCount(0)
    }
  }, [selectedCategory])

  // Load listings when subcategory is selected or filters change
  useEffect(() => {
    if (selectedSubcategory) {
      loadListings()
    } else {
      setListings([])
      setTotal(0)
    }
  }, [selectedSubcategory, city, verifiedOnly, q, page])

  const loadListings = useCallback(async (reset = true) => {
    if (!selectedSubcategory) return
    setListingsLoading(true)
    const currentPage = reset ? 0 : page
    if (reset) setPage(0)

    try {
      let query = supabase
        .from('listings')
        .select('*, category:categories(name, name_mm, icon)', { count: 'exact' })
        .eq('status', 'approved')
        .eq('category_id', selectedSubcategory.id)
        .order('rating_avg', { ascending: false, nullsFirst: false })
        .order('name', { ascending: true })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)

      if (q.trim()) query = query.or(`name.ilike.%${q}%,name_mm.ilike.%${q}%,description.ilike.%${q}%`)
      if (city !== 'All') query = query.eq('city', city)
      if (verifiedOnly) query = query.eq('is_verified', true)

      const { data, count } = await query
      
      if (reset) setListings(data || [])
      else setListings(prev => [...prev, ...(data || [])])
      setTotal(count || 0)
    } catch (e) { 
      console.warn('loadListings error:', e) 
    }
    setListingsLoading(false)
  }, [selectedSubcategory, city, verifiedOnly, q, page])

  function handleCategorySelect(cat) {
    setSelectedCategory(cat)
    setSelectedSubcategory(null)
    setListings([])
    setPage(0)
  }

  function handleSubcategorySelect(sub) {
    setSelectedSubcategory(sub)
    setPage(0)
  }

  function handleDirectListings() {
    setSelectedSubcategory({
      id: selectedCategory.id,
      icon: selectedCategory.icon,
      name_mm: selectedCategory.name_mm,
      name: selectedCategory.name,
      listing_count: directCount,
      is_direct: true
    })
  }

  function goBack() {
    if (selectedSubcategory) {
      setSelectedSubcategory(null)
      setListings([])
    } else if (selectedCategory) {
      setSelectedCategory(null)
      setSubcategories([])
    }
  }

  function clearFilters() {
    setSearchInput('')
    setQ('')
    setCity('All')
    setVerifiedOnly(false)
  }

  const hasFilters = q || city !== 'All' || verifiedOnly

  // Render Category Level
  if (!selectedCategory) {
    return (
      <div className="pb-8">
        <div className="sticky top-0 z-40 bg-[#140020] border-b border-white/10">
          <div className="px-4 py-4">
            <h1 className="font-display font-bold text-lg text-white">📂 အမျိုးအစားများ</h1>
            <p className="text-xs text-white/40 font-myanmar mt-1">လုပ်ငန်းအမျိုးအစားကို ရွေးပါ</p>
          </div>
        </div>

        <div className="px-4 py-4 space-y-2 pb-24">
          {categoryLoading ? (
            [1,2,3,4,5,6].map(n => <Skeleton key={n} className="h-16 rounded-2xl" />)
          ) : categories.length === 0 ? (
            <EmptyState icon="📂" title="Category မရှိသေး" message="ပထမဆုံး Category ကို Admin မှ ထည့်ပါ" />
          ) : (
            categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat)}
                className="w-full flex items-center justify-between p-4 rounded-2xl card-dark hover:bg-white/8 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                  <span className="text-2xl flex-shrink-0">{cat.icon}</span>
                  <div className="text-left min-w-0 flex-1 overflow-hidden">
                    <p className="font-display font-semibold text-white truncate">{lang === 'mm' ? (cat.name_mm || cat.name) : cat.name}</p>
                    <p className="text-[10px] text-white/40 font-myanmar truncate">{cat.name_mm || cat.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="bg-brand-600/30 px-2 py-1 rounded-full text-xs font-bold text-brand-300 whitespace-nowrap">
                    {cat.listing_count} လုပ်ငန်း
                  </span>
                  <ChevronRight size={18} className="text-white/30 flex-shrink-0" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    )
  }

  // Render Subcategory Level
  if (selectedCategory && !selectedSubcategory) {
    return (
      <div className="pb-8">
        <div className="sticky top-0 z-40 bg-[#140020] border-b border-white/10">
          <div className="px-4 py-3">
            <button onClick={goBack} className="flex items-center gap-2 mb-2 text-white/60 hover:text-white">
              <ChevronRight size={16} className="rotate-180" />
              <span className="text-xs">နောက်သို့</span>
            </button>
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <span className="text-2xl flex-shrink-0">{selectedCategory.icon}</span>
              <h1 className="font-display font-bold text-lg text-white truncate">{lang === 'mm' ? (selectedCategory.name_mm || selectedCategory.name) : selectedCategory.name}</h1>
            </div>
            <p className="text-xs text-white/40 font-myanmar mt-1">အမျိုးအစားခွဲကို ရွေးပါ</p>
          </div>
        </div>

        <div className="px-4 py-4 space-y-2 pb-24">
          {subcategoryLoading ? (
            [1,2,3,4].map(n => <Skeleton key={n} className="h-16 rounded-2xl" />)
          ) : (
            <>
              {hasDirectListings && (
                <button
                  onClick={handleDirectListings}
                  className="w-full flex items-center justify-between p-4 rounded-2xl card-dark hover:bg-white/8 transition-colors border border-brand-500/30 bg-brand-500/5"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                    <span className="text-2xl flex-shrink-0">{selectedCategory.icon}</span>
                    <div className="text-left min-w-0 flex-1 overflow-hidden">
                      <p className="font-display font-semibold text-white truncate">အားလုံး</p>
                      <p className="text-[10px] text-white/40 font-myanmar truncate">All listings</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="bg-brand-600/30 px-2 py-1 rounded-full text-xs font-bold text-brand-300 whitespace-nowrap">
                      {directCount} လုပ်ငန်း
                    </span>
                    <ChevronRight size={18} className="text-white/30 flex-shrink-0" />
                  </div>
                </button>
              )}

              {subcategories.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => handleSubcategorySelect(sub)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl card-dark hover:bg-white/8 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                    <span className="text-2xl flex-shrink-0">{sub.icon}</span>
                    <div className="text-left min-w-0 flex-1 overflow-hidden">
                      <p className="font-display font-semibold text-white truncate">{lang === 'mm' ? (sub.name_mm || sub.name) : sub.name}</p>
                      <p className="text-[10px] text-white/40 font-myanmar truncate">{sub.name_mm || sub.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="bg-brand-600/30 px-2 py-1 rounded-full text-xs font-bold text-brand-300 whitespace-nowrap">
                      {sub.listing_count} လုပ်ငန်း
                    </span>
                    <ChevronRight size={18} className="text-white/30 flex-shrink-0" />
                  </div>
                </button>
              ))}

              {subcategories.length === 0 && !hasDirectListings && (
                <EmptyState icon="📂" title="လုပ်ငန်းမရှိသေး" message="ဤအမျိုးအစားတွင် လုပ်ငန်းမရှိသေးပါ" />
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // Render Listings Level
  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-40 bg-[#140020] border-b border-white/10 px-4 py-3 space-y-3">
        <button onClick={goBack} className="flex items-center gap-2 text-white/60 hover:text-white">
          <ChevronRight size={16} className="rotate-180" />
          <span className="text-xs">နောက်သို့</span>
        </button>

        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <span className="text-2xl flex-shrink-0">{selectedSubcategory.icon}</span>
          <h1 className="font-display font-bold text-lg text-white truncate">
            {selectedSubcategory.is_direct 
              ? (lang === 'mm' ? (selectedCategory?.name_mm || selectedCategory?.name) : selectedCategory?.name)
              : (lang === 'mm' ? (selectedSubcategory.name_mm || selectedSubcategory.name) : selectedSubcategory.name)
            }
          </h1>
        </div>

        {/* Search input with debounce */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="လုပ်ငန်းအမည် ရှာရန်..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="input-dark pl-9 pr-10 text-sm w-full"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setQ('') }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Quick filter row */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 w-full">
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
                  {lang === 'mm' ? (cityLabels[c]?.mm || c) : (cityLabels[c]?.en || c)}
                </option>
              ))}
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="flex-shrink-0 w-6 h-6 rounded-full bg-white/8 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="px-4 py-2 flex items-center justify-between flex-wrap gap-1">
        <p className="text-[11px] text-white/40">
          {listingsLoading ? 'ရှာဖွေနေသည်...' : `${total.toLocaleString()} ရလဒ်`}
        </p>
      </div>

      {/* Listings */}
      <div className="px-4 space-y-2 pb-36">
        {listingsLoading && listings.length === 0
          ? [1,2,3,4,5].map(n => <Skeleton key={n} className="h-24" />)
          : listings.length === 0
          ? <EmptyState icon="🔍" title="လုပ်ငန်း မတွေ့ပါ" message="ရှာဖွေမှုကို ပြောင်းလဲကြည့်ပါ" />
          : listings.map(l => <ListingCard key={l.id} listing={l} />)
        }

        {listings.length < total && !listingsLoading && (
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