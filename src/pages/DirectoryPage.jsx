import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Search, X, ShieldCheck, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { fetchCategories } from '../lib/prefetch'
import { ListingCard, Skeleton, EmptyState } from '../components/UI'
import { useBookmarkedSet } from '../hooks/useBookmarksDB'
import { collectDescendantIds, resolveListingCategoryIds } from '../lib/categoryTree'
import { useAppConfig } from '../contexts/AppConfigContext'
import { useLang } from '../contexts/LangContext'
import { buildOrFilter } from '../lib/myanmarSearch'
import LoadRing from '../components/LoadRing'
// v9.35: the list ring is the shared LoadRing (also used by the Home
// Hero top-5 strip) — kept re-exported under its old name so existing
// imports keep working.
export { LoadRing as DirectoryLoadRing }

// v9.30: group the LOADED listings by town for the Directory page.
// Grouping is over the loaded rows only — NOT the whole DB: a town's
// count is its loaded-row count, and a town appears only once its rows
// are loaded (load-more appends rows into their town's group). Order:
// most loaded rows first; Taunggyi first on a tie; then town name A-Z,
// so the order is deterministic. Rows with no city fall under 'Other'.
// Within a group the query's sort order (rating / newest / name) is kept.
export function groupListingsByCity(rows) {
  const byCity = new Map()
  for (const l of rows || []) {
    const key = l.city || 'Other'
    if (!byCity.has(key)) byCity.set(key, [])
    byCity.get(key).push(l)
  }
  return [...byCity.entries()]
    .map(([city, items]) => ({ city, items }))
    .sort((a, b) => {
      if (b.items.length !== a.items.length) return b.items.length - a.items.length
      if (a.city === 'Taunggyi') return -1
      if (b.city === 'Taunggyi') return 1
      return a.city.localeCompare(b.city)
    })
}

export default function DirectoryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
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
  // UI4 (v9.20): one batched bookmark query for the whole list instead
  // of one per card.
  const { data: bookmarkedSet } = useBookmarkedSet(listings.map(l => l.id))
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [listingsError, setListingsError] = useState(false)
  // v9.35: a background page (page > 0) failed — the loaded rows stay
  // and the retry affordance shows; the sentinel must not auto-advance
  // past the failed page (it would re-fire the same failing fetch in
  // a loop). Cleared on a successful page apply, on retry, and on any
  // filter change. Page-0 failures keep the existing full error card
  // (listings.length === 0) and never set this.
  const [pageFailed, setPageFailed] = useState(false)
  // v9.35: IntersectionObserver sentinel for auto background loading
  // (no tap). One page in flight at a time — the observer only
  // advances when nothing is fetching.
  const sentinelRef = useRef(null)
  const [categoryError, setCategoryError] = useState(false)
  // Pagination is driven ONLY by the effect below (see listings query).
  const pageRef = useRef(0)
  const lastFilterKeyRef = useRef('')
  // v9.31 (B): dedupe by DATA IDENTITY, not by filterKey+page. A
  // background refetch delivers a NEW listingsData object for the SAME
  // key (e.g. a stale cached {rows: [], total: 0} entry followed by a
  // fresh 173-row refetch) — the old key guard dropped that refetch
  // and the page stayed at "0 ရလဒ်". A new object always applies.
  const appliedDataRef = useRef(null)
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

  
  const cities = ['All', ...(config.cities || [])]
  const cityLabels = {
    'All': { mm: '📍 အားလုံး', en: 'All' },
    'Taunggyi': { mm: 'တောင်ကြီး', en: 'Taunggyi' },
    'Kalaw': { mm: 'ကလော', en: 'Kalaw' },
    'Pindaya': { mm: 'ပင်းတယ', en: 'Pindaya' },
    'Nyaungshwe': { mm: 'ညောင်ရွှေ', en: 'Nyaungshwe' },
    'Loikaw': { mm: 'လွိုင်ကော်', en: 'Loikaw' },
    'Hopong': { mm: 'ဟိုပုံး', en: 'Hopong' },
    'Aungban': { mm: 'အောင်ပန်း', en: 'Aungban' },
    'Ywangan': { mm: 'ရွာငံ', en: 'Ywangan' },
    'Other': { mm: 'အခြား', en: 'Other' }
  }

  // ── Auto-select from ?cat= (single-pass, no loops) ──
  const urlCatId = searchParams.get('cat')
  // H1 (v9.20): Home's Featured "အားလုံး" links to /directory?featured=true,
  // but DirectoryPage never read `featured` — the link landed on the
  // unfiltered category list. A featured visit synthesises a
  // pseudo-subcategory (below) so the listings level renders; the query
  // branches to is_featured instead of category_id.
  const featuredOnly = searchParams.get('featured') === 'true'
  const FEATURED_PSEUDO_ID = '__featured__'
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
    // v9.25 regen #2: skeletons only on the FIRST load (no cached data
    // yet). isFetching alone must not re-show them — every background
    // refetch used to flash skeletons over the cached categories.
    setCategoryLoading(categoryQueryLoading && !categoriesData)
    setCategoryError(categoryQueryError)
    // D1 (v9.20): a failed categories query used to leave a ?cat= deep
    // link on the infinite spinner forever — categoriesLoadedRef never
    // became true, so directNavigate never ran and the gate never cleared.
    // Clear the gate on failure so the error + Retry state renders.
    if (categoryQueryError) setUrlResolved(true)
  }, [categoriesData, categoryQueryLoading, categoryQueryFetching, categoryQueryError])

  // Track when categories are loaded
  useEffect(() => {
    if (categories.length > 0) categoriesLoadedRef.current = true
  }, [categories])

  // Single-pass: fetch target category + its listings directly
  useEffect(() => {
    if (!urlCatId) return
    // v9.25 regen #2: the gate also passes when the ['categories']
    // query-cache entry exists (persisted cache) even if the local
    // categories state has not been populated yet — offline, the
    // directNavigate cache-first path below can then resolve ?cat=
    // without any network.
    // v9.25 regen #4: the ['category-map'] entry passes the gate too
    // — it alone is enough for directNavigate's map-first path.
    if (!categoriesLoadedRef.current && !(queryClient.getQueryData(['categories']) || []).length && !(queryClient.getQueryData(['category-map']) || []).length) return
    if (processedUrlRef.current === urlCatId) return

    processedUrlRef.current = urlCatId

    async function directNavigate() {
      try {
        // v9.25 regen #2: resolve ?cat= from the cached ['categories']
        // entry first — offline the direct fetch below can never run,
        // so the deep link used to sit on the spinner forever and the
        // cached listings were never read. Only fetch on a cache miss
        // (e.g. a subcategory id — the cache holds top-level only).
        const cachedCats = queryClient.getQueryData(['categories']) || []
        // v9.25 regen #4: resolve ?cat= from the cached
        // ['category-map'] entry FIRST. The ['categories'] cache holds
        // top-level rows only, so a subcategory id is a cache miss
        // there by construction and the fetch path below needs the
        // network to learn target.parent_id — offline it never
        // resolves. The map holds the FULL table's id/parent_id
        // (written by fetchCategories' tree fetch, warmed alongside
        // ['categories']), so a subcategory id resolves offline to
        // parent + subcategory and its cached listings render. Never
        // guess from a missing map entry: on a map miss, fall through
        // to the existing cache-first / fetch paths below.
        const mapRows = queryClient.getQueryData(['category-map']) || []
        const mapTarget = mapRows.find(c => String(c.id) === String(urlCatId))
        if (mapTarget) {
          if (mapTarget.parent_id) {
            const parent = mapRows.find(c => c.id === mapTarget.parent_id)
              || cachedCats.find(c => c.id === mapTarget.parent_id)
              || categories.find(c => c.id === mapTarget.parent_id)
            if (parent) {
              setSelectedCategory(parent)
              setSelectedSubcategory(mapTarget)
              pageRef.current = 0
              setPage(0)
              return
            }
            // Parent in no cached source — fall through to the fetch
            // path, which can fetch it directly (healthy network).
          } else {
            // Top-level: children come from the map, so the picker
            // renders offline too — no network head-count to decide
            // direct vs picker (counts unknown offline: null → '–').
            const children = mapRows
              .filter(c => c.parent_id === mapTarget.id)
              .map(c => ({ ...c, listing_count: null }))
            setSelectedCategory(mapTarget)
            if (children.length === 0) {
              // No children → show listings directly
              setSelectedSubcategory({
                id: mapTarget.id,
                icon: mapTarget.icon,
                name_mm: mapTarget.name_mm,
                name: mapTarget.name,
                is_direct: true,
              })
              pageRef.current = 0
              setPage(0)
            } else {
              setSubcategories(children)
            }
            return
          }
        }

        const cachedTarget = cachedCats.find(c => String(c.id) === String(urlCatId))
        if (cachedTarget) {
          if (cachedTarget.parent_id) {
            // It's a subcategory → set parent + sub, show listings
            const parent = cachedCats.find(c => c.id === cachedTarget.parent_id)
              || categories.find(c => c.id === cachedTarget.parent_id)
            // v9.25 regen #3: never set a subcategory without its
            // parent — without setSelectedCategory the page renders
            // the top-level picker and the reset effect then wipes
            // the subcategory, stranding the deep link. No parent
            // here means the cache is partial; leave the link
            // unresolved so the top-level picker renders instead.
            if (!parent) return
            setSelectedCategory(parent)
            setSelectedSubcategory(cachedTarget)
            pageRef.current = 0
            setPage(0)
          } else {
            // Top-level → count children with a real query.
            // v9.25 regen #3: the ['categories'] cache holds
            // top-level rows ONLY (fetchCategories filters
            // parent_id null), so counting children in it was
            // ALWAYS 0 and every top-level ?cat= jumped to
            // direct listings with the parent id (0 rows). Same
            // head-count query as the fetch path below.
            let childCount = null
            try {
              const { count, error: countError } = await withTimeout(supabase
                .from('categories')
                .select('*', { count: 'exact', head: true })
                .eq('parent_id', cachedTarget.id), 30000, 'Directory direct link')
              // v9.25 regen #5: supabase-js resolves with { error }
              // on a dead connection — count null must stay "unknown"
              // (subcategory picker), never become 0 (direct jump to
              // the parent's own empty listings).
              if (countError) throw countError
              childCount = count || 0
            } catch (e) {
              // Offline / slow: count unknown — show the
              // subcategory picker and let loadSubcategories try
              // (it has its own error state). Never guess "no
              // children": that renders the parent's own (empty)
              // direct listings as 0 results.
              console.warn('Direct navigate child count failed:', e)
            }
            setSelectedCategory(cachedTarget)
            if (childCount === 0) {
              // No children → show listings directly
              setSelectedSubcategory({
                id: cachedTarget.id,
                icon: cachedTarget.icon,
                name_mm: cachedTarget.name_mm,
                name: cachedTarget.name,
                is_direct: true,
              })
              pageRef.current = 0
              setPage(0)
            }
            // If it has children (or the count is unknown), the
            // subcategory picker will show
          }
          return
        }

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
          // v9.25 regen #3: resolve the parent from the cached
          // ['categories'] entry — the populated source the gate
          // above already verified — NOT the local `categories`
          // state, whose closure is still empty when the gate
          // fires on a warm cache. The old state-only lookup
          // skipped setSelectedCategory, and the reset effect
          // then wiped the subcategory: stranded picker. Fall
          // back to a direct parent fetch if neither source has
          // it; without a parent, leave the link unresolved
          // (top-level picker) rather than strand it.
          let parent = cachedCats.find(c => c.id === target.parent_id)
            || categories.find(c => c.id === target.parent_id)
          if (!parent) {
            const { data: parentRow } = await withTimeout(supabase
              .from('categories')
              .select('*')
              .eq('id', target.parent_id)
              .single(), 30000, 'Directory direct link')
            parent = parentRow
          }
          if (!parent) return
          setSelectedCategory(parent)
          setSelectedSubcategory(target)
          pageRef.current = 0
          setPage(0)
        } else {
          // Top-level → check if it has children
          const { count, error: countError } = await withTimeout(supabase
            .from('categories')
            .select('*', { count: 'exact', head: true })
            .eq('parent_id', target.id), 30000, 'Directory direct link')

          setSelectedCategory(target)

          // v9.25 regen #5: on a count error (supabase-js resolves
          // with { error } on a dead connection), show the subcategory
          // picker — the count is unknown, so never guess "no
          // children" and jump to the parent's own (empty) direct
          // listings. loadSubcategories has its own error state.
          if (!countError && (count || 0) === 0) {
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

  // H1: featured view — synthesise a pseudo-subcategory so the listings
  // level renders without a category. Cleared when the param goes away.
  useEffect(() => {
    if (featuredOnly && !urlCatId && !selectedSubcategory) {
      setSelectedSubcategory({ id: FEATURED_PSEUDO_ID, icon: '⭐', name: 'Featured', name_mm: 'Featured လုပ်ငန်းများ', is_featured_view: true })
    } else if (!featuredOnly && selectedSubcategory?.id === FEATURED_PSEUDO_ID) {
      setSelectedSubcategory(null)
    }
  }, [featuredOnly, urlCatId, selectedSubcategory])

  async function loadSubcategories(categoryId) {
    setSubcategoryLoading(true)
    setSubcategoryError(false)
    // Don't clear listings if we already have a subcategory selected (direct nav)
    if (!selectedSubcategory) setListings([])
    try {
      const { data, error } = await withTimeout(supabase
        .from('categories')
        .select('*')
        .eq('type', 'directory')
        .eq('is_active', true)
        .eq('parent_id', categoryId)
        .order('sort_order'), 30000, 'Directory subcategories')
      // v9.25 regen #5: supabase-js RESOLVES with { data: null,
      // error } on a dead connection instead of throwing — without
      // this check the success path below ran with data null and
      // setSubcategories([]) wiped the map-seeded children.
      if (error) throw error

      // Counts include 3rd-level listings: count the subcategory AND all
      // of its descendants, not just listings filed directly under it.
      // The tree fetch is best-effort (see fetchCategories in src/lib/prefetch.js).
      const { data: allCats, error: treeError } = await withTimeout(supabase
        .from('categories')
        .select('id, parent_id')
        .eq('type', 'directory')
        .eq('is_active', true), 30000, 'Directory category tree').catch(() => ({ data: [] }))
      // v9.25 regen #5: a resolve-with-error tree fetch yields null
      // data, not a rejection — treat it as the empty best-effort
      // tree the .catch above already yields on a throw.
      const treeCats = treeError ? [] : (allCats || [])
      // v9.32: cache the tree fetch (id/parent_id only) under its own
      // key so the listings query can derive descendant ids from the
      // SAME tree the badge counts above were computed from — even
      // before fetchCategories' ['category-map'] arrives. Never write
      // these minimal rows to ['category-map']: they would strip the
      // name_mm/icon directNavigate's map-first path renders.
      if (treeCats.length) queryClient.setQueryData(['category-tree'], treeCats)
      const countResults = await Promise.allSettled(
        (data || []).map(async (sub) => {
          const ids = collectDescendantIds(treeCats, sub.id)
          const { count, error: countError } = await withTimeout(supabase
            .from('listings')
            .select('*', { count: 'exact', head: true })
            .in('category_id', ids)
            .eq('status', 'approved'), 30000, 'Directory subcategory count')
          // v9.25 regen #5: a resolve-with-error count must fail this
          // settled entry (listing_count null, button stays enabled)
          // exactly like a rejection does — count null must not
          // become 0, which would disable the button on good data.
          if (countError) throw countError
          return { ...sub, listing_count: count || 0 }
        })
      )
      const subcatsWithCount = countResults.map((r, i) =>
        r.status === 'fulfilled' ? r.value : { ...(data || [])[i], listing_count: null }
      )
      // v9.34: per-count failures were swallowed by allSettled into
      // listing_count null WITHOUT setting the error flag, so the
      // retry strip never appeared for a first-entry count failure
      // (setSubcategoryError(true) only ran when the subcategory LIST
      // fetch failed). When every count failed, surface the retry UI.
      if ((data || []).length > 0 && countResults.every(r => r.status === 'rejected')) {
        setSubcategoryError(true)
      }
      setSubcategories(subcatsWithCount)
    } catch (e) {
      console.warn('loadSubcategories error:', e)
      // v9.25 regen #4: offline, seed the picker from the cached
      // ['category-map'] (full id/parent_id table, warmed alongside
      // ['categories']) instead of leaving it empty — a warm cache
      // still shows the children (counts unknown, null → '–'), with
      // the amber strip below from subcategoryError. A genuinely
      // empty category has no map children either, so nothing is
      // hallucinated. Tap navigation hits this too, not just ?cat=.
      const mapRows = queryClient.getQueryData(['category-map']) || []
      const mapKids = mapRows.filter(c => c.parent_id === categoryId)
      if (mapKids.length) setSubcategories(mapKids.map(c => ({ ...c, listing_count: null })))
      setSubcategoryError(true)
    }
    setSubcategoryLoading(false)
  }

  // Check for direct listings under category (D3: wrapped in withTimeout —
  // a hung count used to leave the direct-listings button state unknown).
  async function checkDirectListings(categoryId) {
    try {
      const { count } = await withTimeout(supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', categoryId)
        .eq('status', 'approved'), 30000, 'Directory direct listings')
      
      setDirectCount(count || 0)
      setHasDirectListings((count || 0) > 0)
    } catch (e) {
      console.warn('checkDirectListings error:', e)
      setDirectCount(0)
      setHasDirectListings(false)
    }
  }

  // Load subcategories when category is selected
  // v9.21 (Bug B): the else-branch used to wipe the featured
  // pseudo-subcategory in the same commit the H1 effect set it — last
  // write won, the pseudo never stuck, and the listings query stayed
  // disabled (enabled: !!selectedSubcategory). Guard the wipe to the
  // non-featured view; featuredOnly in deps re-runs the cleanup when
  // the param is removed (goBack deletes it) so leaving the featured
  // view still clears the pseudo.
  // v9.34 (Bug 2): reload whenever the PICKER is shown, not only when
  // the category changes. Back (in-app goBack, or browser/device Back
  // via the ?cat= change) clears selectedSubcategory while keeping
  // the SAME selectedCategory object, so the old [selectedCategory,
  // featuredOnly] deps never re-ran — and directNavigate's map-first
  // branch had just overwritten the good counts with listing_count
  // null, stranding the picker on '–' with no retry. Adding
  // selectedSubcategory re-runs the load on every return to the
  // picker; the !selectedSubcategory guard keeps it a no-op while a
  // subcategory's listings (or a direct link) are showing.
  useEffect(() => {
    if (selectedCategory) {
      if (!selectedSubcategory) {
        loadSubcategories(selectedCategory.id)
        checkDirectListings(selectedCategory.id)
      }
    } else if (!featuredOnly) {
      // v9.25 regen #2: while a ?cat= deep link is still resolving,
      // directNavigate (same commit, cache-first) may have just set
      // the category + subcategory — this reset's
      // setSelectedSubcategory(null) used to clobber it and strand
      // the page on the subcategory picker. Skip the reset until the
      // link resolves; by then the state is either set (this effect
      // re-runs on selectedCategory) or still empty (nothing to reset).
      if (urlCatId && !urlResolved) return
      setSubcategories([])
      setSelectedSubcategory(null)
      setListings([])
      setHasDirectListings(false)
      setDirectCount(0)
    }
  }, [selectedCategory, selectedSubcategory, featuredOnly])

  // v9.32: subscribe to both tree sources WITHOUT fetching (enabled:
  // false — the observers exist only so this component re-renders when
  // fetchCategories writes ['category-map'] or loadSubcategories
  // writes ['category-tree']). The descendant ids below are derived
  // from these and baked into the listings query key, so a tree that
  // arrives after the subcategory was tapped changes the key and the
  // query refetches with the full id set — the badge and the list can
  // never strand apart.
  const { data: categoryMap } = useQuery({ queryKey: ['category-map'], queryFn: () => queryClient.getQueryData(['category-map']) ?? [], enabled: false })
  const { data: categoryTree } = useQuery({ queryKey: ['category-tree'], queryFn: () => queryClient.getQueryData(['category-tree']) ?? [], enabled: false })

  // v9.32: ids for the listings query — subcategory + all descendants
  // (what the picker badge counts); [subId] alone for the direct
  // ("အားလုံး") pseudo-subcategory and the featured pseudo-subcategory.
  // The joined string is part of the query key (see below).
  const listingCategoryIds = useMemo(() => {
    const sub = selectedSubcategory
    if (!sub) return []
    return resolveListingCategoryIds({
      subId: sub.id,
      isDirect: !!sub.is_direct,
      isFeatured: !!sub.is_featured_view || (featuredOnly && sub.id === FEATURED_PSEUDO_ID),
      mapRows: categoryMap ?? [],
      treeRows: categoryTree ?? [],
    })
  }, [selectedSubcategory, categoryMap, categoryTree, featuredOnly])
  const listingCategoryIdsKey = listingCategoryIds.join(',')

  // Listings — Issue 4c (v9.17): useQuery ['listings','directory', ...].
  // One query per (subcategory, filters, page); the apply effect below
  // replaces on page 0 / filter change and appends on Load more.
  // A stale page (superseded by a filter change that reset page to 0)
  // is dropped by the page guard in the apply effect — the old
  // requestIdRef machinery is no longer needed.
  const filterKey = selectedSubcategory ? `${selectedSubcategory.id}|${listingCategoryIdsKey}|${city}|${verifiedOnly}|${q}|${sort}` : ''
  const { data: listingsData, isLoading: listingsQueryLoading, isFetching: listingsQueryFetching, isError: listingsQueryError, refetch: refetchListings } = useQuery({
    queryKey: ['listings', 'directory', selectedSubcategory?.id, listingCategoryIdsKey, city, verifiedOnly, q, sort, page, featuredOnly],
    queryFn: async ({ queryKey: [, , subId, idsKey, cityF, verifiedF, qF, sortF, pageF, featuredF], signal }) => {
      let query = supabase
        .from('listings')
        .select('*, category:categories(name, name_mm, icon)', { count: 'exact' })
        .eq('status', 'approved')
      // H1: the featured pseudo-subcategory filters is_featured, not a category.
      if (featuredF && subId === FEATURED_PSEUDO_ID) query = query.eq('is_featured', true)
      else query = query.in('category_id', idsKey ? idsKey.split(',') : [subId])

      // B7: sort chosen by the user — rating (default), newest, or name.
      if (sortF === 'newest') query = query.order('created_at', { ascending: false })
      else if (sortF === 'name') query = query.order('name', { ascending: true })
      else query = query.order('rating_avg', { ascending: false, nullsFirst: false }).order('name', { ascending: true })
      query = query.range(pageF * PAGE_SIZE, (pageF + 1) * PAGE_SIZE - 1)

      // v9.20: the ?q= filter also searches each Myanmar word in its
      // alternate encoding (Zawgyi <-> Unicode) — stored names are mixed
      // encoding, and ilike is byte-exact (see myanmarSearch.js).
      // Per-word OR groups (one .or() per word, ANDed by PostgREST) —
      // the same semantics as SearchPage; the whole-phrase single term
      // used to require an exact-phrase match for multi-word queries.
      if (qF.trim()) {
        for (const word of qF.trim().split(/\s+/)) {
          query = query.or(buildOrFilter(['name', 'name_mm', 'description', 'description_mm'], [word]))
        }
      }
      if (cityF !== 'All') query = query.eq('city', cityF)
      if (verifiedF) query = query.eq('is_verified', true)

      // v9.35: abort the in-flight fetch when the filter/sort/category
      // changes (React Query hands the new key's signal here) — the old
      // page's late response must never land on the new filter's list.
      // The apply effect's page guard below is the second line of
      // defence for a response that already resolved.
      query = query.abortSignal(signal)

      // A hung query used to spin the skeletons forever with no retry.
      const { data, count, error } = await withTimeout(query, LOAD_TIMEOUT_MS, 'Directory listings')
      if (error) throw error
      return { rows: data || [], total: count || 0, page: pageF, filterKey: `${subId}|${idsKey}|${cityF}|${verifiedF}|${qF}|${sortF}` }
    },
    enabled: !!selectedSubcategory,
    // v9.31 (B): a FRESH (<5 min) cached 0 entry would otherwise be
    // shown with no refetch attempt at all. refetchOnMount: 'always'
    // alone does NOT do it here: this observer subscribes on first
    // render while the query is still disabled, so tapping a
    // subcategory takes the disabled->enabled path
    // (shouldFetchOptionally in query-core), which ignores
    // refetchOnMount and only fetches when the entry is stale.
    // staleTime: 0 makes every cached entry stale, so the tap always
    // revalidates; the cached rows still render instantly meanwhile
    // (keepPreviousData + the listings state below) with the stale
    // pill while the refetch is in flight.
    refetchOnMount: 'always',
    staleTime: 0,
    // v9.25 regen #2: changing filter/page keeps the previous list
    // visible while the new page fetches, instead of emptying it.
    placeholderData: keepPreviousData,
  })

  // Apply query results: page 0 (or a new filter) replaces, later pages
  // append. The page guard drops a stale page fetched before a filter
  // change reset page to 0; appliedDataRef dedupes the same object
  // (main.jsx renders no <StrictMode>, so there is no double-run to
  // guard against — the old key guard only dropped real refetches).
  useEffect(() => {
    if (!listingsData) return
    if (listingsData.page !== page) return
    if (appliedDataRef.current === listingsData) return
    appliedDataRef.current = listingsData
    // v9.35: a page landed — any earlier background-page failure is
    // over (the retry worked, or the sentinel moved on), so the amber
    // strip + retry button go away.
    setPageFailed(false)
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
  // v9.35: the reset also clears the old rows + total (so the ring
  // restarts from the new filter's counts instead of showing the old
  // filter's numbers), drops any failed-page state, and forgets the
  // applied data object so the new page 0 always applies.
  const filterKeyStateRef = useRef('')
  useEffect(() => {
    if (!selectedSubcategory) return
    if (filterKeyStateRef.current && filterKeyStateRef.current !== filterKey) {
      pageRef.current = 0
      setPage(0)
      setListings([])
      setTotal(0)
      setPageFailed(false)
      appliedDataRef.current = null
      lastFilterKeyRef.current = ''
    }
    filterKeyStateRef.current = filterKey
  }, [filterKey, selectedSubcategory])

  // v9.35: a background page (page > 0) failed while rows are already
  // on screen — mark it failed (amber strip + retry) instead of
  // letting the full error card replace the list. Page-0 failures
  // (no rows yet) keep the existing card and never set this.
  useEffect(() => {
    if (listingsQueryError && page > 0 && listings.length > 0) setPageFailed(true)
  }, [listingsQueryError, page, listings.length])

  // v9.35: AUTO background loading — no tap. An IntersectionObserver
  // watches a sentinel just past the last card; a generous 800px
  // rootMargin prefetches the next page BEFORE the user reaches the
  // bottom, so the list grows by itself as they scroll. Sequential
  // only: one page in flight at a time (guarded by
  // listingsQueryFetching), never a parallel page storm, and never a
  // fetch-all — only the next page is requested, so a 2,186-row
  // "အားလုံး" list still fetches page 0 only until the user scrolls.
  // The pageRef guard stops a double-fire in the same tick (the
  // observer can fire again before setPage re-renders): advance only
  // when pageRef still equals the rendered page. A failed page blocks
  // auto-advance until the user retries — the sentinel never loops
  // on a failing fetch.
  const hasMore = total > 0 && listings.length < total
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !selectedSubcategory) return
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(e => e.isIntersecting)) return
      if (!hasMore || pageFailed || listingsQueryError || listingsQueryFetching) return
      if (pageRef.current !== page) return
      pageRef.current += 1
      setPage(pageRef.current)
    }, { rootMargin: '800px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, pageFailed, listingsQueryError, listingsQueryFetching, page, selectedSubcategory])

  // Clear the list when no subcategory is selected.
  useEffect(() => {
    if (!selectedSubcategory) {
      setListings([])
      setTotal(0)
      setPageFailed(false)
      appliedDataRef.current = null
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
    // v9.31 (B): reset the page like handleSubcategorySelect does —
    // tapping "အားလုံး" after a Load more must start at page 0.
    pageRef.current = 0
    setPage(0)
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
    // H1: in the featured view there is no category to go back to — drop
    // the param so the next render shows the category list.
    if (featuredOnly && !selectedCategory) {
      setSelectedSubcategory(null)
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.delete('featured')
        return next
      }, { replace: true })
      return
    }
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

  // Render Category Level (skipped for the H1 featured view, which goes
  // straight to the listings level via the pseudo-subcategory)
  if (!selectedCategory && !featuredOnly) {
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
          ) : categoryError && categories.length === 0 ? (
            <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
              <p className="text-sm text-red-400 font-myanmar">Data တင်ရာတွင် အမှားဖြစ်သွားသည်</p>
              <button onClick={() => refetchCategories()} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button>
            </div>
          ) : categories.length === 0 ? (
            <EmptyState icon="📂" title="Category မရှိသေး" message="မရှိသေးပါ" />
          ) : (
            <>
              {/* v9.25 regen #2: a failed background refetch must not
                  replace cached categories with the error card — show
                  the small amber strip above the old list instead. */}
              {categoryError && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-amber-300 font-myanmar">အဟောင်းပြထားသည် — အင်တာနက် နှေးနေသည်</p>
                  <button onClick={() => refetchCategories()} className="text-xs text-amber-200 underline font-myanmar flex-shrink-0">ပြန်ကြိုးစားမည်</button>
                </div>
              )}
              {categories.map(cat => (
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
              ))}
            </>
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
          ) : subcategoryError && subcategories.length === 0 && !hasDirectListings ? (
            <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
              <p className="text-sm text-red-400 font-myanmar">Data တင်မရသေးပါ — ပြန်ကြိုးစားမည်</p>
              <button onClick={() => loadSubcategories(selectedCategory.id)} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button>
            </div>
          ) : (
            <>
              {/* v9.25 regen #2: a failed reload must not replace cached
                  subcategories with the error card — amber strip above
                  the old list, same pattern as the categories level. */}
              {subcategoryError && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-amber-300 font-myanmar">အဟောင်းပြထားသည် — အင်တာနက် နှေးနေသည်</p>
                  <button onClick={() => loadSubcategories(selectedCategory.id)} className="text-xs text-amber-200 underline font-myanmar flex-shrink-0">ပြန်ကြိုးစားမည်</button>
                </div>
              )}
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
          <span className="text-2xl flex-shrink-0">{selectedSubcategory?.icon || '⭐'}</span>
          <h1 className="font-display font-bold text-lg text-white truncate">
            {selectedSubcategory?.is_direct
              ? (lang === 'mm' ? (selectedCategory?.name_mm || selectedCategory?.name) : selectedCategory?.name)
              : (lang === 'mm' ? (selectedSubcategory?.name_mm || selectedSubcategory?.name || 'Featured လုပ်ငန်းများ') : (selectedSubcategory?.name || 'Featured'))
            }
          </h1>
        </div>

        {/* v9.25: search + filters stay pinned — the old B8 collapse
            hid them once scrolled past 140px and flickered on iPhone:
            the bar appeared and disappeared while scrolling.
            No hide/show any more. */}
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
        <div className="flex flex-wrap items-center gap-2 pb-1 w-full">
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

      {/* v9.36: circular load progress ring, directly under the sticky
          header at the top of the list area. Real counts only
          (loaded rows / query total); it stays visible permanently —
          at 100% it shows a full ring + the final count, never
          disappearing. Hidden only before the first page lands
          (total unknown yet). The percentage is now INSIDE the ring
          (innerText) and the beside label drops the duplicated "%":
          "61 / 173" only. */}
      {total > 0 && (
        <div className="px-4 pt-2">
          <LoadRing done={listings.length} total={total} innerText={`${total ? Math.round((listings.length / total) * 100) : 0}%`} text={`${listings.length} / ${total}`} />
        </div>
      )}

      {/* Results count */}
      <div className="px-4 py-2 flex items-center justify-between flex-wrap gap-1">
        <p className="text-[11px] text-white/60">
          {listings.length === 0 && listingsLoading ? 'ရှာဖွေနေသည်...' : `${total.toLocaleString()} ရလဒ်`}
        </p>
        {/* v9.25 regen #2: while a background refetch is in flight with
            cached rows visible, show the stale pill instead of swapping
            the count line back to "ရှာဖွေနေသည်..." — the old rows stay. */}
        {listings.length > 0 && listingsQueryFetching && (
          <span className="flex items-center gap-1 text-[11px] text-white/50">
            <RefreshCw size={12} className="animate-spin" />
            အသစ်ရယူနေသည်…
          </span>
        )}
      </div>

      {/* Listings */}
      <div className="px-4 space-y-2 pb-8">
        {/* v9.25 regen #2: the full error card is for page 0 only (no
            rows yet). A failed BACKGROUND page (rows already on
            screen) keeps the rows and shows the amber strip below
            instead — never a full-page error for a failed page. */}
        {listingsError && listings.length === 0 && (
          <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
            <p className="text-sm text-red-400 font-myanmar">Data တင်ရာတွင် အမှားဖြစ်သွားသည်</p>
            <button onClick={() => refetchListings()} className="btn-primary text-xs px-4 py-2">ပြန်ကြိုးစားမည်</button>
          </div>
        )}
        {/* v9.35: failed background page — loaded rows stay, amber
            strip + retry (same 9.25 pattern as the category levels).
            The strip's retry refetches the SAME failed page; on
            success the apply effect clears pageFailed and the
            sentinel resumes auto-loading. */}
        {pageFailed && listings.length > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 flex items-center justify-between gap-2">
            <p className="text-xs text-amber-300 font-myanmar">စာရင်း တစ်ချို့ တင်မရသေးပါ — အဟောင်းပြထားသည်</p>
            <button
              onClick={() => { setPageFailed(false); refetchListings() }}
              className="text-xs text-amber-200 underline font-myanmar flex-shrink-0"
            >
              ပြန်ကြိုးစားမည်
            </button>
          </div>
        )}
        {listingsLoading && listings.length === 0
          ? [1,2,3,4,5].map(n => <Skeleton key={n} className="h-24" />)
          : listings.length === 0
          ? <EmptyState icon="🔍" title="လုပ်ငန်း မတွေ့ပါ" message="ရှာဖွေမှုကို ပြောင်းလဲကြည့်ပါ" />
          : city === 'All'
          ? groupListingsByCity(listings).map(g => (
              <div key={g.city} className="space-y-2">
                <h2 className="flex flex-wrap items-baseline gap-x-2 pt-3 pb-1 text-sm font-bold text-white">
                  <span className="min-w-0 break-words">{lang === 'mm' ? (cityLabels[g.city]?.mm || g.city) : (cityLabels[g.city]?.en || g.city)}</span>{' '}
                  <span className="text-xs font-semibold text-white/50">({g.items.length})</span>
                </h2>
                {g.items.map(l => <ListingCard key={l.id} listing={l} bookmarked={bookmarkedSet?.has?.(l.id)} />)}
              </div>
            ))
          : listings.map(l => <ListingCard key={l.id} listing={l} bookmarked={bookmarkedSet?.has?.(l.id)} />)
        }

        {/* v9.35: the manual "ထပ်တင်ရန်" button survives ONLY as the
            retry control for a failed background page — normal loading
            is automatic via the sentinel below, no tap required. */}
        {pageFailed && listings.length < total && (
          <button
            onClick={() => { setPageFailed(false); refetchListings() }}
            className="w-full btn-ghost text-sm mt-2"
          >
            ထပ်တင်ရန် ({total - listings.length} ကျန်)
          </button>
        )}
        {/* v9.35: auto-load sentinel — the observer (above) watches
            this element and prefetches the next page 800px before the
            user reaches it. While a background page is fetching, a
            small line shows under the list; the ring at the top of
            the list area carries the real X / total · Y%. */}
        <div ref={sentinelRef} data-testid="load-more-sentinel" aria-hidden="true" className="h-1" />
        {hasMore && listingsQueryFetching && !pageFailed && (
          <p className="text-center text-[11px] text-white/50 font-myanmar py-2">တင်နေသည်…</p>
        )}
      </div>
    </div>
  )
}