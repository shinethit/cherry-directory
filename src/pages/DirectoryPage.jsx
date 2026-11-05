import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, X, ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { fetchCategories } from '../lib/prefetch'
import { ListingCard, Skeleton, EmptyState } from '../components/UI'
import { useAppConfig } from '../contexts/AppConfigContext'
import { useLang } from '../contexts/LangContext'
import { escapePostgrestOr } from '../hooks/useListings'

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
  const [subcategoryError, setSubcategoryError] = useState(false)
  
  // Level 3: Listings
  const [listings, setListings] = useState([])
  const [listingsLoading, setListingsLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [listingsError, setListingsError] = useState(false)
  const [categoryError, setCategoryError] = useState(false)
  // Pagination is driven ONLY by the effect below (see listings query).
  const pageRef = useRef(0)
  const lastFilterKeyRef = useRef('')
  const appliedKeyRef = useRef('')
  const LOAD_TIMEOUT_MS = 30000
  const PAGE_SIZE = 20
  
  // Direct listings state
  const [hasDirectListings, setHasDirectListings] = useState(false)
  const [directCount, setDirectCount] = useState(0)
  
  // Filters
  const [city, setCity] = useState(searchParams.get('city') || 'All')
  const [verifiedOnly, setVerifiedOnly] = useState(searchParams.get('verified') === 'true')
  // B7: user-chosen sort (rating / newest / name)
  const [sort, setSort] = useState('rating')
  // B8: collapse the search/filter rows once the user scrolls down, so
  // the sticky header stops eating ~1/3 of a phone screen.
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  
  // Debounced search
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '')
  const [q, setQ] = useState(searchParams.get('q') || '')
  const debounceTimer = useRef(null)

  // Persist search text in the URL (?q=) so Back keeps it.
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (q) next.set('q', q)
      else next.delete('q')
      return next
    }, { replace: true })
  }, [q])

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

  // Persist city/verified in the URL (?city= / ?verified=) like ?q=, so
  // Back keeps them (NICE v9.17).
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (city !== 'All') next.set('city', city)
      else next.delete('city')
      if (verifiedOnly) next.set('verified', 'true')
      else next.delete('verified')
      return next
    }, { replace: true })
  }, [city, verifiedOnly])

  // B8: collapse the listings-level header on scroll down, restore on scroll up.
  useEffect(() => {
    function onScroll() { setHeaderCollapsed(window.scrollY > 140) }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  
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

  // Descendant ids (ALL levels, not just children) of a category, from a
  // flat id/parent_id list. The old version only included 1st-level children,
  // so 3rd-level listings were missing from top-level counts.
  function collectDescendantIds(allCats, rootId) {
    const ids = [rootId]
    let frontier = [rootId]
    while (frontier.length) {
      const next = (allCats || []).filter(c => frontier.includes(c.parent_id)).map(c => c.id)
      ids.push(...next)
      frontier = next
    }
    return ids
  }

  // ── Auto-select from ?cat= (single-pass, no loops) ──
  const urlCatId = searchParams.get('cat')
  const [urlResolved, setUrlResolved] = useState(!urlCatId)  // true if no URL param
  const processedUrlRef = useRef(null)
  const categoriesLoadedRef = useRef(false)

  // Load top-level categories with counts — Issue 4c (v9.17): useQuery
  // ['categories'] (same fetcher as the prefetch runner), so the
  // category list renders from cache instantly on revisit under VPN.
  // S17: a failed count is listing_count null (not 0) — the button stays
  // enabled and the badge shows '–' instead of 'မရှိသေး'.
  const { data: categoriesData, isLoading: categoryQueryLoading, isFetching: categoryQueryFetching, isError: categoryQueryError, refetch: refetchCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  })
  useEffect(() => {
    if (categoriesData) setCategories(categoriesData)
    setCategoryLoading(categoryQueryLoading || categoryQueryFetching)
    setCategoryError(categoryQueryError)
  }, [categoriesData, categoryQueryLoading, categoryQueryFetching, categoryQueryError])

  // Track when categories are loaded
  useEffect(() => {
    if (categories.length > 0) categoriesLoadedRef.current = true
  }, [categories])

  // Single-pass: fetch target category + its listings directly
  useEffect(() => {
    if (!urlCatId) return
    if (!categoriesLoadedRef.current) return
    if (processedUrlRef.current === urlCatId) return

    processedUrlRef.current = urlCatId

    async function directNavigate() {
      try {
        // Fetch the target category with full info (30 s timeout: a
        // hung fetch used to leave the ?cat= spinner up forever).
        const { data: target } = await withTimeout(supabase
          .from('categories')
          .select('*')
          .eq('id', urlCatId)
          .single(), 30000, 'Directory direct link')

        if (!target) return

        if (target.parent_id) {
          // It's a subcategory → set parent + sub, show listings
          const parent = categories.find(c => c.id === target.parent_id)
          if (parent) setSelectedCategory(parent)
          setSelectedSubcategory(target)
          pageRef.current = 0
          setPage(0)
        } else {
          // Top-level → check if it has children
          const { count } = await withTimeout(supabase
            .from('categories')
            .select('*', { count: 'exact', head: true })
            .eq('parent_id', target.id), 30000, 'Directory direct link')

          setSelectedCategory(target)

          if ((count || 0) === 0) {
            // No children → show listings directly
            setSelectedSubcategory({
              id: target.id,
              icon: target.icon,
              name_mm: target.name_mm,
              name: target.name,
              is_direct: true,
            })
            pageRef.current = 0
            setPage(0)
          }
          // If has children, subcategory picker will show
        }
      } catch (e) {
        console.warn('Direct navigate failed:', e)
      } finally {
        setUrlResolved(true)
      }
    }

    directNavigate()
  }, [urlCatId, categories.length])

  async function loadSubcategories(categoryId) {
    setSubcategoryLoading(true)
    setSubcategoryError(false)
    // Don't clear listings if we already have a subcategory selected (direct nav)
    if (!selectedSubcategory) setListings([])
    try {
      const { data } = await withTimeout(supabase
        .from('categories')
        .select('*')
        .eq('type', 'directory')
        .eq('is_active', true)
        .eq('parent_id', categoryId)
        .order('sort_order'), 30000, 'Directory subcategories')

      // Counts include 3rd-level listings: count the subcategory AND all
      // of its descendants, not just listings filed directly under it.
      // The tree fetch is best-effort (see fetchCategories in src/lib/prefetch.js).
      const { data: allCats } = await withTimeout(supabase
        .from('categories')
        .select('id, parent_id')
        .eq('type', 'directory')
        .eq('is_active', true), 30000, 'Directory category tree').catch(() => ({ data: [] }))
      const countResults = await Promise.allSettled(
        (data || []).map(async (sub) => {
          const ids = collectDescendantIds(allCats || [], sub.id)
          const { count } = await withTimeout(supabase
            .from('listings')
            .select('*', { count: 'exact', head: true })
            .in('category_id', ids)
            .eq('status', 'approved'), 30000, 'Directory subcategory count')
          return { ...sub, listing_count: count || 0 }
        })
      )
      const subcatsWithCount = countResults.map((r, i) =>
        r.status === 'fulfilled' ? r.value : { ...(data || [])[i], listing_count: 0 }
      )
      setSubcategories(subcatsWithCount)
    } catch (e) {
      console.warn('loadSubcategories error:', e)
      setSubcategoryError(true)
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

  // Listings — Issue 4c (v9.17): useQuery ['listings','directory', ...].
  // One query per (subcategory, filters, page); the apply effect below
  // replaces on page 0 / filter change and appends on Load more.
  // A stale page (superseded by a filter change that reset page to 0)
  // is dropped by the page guard in the apply effect — the old
  // requestIdRef machinery is no longer needed.
  const filterKey = selectedSubcategory ? `${selectedSubcategory.id}|${city}|${verifiedOnly}|${q}|${sort}` : ''
  const { data: listingsData, isLoading: listingsQueryLoading, isFetching: listingsQueryFetching, isError: listingsQueryError, refetch: refetchListings } = useQuery({
    queryKey: ['listings', 'directory', selectedSubcategory?.id, city, verifiedOnly, q, sort, page],
    queryFn: async ({ queryKey: [, , subId, cityF, verifiedF, qF, sortF, pageF] }) => {
      const esc = escapePostgrestOr(qF.trim())
      let query = supabase
        .from('listings')
        .select('*, category:categories(name, name_mm, icon)', { count: 'exact' })
        .eq('status', 'approved')
        .eq('category_id', subId)

      // B7: sort chosen by the user — rating (default), newest, or name.
      if (sortF === 'newest') query = query.order('created_at', { ascending: false })
      else if (sortF === 'name') query = query.order('name', { ascending: true })
      else query = query.order('rating_avg', { ascending: false, nullsFirst: false }).order('name', { ascending: true })
      query = query.range(pageF * PAGE_SIZE, (pageF + 1) * PAGE_SIZE - 1)

      if (qF.trim()) query = query.or(`name.ilike.%${esc}%,name_mm.ilike.%${esc}%,description.ilike.%${esc}%,description_mm.ilike.%${esc}%`)
      if (cityF !== 'All') query = query.eq('city', cityF)
      if (verifiedF) query = query.eq('is_verified', true)

      // A hung query used to spin the skeletons forever with no retry.
      const { data, count, error } = await withTimeout(query, LOAD_TIMEOUT_MS, 'Directory listings')
      if (error) throw error
      return { rows: data || [], total: count || 0, page: pageF, filterKey: `${subId}|${cityF}|${verifiedF}|${qF}|${sortF}` }
    },
    enabled: !!selectedSubcategory,
  })

  // Apply query results: page 0 (or a new filter) replaces, later pages
  // append. The page guard drops a stale page fetched before a filter
  // change reset page to 0; appliedKeyRef dedupes StrictMode double-run.
  useEffect(() => {
    if (!listingsData) return
    if (listingsData.page !== page) return
    const key = listingsData.filterKey + '|p' + listingsData.page
    if (appliedKeyRef.current === key) return
    appliedKeyRef.current = key
    if (listingsData.page === 0 || lastFilterKeyRef.current !== listingsData.filterKey) {
      lastFilterKeyRef.current = listingsData.filterKey
      setListings(listingsData.rows)
    } else {
      setListings(prev => {
        const seen = new Set(prev.map(l => l.id))
        return [...prev, ...listingsData.rows.filter(l => !seen.has(l.id))]
      })
    }
    setTotal(listingsData.total)
  }, [listingsData, page])

  useEffect(() => {
    setListingsLoading(listingsQueryLoading || listingsQueryFetching)
    setListingsError(listingsQueryError)
  }, [listingsQueryLoading, listingsQueryFetching, listingsQueryError])

  // A filter change resets to page 0 — otherwise the query would fetch
  // page N of the new filter and the list would start mid-way.
  const filterKeyStateRef = useRef('')
  useEffect(() => {
    if (!selectedSubcategory) return
    if (filterKeyStateRef.current && filterKeyStateRef.current !== filterKey) {
      pageRef.current = 0
      setPage(0)
    }
    filterKeyStateRef.current = filterKey
  }, [filterKey, selectedSubcategory])

  // Clear the list when no subcategory is selected.
  useEffect(() => {
    if (!selectedSubcategory) {
      setListings([])
      setTotal(0)
      appliedKeyRef.current = ''
      lastFilterKeyRef.current = ''
    }
  }, [selectedSubcategory])


  function handleCategorySelect(cat) {
    setSelectedCategory(cat)
    setSelectedSubcategory(null)
    setListings([])
    pageRef.current = 0
    setPage(0)
    // Update URL
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('cat', cat.id)
      return next
    }, { replace: true })
  }

  function handleSubcategorySelect(sub) {
    setSelectedSubcategory(sub)
    pageRef.current = 0
    setPage(0)
    // Update URL
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('cat', sub.id)
      return next
    }, { replace: true })
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
      // Update URL to parent category
      if (selectedCategory) {
        setSearchParams(prev => {
          const next = new URLSearchParams(prev)
          next.set('cat', selectedCategory.id)
          return next
        }, { replace: true })
      }
    } else if (selectedCategory) {
      setSelectedCategory(null)
      setSubcategories([])
      setUrlResolved(false)  // reset for URL sync
      // Remove cat param
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.delete('cat')
        return next
      }, { replace: true })
      // No urlCatId now → mark resolved
      setTimeout(() => setUrlResolved(true), 0)
    } else {
      navigate('/')
    }
  }

  function clearFilters() {
    setSearchInput('')
    setQ('')
    setCity('All')
    setVerifiedOnly(false)
    setSort('rating')
  }

  const hasFilters = q || city !== 'All' || verifiedOnly || sort !== 'rating'

  // ── Wait for URL resolution ──
  // If ?cat= is present but hasn't been resolved yet, show loading
  if (urlCatId && !urlResolved) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh]">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-white/60 text-xs font-myanmar">ရှာဖွေနေသည်...</p>
        </div>
      </div>
    )
  }

  // Render Category Level
  if (!selectedCategory) {
    return (
      <div className="pb-8">
        <div className="sticky top-[var(--header-h)] z-40 bg-[#140020] border-b border-white/10">
          <div className="px-4 py-4">
            <h1 className="font-display font-bold text-lg text-white">📂 အမျိုးအစားများ</h1>
            <p className="text-xs text-white/60 font-myanmar mt-1">လုပ်ငန်းအမျိုးအစားကို ရွေးပါ</p>
          </div>
        </div>

        <div className="px-4 py-4 space-y-2 pb-24">
          {categoryLoading ? (
            [1,2,3,4,5,6].map(n => <Skeleton key={n} className="h-16 rounded-2xl" />)
          ) : categoryError ? (
            <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
              <p className="text-sm text-red-400 font-myanmar">Data တင်ရာတွင် အမှားဖြစ်သွားသည်</p>
              <button onClick={() => refetchCategories()} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button>
            </div>
          ) : categories.length === 0 ? (
            <EmptyState icon="📂" title="Category မရှိသေး" message="မရှိသေးပါ" />
          ) : (
            categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat)}
                disabled={cat.listing_count === 0}
                className={`w-full flex items-center justify-between p-4 rounded-2xl card-dark transition-colors ${cat.listing_count === 0 ? 'opacity-50' : 'hover:bg-white/8'}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                  <span className="text-2xl flex-shrink-0">{cat.icon}</span>
                  <div className="text-left min-w-0 flex-1 overflow-hidden">
                    <p className="font-display font-semibold text-white truncate">{lang === 'mm' ? (cat.name_mm || cat.name) : cat.name}</p>
                    {(lang === 'mm' ? cat.name : cat.name_mm) && (
                      <p className="text-[10px] text-white/60 font-myanmar truncate">{lang === 'mm' ? cat.name : cat.name_mm}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="bg-brand-600/30 px-2 py-1 rounded-full text-xs font-bold text-brand-300 whitespace-nowrap">
                    {/* S17 (v9.17): a failed count (null) shows '–' and the
                        button stays enabled — null is not zero. */}
                    {cat.listing_count == null ? '–' : cat.listing_count === 0 ? 'မရှိသေး' : `${cat.listing_count} လုပ်ငန်း`}
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
        <div className="sticky top-[var(--header-h)] z-40 bg-[#140020] border-b border-white/10">
          <div className="px-4 py-3">
            <button onClick={goBack} className="flex items-center gap-2 mb-2 py-2 px-2 -ml-2 text-white/60 hover:text-white">
              <ChevronRight size={16} className="rotate-180" />
              <span className="text-xs">နောက်သို့</span>
            </button>
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <span className="text-2xl flex-shrink-0">{selectedCategory.icon}</span>
              <h1 className="font-display font-bold text-lg text-white truncate">{lang === 'mm' ? (selectedCategory.name_mm || selectedCategory.name) : selectedCategory.name}</h1>
            </div>
            <p className="text-xs text-white/60 font-myanmar mt-1">အမျိုးအစားခွဲကို ရွေးပါ</p>
          </div>
        </div>

        <div className="px-4 py-4 space-y-2 pb-24">
          {subcategoryLoading ? (
            [1,2,3,4].map(n => <Skeleton key={n} className="h-16 rounded-2xl" />)
          ) : subcategoryError ? (
            <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
              <p className="text-sm text-red-400 font-myanmar">Data တင်မရသေးပါ — ပြန်ကြိုးစားမည်</p>
              <button onClick={() => loadSubcategories(selectedCategory.id)} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button>
            </div>
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
                      <p className="text-[10px] text-white/60 font-myanmar truncate">All listings</p>
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
                  disabled={sub.listing_count === 0}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl card-dark transition-colors ${sub.listing_count === 0 ? 'opacity-50' : 'hover:bg-white/8'}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                    <span className="text-2xl flex-shrink-0">{sub.icon}</span>
                    <div className="text-left min-w-0 flex-1 overflow-hidden">
                      <p className="font-display font-semibold text-white truncate">{lang === 'mm' ? (sub.name_mm || sub.name) : sub.name}</p>
                      {(lang === 'mm' ? sub.name : sub.name_mm) && (
                        <p className="text-[10px] text-white/60 font-myanmar truncate">{lang === 'mm' ? sub.name : sub.name_mm}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="bg-brand-600/30 px-2 py-1 rounded-full text-xs font-bold text-brand-300 whitespace-nowrap">
                      {sub.listing_count == null ? '–' : sub.listing_count === 0 ? 'မရှိသေး' : `${sub.listing_count} လုပ်ငန်း`}
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
      <div className="sticky top-[var(--header-h)] z-40 bg-[#140020] border-b border-white/10 px-4 py-3 space-y-3">
        <button onClick={goBack} className="flex items-center gap-2 py-2 px-2 -ml-2 text-white/60 hover:text-white">
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

        {/* B8: search + filters collapse away on scroll down, return on scroll up.
            Animated collapse (grid-rows) — the rows stay mounted so the header
            height animates instead of jumping ~110px when the rows unmount. */}
        <div
          className={`grid transition-all duration-300 ease-in-out ${headerCollapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'}`}
          style={headerCollapsed ? { marginTop: 0 } : undefined}
        >
        <div className="overflow-hidden min-h-0">
        <div className="space-y-3">
        {/* Search input with debounce */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="လုပ်ငန်းအမည် ရှာရန်..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="input-dark pl-9 pr-10 w-full"
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
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-semibold border transition-all ${
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
              className={`appearance-none pl-3 pr-7 py-2.5 rounded-full text-xs font-semibold border outline-none transition-colors cursor-pointer ${
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

          <div className="relative flex-shrink-0">
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              aria-label="စီရန်"
              className="appearance-none pl-3 pr-7 py-2.5 rounded-full text-xs font-semibold border outline-none transition-colors cursor-pointer bg-white/5 border-white/10 text-white/60"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', fontFamily: 'Pyidaungsu, DM Sans, sans-serif' }}
            >
              <option value="rating" style={{ backgroundColor: '#1a0030' }}>⭐ Rating အမြင့်</option>
              <option value="newest" style={{ backgroundColor: '#1a0030' }}>🆕 အသစ်</option>
              <option value="name" style={{ backgroundColor: '#1a0030' }}>🔤 နာမည်</option>
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} aria-label="ရှင်းမည်" title="ရှင်းမည်" className="flex-shrink-0 w-9 h-9 rounded-full bg-white/8 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
        </div>
        </div>
        </div>
      </div>

      {/* Results count */}
      <div className="px-4 py-2 flex items-center justify-between flex-wrap gap-1">
        <p className="text-[11px] text-white/60">
          {listingsLoading ? 'ရှာဖွေနေသည်...' : `${total.toLocaleString()} ရလဒ်`}
        </p>
      </div>

      {/* Listings */}
      <div className="px-4 space-y-2 pb-8">
        {listingsError && (
          <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
            <p className="text-sm text-red-400 font-myanmar">Data တင်ရာတွင် အမှားဖြစ်သွားသည်{listings.length > 0 ? ' — အဟောင်းများကို ပြထားသည်' : ''}</p>
            <button onClick={() => refetchListings()} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button>
          </div>
        )}
        {listingsLoading && listings.length === 0
          ? [1,2,3,4,5].map(n => <Skeleton key={n} className="h-24" />)
          : listings.length === 0
          ? <EmptyState icon="🔍" title="လုပ်ငန်း မတွေ့ပါ" message="ရှာဖွေမှုကို ပြောင်းလဲကြည့်ပါ" />
          : listings.map(l => <ListingCard key={l.id} listing={l} />)
        }

        {listings.length < total && !listingsLoading && (
          <button
            onClick={() => { pageRef.current += 1; setPage(pageRef.current) }}
            className="w-full btn-ghost text-sm mt-2"
          >
            ထပ်တင်ရန် ({total - listings.length} ကျန်)
          </button>
        )}
      </div>
    </div>
  )
}