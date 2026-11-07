import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { buildOrFilter } from '../lib/myanmarSearch'

// Search across multiple tables
const SEARCH_SOURCES = [
  {
    id: 'listing',
    label: { mm: 'လုပ်ငန်းများ', en: 'Businesses' },
    icon: '🏢',
    table: 'listings',
    // v9.18 (Fix A): the old select used `icon:category_id` — not a
    // valid PostgREST embed (the codebase pattern is
    // `category:categories(icon)`) — and the old searchFields listed
    // phone_3/4/5, which no schema file ever created on listings.
    // Either one 400s the whole listings query, so the Businesses
    // section always returned []. Both are removed: nothing reads
    // item.icon (ResultRow renders the static source emoji), and
    // phone search works on the two columns that exist. Matching is
    // ilike substring, case-insensitive — "upper" matches both
    // "upper" and "Upper House".
    select: 'id, name, name_mm, address_mm, city',
    searchFields: ['name', 'name_mm', 'description', 'description_mm', 'address', 'address_mm', 'phone_1', 'phone_2'],
    routePrefix: '/directory/',
    statusFilter: { column: 'status', value: 'approved' },
  },
  {
    id: 'post',
    label: { mm: 'သတင်းများ', en: 'News & Posts' },
    icon: '📰',
    table: 'posts',
    select: 'id, title, title_mm, excerpt',
    searchFields: ['title', 'title_mm', 'content_mm'],
    routePrefix: '/news/',
    statusFilter: { column: 'status', value: 'published' },
  },
  {
    id: 'job',
    label: { mm: 'အလုပ်များ', en: 'Jobs' },
    icon: '💼',
    table: 'jobs',
    select: 'id, title, title_mm, company_mm',
    searchFields: ['title', 'title_mm', 'company_mm'],
    routePrefix: '/jobs',
    statusFilter: { column: 'status', value: 'active' },
  },
  {
    id: 'rental',
    label: { mm: 'အိမ်ငှားရမ်း', en: 'Rentals' },
    icon: '🏠',
    table: 'rentals',
    select: 'id, title, title_mm, location_mm',
    searchFields: ['title', 'title_mm', 'location_mm', 'description_mm'],
    routePrefix: '/rent',
  },
  {
    id: 'tutoring',
    label: { mm: 'ဆရာ/ကျောင်းသား', en: 'Tutoring' },
    icon: '📚',
    table: 'tutoring',
    select: 'id, title, title_mm, subject',
    searchFields: ['title', 'title_mm', 'description_mm'],
    routePrefix: '/tutoring',
  },
  {
    id: 'emergency',
    label: { mm: 'အရေးပေါ်', en: 'Emergency' },
    icon: '🆘',
    table: 'emergency_contacts',
    select: 'id, name, name_mm, phone_1',
    searchFields: ['name', 'name_mm'],
    routePrefix: '/emergency',
  },
  {
    id: 'health',
    label: { mm: 'ကျန်းမာရေး', en: 'Health' },
    icon: '🏥',
    table: 'health_services',
    select: 'id, title, title_mm, location_mm',
    searchFields: ['title', 'title_mm'],
    routePrefix: '/health',
  },
  {
    id: 'lostfound',
    label: { mm: 'ပျောက်ဆုံး', en: 'Lost & Found' },
    icon: '🔍',
    table: 'lost_found',
    select: 'id, title, title_mm',
    searchFields: ['title', 'title_mm', 'description_mm'],
    routePrefix: '/lost-found/',
  },
  {
    id: 'notice',
    label: { mm: 'ကြေညာချက်', en: 'Notices' },
    icon: '📢',
    table: 'notices',
    select: 'id, title, title_mm',
    searchFields: ['title', 'title_mm', 'content_mm'],
    routePrefix: '/notices',
    statusFilter: { column: 'status', value: 'approved' },
  },
]

export default function SearchPage() {
  const navigate = useNavigate()
  const { lang } = useLang()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') || ''

  const [query, setQuery] = useState(initialQ)
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [searchError, setSearchError] = useState(false)
  // v9.19: streaming — results appear per source as they arrive, so
  // this is false only while every source is still pending. The
  // "no results" empty state waits for it (the first source alone
  // returning [] must not flash "ရလဒ် မတွေ့ပါ" while 8 sources are
  // still in flight).
  const [allSourcesDone, setAllSourcesDone] = useState(true)
  // Request guard: a slow earlier keystroke must never overwrite newer results.
  const searchTokenRef = useRef(0)
  // v9.25 regen #2: the last GOOD results — a failed/slow run restores
  // these instead of wiping the previous query's rows with empty arrays.
  const lastGoodResultsRef = useRef({})
  // v9.18: abort the previous search's requests when a new one starts —
  // the 400 ms debounce alone still fires 9 parallel requests per pause.
  const searchAbortRef = useRef(null)

  useSEO({ title: lang === 'mm' ? 'ရှာဖွေရန်' : 'Search' })

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults({})
      setSearched(false)
      return
    }

    const timer = setTimeout(async () => {
      await runSearch(query.trim())
    }, 400)

    return () => clearTimeout(timer)
  }, [query])

  async function runSearch(q) {
    const token = ++searchTokenRef.current
    // v9.18: cancel the previous search's requests — the debounce fires
    // one search per pause, and the superseded ones must not hit the
    // network (they used to 400 in the console on every keystroke).
    if (searchAbortRef.current) searchAbortRef.current.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller
    setLoading(true)
    setSearched(true)
    setSearchError(false)
    setAllSourcesDone(false)
    const newResults = {}
    let hadError = false
    // v9.19: stream per source — the ~10 s "ရှာနေသည်..." was the
    // slowest of 9 parallel proxied requests, because runSearch
    // awaited Promise.all before the first setResults. Each source
    // now publishes its own rows the moment it resolves (success or
    // error). Stale tokens never publish.
    // v9.22 (Bug A): the spinner used to clear on the FIRST source to
    // resolve — usually one returning [], so the status line showed
    // "0 ရလဒ် တွေ့သည်" with the previous query still in the URL while
    // 8 sources were still in flight (live-timed: "0" for ~1.7 s,
    // then "5 ရလဒ်"). loading now stays true until the final block
    // below sets loading=false + allSourcesDone=true, so the status
    // shows "ရှာနေသည်..." until the count is final. Per-source rows
    // still stream in (the v9.19 intent is kept); only the
    // spinner/status stops lying.
    const streamResult = (sourceId, data) => {
      if (token !== searchTokenRef.current) return
      setResults(prev => ({ ...prev, [sourceId]: data }))
    }

    // Run all searches in parallel
    // v9.20: category-name search — a query matching a category name
    // (either language, either encoding) also returns that category's
    // listings. Search never looked at categories before, so a category
    // word returned 0 unless some listing name happened to contain it.
    // Runs alongside the source queries; its rows merge into the listing
    // results below (direct matches first, capped at 8 like the rest).
    const categoryListingsPromise = (async () => {
      try {
        const catFilter = buildOrFilter(['name', 'name_mm'], q.trim().split(/\s+/))
        const { data: cats, error: catErr } = await withTimeout(
          supabase.from('categories').select('id').or(catFilter).abortSignal(controller.signal),
          30000, 'Search categories')
        if (catErr || !cats?.length) return []
        const { data, error } = await withTimeout(
          supabase.from('listings')
            .select('id, name, name_mm, address_mm, city')
            .abortSignal(controller.signal)
            .eq('status', 'approved')
            .in('category_id', cats.map(c => c.id))
            .limit(8),
          30000, 'Search category listings')
        if (error || !data) return []
        return data
      } catch (e) {
        if (e?.name === 'AbortError' || controller.signal.aborted) return []
        return []
      }
    })()

    const promises = SEARCH_SOURCES.map(async (source) => {
      try {
        // Build OR filters for search fields (escaped: raw `,`/`(`/`)`/`%` break it).
        // v9.18: split multi-word queries — every word must match
        // somewhere (each word gets its own OR group; successive .or()
        // calls AND together). "upper house" now finds "Upper House";
        // a single word behaves exactly as before.
        // v9.20: buildOrFilter also searches each Myanmar word in its
        // alternate encoding (Zawgyi <-> Unicode) — the stored names are
        // mixed encoding, and ilike is byte-exact (see myanmarSearch.js).
        let query = supabase
          .from(source.table)
          .select(source.select)
          .abortSignal(controller.signal)
          .limit(8)

        for (const word of q.trim().split(/\s+/)) {
          query = query.or(buildOrFilter(source.searchFields, [word]))
        }

        // Add status filter if defined
        if (source.statusFilter) {
          query = query.eq(source.statusFilter.column, source.statusFilter.value)
        }

        // 30 s per source (was none): one hung source query used to
        // hold Promise.all forever, so the search spinner never cleared.
        const { data, error } = await withTimeout(query, 30000, 'Search ' + source.id)
        if (!error && data) {
          newResults[source.id] = data
          streamResult(source.id, data)
        } else {
          hadError = true
          newResults[source.id] = []
          // v9.25 regen #2: do NOT stream the empty array on error —
          // that wiped the previous query's rows for this source while
          // the run was still going. The final block below restores
          // the last good results instead.
        }
      } catch (e) {
        // v9.18: an aborted (superseded) request is not an error — a
        // newer search is already running, so do not set hadError.
        if (e?.name === 'AbortError' || controller.signal.aborted) {
          newResults[source.id] = []
          return
        }
        hadError = true
        newResults[source.id] = []
        // v9.25 regen #2: same as the error branch above — do not
        // stream [] on failure; the previous query's rows stay until
        // the final block restores the last good results.
      }
    })

    await Promise.all(promises)
    // v9.20: merge the category-name matches into the listing results
    // (direct name matches first, deduped, still capped at 8).
    const catRows = await categoryListingsPromise
    if (catRows.length > 0) {
      const seen = new Set((newResults.listing || []).map(r => r.id))
      const merged = [...(newResults.listing || [])]
      for (const row of catRows) {
        if (merged.length >= 8) break
        if (!seen.has(row.id)) { seen.add(row.id); merged.push(row) }
      }
      newResults.listing = merged
    }
    // A newer keystroke may have started since — never let stale results win.
    if (token !== searchTokenRef.current) return
    // v9.25 regen #2: a failed run restores the last good results
    // instead of setResults(newResults) with empty arrays — the
    // previous query's rows stay on screen with the error status.
    // A clean run becomes the new last-good snapshot.
    if (hadError) {
      if (Object.keys(lastGoodResultsRef.current).length > 0) {
        setResults(lastGoodResultsRef.current)
      } else {
        setResults(newResults)
      }
    } else {
      lastGoodResultsRef.current = newResults
      setResults(newResults)
    }
    setSearchError(hadError)
    setLoading(false)
    setAllSourcesDone(true)

    // Update URL
    setSearchParams({ q }, { replace: true })
  }

  function clearSearch() {
    setQuery('')
    setResults({})
    setSearched(false)
    setSearchParams({}, { replace: true })
  }

  // Count total results
  const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0)

  // Sources with results
  const sourcesWithResults = SEARCH_SOURCES.filter(
    s => (results[s.id] || []).length > 0
  )

  // B10: a section capped at 8 shows more than 8 in reality — link out to
  // the full list instead of silently stopping at 8.
  const anyCapped = sourcesWithResults.some(s => (results[s.id] || []).length === 8)
  function seeMoreUrl(source) {
    if (source.id === 'listing') return `/directory?q=${encodeURIComponent(query)}`
    // S15 (v9.17): pass the query to jobs/rent/tutoring — those pages
    // honour ?q= as their initial filter (S29).
    if (source.id === 'job' || source.id === 'rental' || source.id === 'tutoring') {
      return `${source.routePrefix}?q=${encodeURIComponent(query)}`
    }
    return source.routePrefix.replace(/\/$/, '') || '/'
  }

  return (
    <div className="pb-8 min-h-[80dvh]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="font-display font-bold text-xl text-white mb-3">
          🔍 {lang === 'mm' ? 'ရှာဖွေရန်' : 'Search'}
        </h1>

        {/* Search box */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={lang === 'mm' ? 'လုပ်ငန်း၊ သတင်း၊ အလုပ်...' : 'Business, news, job...'}
            // S-C (v9.20): no autoFocus — it pops the mobile keyboard on entry.
            className="input-dark pl-10 pr-10 w-full"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Status */}
        <div className="mt-2 text-[10px] text-white/60 font-myanmar">
          {loading ? (
            <span className="flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" />
              {lang === 'mm' ? 'ရှာနေသည်...' : 'Searching...'}
            </span>
          ) : searchError && !loading ? (
            <span className="flex items-center gap-2">
              <span className="text-red-400 font-myanmar">
                {lang === 'mm' ? 'ရှာဖွေရာတွင် အမှားဖြစ်သွားသည် — ပြန်ကြိုးစားပါ' : 'Search failed — please try again'}
              </span>
              <button onClick={() => runSearch(query)} className="text-[10px] text-brand-300 underline font-myanmar flex-shrink-0">
                {lang === 'mm' ? 'ပြန်ကြိုးစားမည်' : 'Retry'}
              </button>
            </span>
          ) : searched && query.length >= 2 ? (
            <span>
              {lang === 'mm'
                ? `${totalResults} ရလဒ် တွေ့သည်${anyCapped ? ' (တစ်ခုစီတွင် ပထမ ၈ ခုသာ ပြထားသည်)' : ''}`
                : `${totalResults} results found${anyCapped ? ' (first 8 per section shown)' : ''}`}
            </span>
          ) : query.length > 0 && query.length < 2 ? (
            <span>{lang === 'mm' ? 'အနည်းဆုံး ၂ လုံး ရိုက်ပါ' : 'Type at least 2 characters'}</span>
          ) : (
            <span>{lang === 'mm' ? 'ရှာချင်တာ ရိုက်ထည့်ပါ' : 'Type to search'}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      {searched && sourcesWithResults.length > 0 && (
        <div className="px-4 mb-3">
          <div className="flex flex-wrap gap-2 pb-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeTab === 'all'
                  ? 'bg-brand-600/60 text-brand-200 border border-brand-400/40'
                  : 'bg-white/5 text-white/50 border border-white/10'
              }`}
            >
              {lang === 'mm' ? 'အားလုံး' : 'All'} ({totalResults})
            </button>
            {sourcesWithResults.map(source => (
              <button
                key={source.id}
                onClick={() => setActiveTab(source.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  activeTab === source.id
                    ? 'bg-brand-600/60 text-brand-200 border border-brand-400/40'
                    : 'bg-white/5 text-white/50 border border-white/10'
                }`}
              >
                <span>{source.icon}</span>
                <span>{source.label[lang] || source.label.mm}</span>
                <span className="text-[9px] opacity-60">({results[source.id].length})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="px-4 space-y-4">
        {!searched && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="text-5xl mb-4">🔍</span>
            <p className="text-white/60 font-display font-semibold">
              {lang === 'mm' ? 'ရှာဖွေရန် အသင့်' : 'Ready to search'}
            </p>
            <p className="text-xs text-white/60 mt-1 font-myanmar max-w-xs">
              {lang === 'mm'
                ? 'လုပ်ငန်း၊ သတင်း၊ အလုပ်၊ အိမ်၊ ဆရာ၊ အရေးပေါ် နံပါတ် စသည် အားလုံး ရှာနိုင်သည်'
                : 'Search businesses, news, jobs, rentals, tutors, emergency contacts, and more'}
            </p>
            {/* B10: show the 9 searchable types up front — tabs only
                appear after results, so users had no idea what can be searched. */}
            <div className="flex flex-wrap justify-center gap-2 mt-6 px-4">
              {SEARCH_SOURCES.map(s => (
                <button
                  key={s.id}
                  onClick={() => navigate(s.id === 'listing' ? '/directory' : seeMoreUrl(s))}
                  className="flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold bg-white/5 text-white/60 border border-white/10 hover:text-white/90 hover:border-brand-400/30 transition-colors"
                >
                  <span>{s.icon}</span>
                  <span>{s.label[lang] || s.label.mm}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {searched && !loading && allSourcesDone && totalResults === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="text-5xl mb-4">😶</span>
            <p className="text-white/60 font-display font-semibold">
              {lang === 'mm' ? 'ရလဒ် မတွေ့ပါ' : 'No results'}
            </p>
            <p className="text-xs text-white/60 mt-1 font-myanmar">
              {lang === 'mm' ? 'အခြား စကားလုံးနဲ့ ပြန်ရှာကြည့်ပါ' : 'Try different keywords'}
            </p>
          </div>
        )}

        {searched && sourcesWithResults.map(source => {
          if (activeTab !== 'all' && activeTab !== source.id) return null
          const items = results[source.id] || []
          if (items.length === 0) return null

          return (
            <div key={source.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{source.icon}</span>
                <p className="text-[11px] font-display font-bold text-white/60 uppercase tracking-wider">
                  {source.label[lang] || source.label.mm}
                </p>
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[10px] text-white/60">{items.length}</span>
              </div>
              <div className="space-y-1.5">
                {items.map(item => (
                  <ResultRow
                    key={`${source.id}-${item.id}`}
                    source={source}
                    item={item}
                    lang={lang}
                    // S-A (v9.20): a job/rental/tutoring row used to land on
                    // the bare list top — pass ?q= like seeMoreUrl does
                    // (those pages honour it as their initial filter).
                    onNavigate={() => {
                      if (source.id === 'listing' || source.id === 'post' || source.id === 'lostfound') navigate(source.routePrefix + item.id)
                      else if (source.id === 'job' || source.id === 'rental' || source.id === 'tutoring') navigate(`${source.routePrefix}?q=${encodeURIComponent(query)}`)
                      else navigate(source.routePrefix)
                    }}
                  />
                ))}
              </div>
              {items.length === 8 && (
                <button
                  onClick={() => navigate(seeMoreUrl(source))}
                  className="w-full text-center text-xs text-brand-300 hover:text-brand-200 py-2 font-myanmar"
                >
                  {lang === 'mm' ? 'အားလုံးကြည့်ရန် → (ပထမ ၈ ခုသာ ပြထားသည်)' : 'See all → (showing first 8)'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ResultRow({ source, item, lang, onNavigate }) {
  // Determine title based on source
  const title = item.name_mm || item.name || item.title_mm || item.title || '—'
  const subtitle = item.company_mm || item.address_mm || item.location_mm || item.excerpt || item.phone_1 || item.subject || ''

  return (
    <button
      onClick={onNavigate}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8 hover:bg-white/8 hover:border-white/15 transition-colors text-left"
    >
      <span className="text-2xl flex-shrink-0">{source.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-display font-semibold text-white truncate font-myanmar">
          {title}
        </p>
        {subtitle && (
          <p className="text-[10px] text-white/60 mt-0.5 truncate font-myanmar">
            {subtitle}
          </p>
        )}
      </div>
      <span className="text-white/60 flex-shrink-0">→</span>
    </button>
  )
}
