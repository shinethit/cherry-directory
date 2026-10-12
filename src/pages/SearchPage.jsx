import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'

// Search across multiple tables
const SEARCH_SOURCES = [
  {
    id: 'listing',
    label: { mm: 'လုပ်ငန်းများ', en: 'Businesses' },
    icon: '🏢',
    table: 'listings',
    select: 'id, name, name_mm, address_mm, city, icon:category_id',
    searchFields: ['name', 'name_mm', 'description_mm', 'address_mm'],
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
    statusFilter: { column: 'status', value: 'available' },
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
    setLoading(true)
    setSearched(true)
    const newResults = {}

    // Run all searches in parallel
    const promises = SEARCH_SOURCES.map(async (source) => {
      try {
        // Build OR filter for search fields
        const orFilter = source.searchFields
          .map(field => `${field}.ilike.%${q}%`)
          .join(',')

        let query = supabase
          .from(source.table)
          .select(source.select)
          .or(orFilter)
          .limit(8)

        // Add status filter if defined
        if (source.statusFilter) {
          query = query.eq(source.statusFilter.column, source.statusFilter.value)
        }

        const { data, error } = await query
        if (!error && data) {
          newResults[source.id] = data
        } else {
          newResults[source.id] = []
        }
      } catch (e) {
        newResults[source.id] = []
      }
    })

    await Promise.all(promises)
    setResults(newResults)
    setLoading(false)

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
            autoFocus
            className="input-dark pl-10 pr-10 text-sm w-full"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Status */}
        <div className="mt-2 text-[10px] text-white/40 font-myanmar">
          {loading ? (
            <span className="flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" />
              {lang === 'mm' ? 'ရှာနေသည်...' : 'Searching...'}
            </span>
          ) : searched && query.length >= 2 ? (
            <span>
              {lang === 'mm'
                ? `${totalResults} ရလဒ် တွေ့သည်`
                : `${totalResults} results found`}
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
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
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
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
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
            <p className="text-white/40 font-display font-semibold">
              {lang === 'mm' ? 'ရှာဖွေရန် အသင့်' : 'Ready to search'}
            </p>
            <p className="text-xs text-white/25 mt-1 font-myanmar max-w-xs">
              {lang === 'mm'
                ? 'လုပ်ငန်း၊ သတင်း၊ အလုပ်၊ အိမ်၊ ဆရာ၊ အရေးပေါ် နံပါတ် စသည် အားလုံး ရှာနိုင်သည်'
                : 'Search businesses, news, jobs, rentals, tutors, emergency contacts, and more'}
            </p>
          </div>
        )}

        {searched && !loading && totalResults === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <span className="text-5xl mb-4">😶</span>
            <p className="text-white/40 font-display font-semibold">
              {lang === 'mm' ? 'ရလဒ် မတွေ့ပါ' : 'No results'}
            </p>
            <p className="text-xs text-white/25 mt-1 font-myanmar">
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
                <span className="text-[10px] text-white/30">{items.length}</span>
              </div>
              <div className="space-y-1.5">
                {items.map(item => (
                  <ResultRow
                    key={`${source.id}-${item.id}`}
                    source={source}
                    item={item}
                    lang={lang}
                    onNavigate={() => navigate(source.routePrefix + (source.id === 'listing' || source.id === 'post' || source.id === 'lostfound' ? item.id : ''))}
                  />
                ))}
              </div>
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
          <p className="text-[10px] text-white/40 mt-0.5 truncate font-myanmar">
            {subtitle}
          </p>
        )}
      </div>
      <span className="text-white/20 flex-shrink-0">→</span>
    </button>
  )
}
