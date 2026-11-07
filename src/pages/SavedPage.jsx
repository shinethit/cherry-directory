import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Bookmark, Building2, Newspaper, MapPin, Plus, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { useSEO } from '../hooks/useSEO'
import { ListingCard, PostCard, EmptyState } from '../components/UI'
import { PlaceCard, PlaceForm, CATEGORIES } from './SavedPlacesPage'
import { confirmDialog } from '../lib/confirmDialog'
import { showError } from '../lib/toast'

export default function SavedPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { user, isLoggedIn } = useAuth()
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'သိမ်းထားသော' : 'Saved' })

  const rawTab = params.get('tab') || 'businesses'
  // Unknown ?tab= values match no branch and rendered a blank page —
  // fall back to 'businesses' (F-MED-6).
  const VALID_TABS = ['businesses', 'news', 'places']
  const tab = VALID_TABS.includes(rawTab) ? rawTab : 'businesses'

  // Bookmarks
  const [listings, setListings] = useState([])
  const [posts, setPosts] = useState([])
  const [loadingBookmarks, setLoadingBookmarks] = useState(true)
  // SV3 (v9.20): listings/posts errors tracked separately — one shared
  // error used to blank BOTH tabs when only one fetch failed.
  const [listingsError, setListingsError] = useState('')
  const [postsError, setPostsError] = useState('')

  // Places
  const [places, setPlaces] = useState([])
  const [loadingPlaces, setLoadingPlaces] = useState(true)
  const [placesError, setPlacesError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [placeFilter, setPlaceFilter] = useState('all')

  const loadBookmarks = useCallback(async () => {
    if (!isLoggedIn || !user) { setLoadingBookmarks(false); return }
    setLoadingBookmarks(true)
    setListingsError('')
    setPostsError('')
    try {
      // 30 s timeout (was none): a hung query left the tab on skeletons forever.
      const { data: bmarks, error: bmarksError } = await withTimeout(supabase
        .from('bookmarks')
        .select('target_id, target_type')
        .eq('user_id', user.id), 30000, 'Bookmarks')
      if (bmarksError) throw bmarksError

      if (!bmarks?.length) {
        setListings([]); setPosts([]); setLoadingBookmarks(false); return
      }

      const listingIds = bmarks.filter(b => b.target_type === 'listing').map(b => b.target_id)
      const postIds = bmarks.filter(b => b.target_type === 'post').map(b => b.target_id)

      // allSettled: a failed listings fetch used to discard the posts
      // too (and vice versa) — each section now keeps its own result.
      const [lRes, pRes] = await withTimeout(Promise.allSettled([
        listingIds.length
          ? supabase.from('listings').select('*, category:categories(name, name_mm, icon)').in('id', listingIds)
          : Promise.resolve({ data: [] }),
        postIds.length
          ? supabase.from('posts').select('*, author:profiles(full_name), category:categories(name, name_mm)').in('id', postIds)
          : Promise.resolve({ data: [] }),
      ]), 30000, 'Saved items')
      const lOk = lRes.status === 'fulfilled' && !lRes.value.error
      const pOk = pRes.status === 'fulfilled' && !pRes.value.error
      if (!lOk) console.warn('Saved listings failed:', lRes.status === 'rejected' ? lRes.reason : lRes.value.error)
      if (!pOk) console.warn('Saved posts failed:', pRes.status === 'rejected' ? pRes.reason : pRes.value.error)
      if (!lOk) setListingsError('သိမ်းထားသော လုပ်ငန်းများ ရယူမရပါ')
      if (!pOk) setPostsError('သိမ်းထားသော သတင်းများ ရယူမရပါ')
      setListings(lOk ? (lRes.value.data || []) : [])
      setPosts(pOk ? (pRes.value.data || []) : [])
    } catch (err) {
      console.warn('Bookmarks load error:', err)
      setListingsError('သိမ်းထားသော လုပ်ငန်းများ ရယူမရပါ')
      setPostsError('သိမ်းထားသော သတင်းများ ရယူမရပါ')
      setListings([]); setPosts([])
    }
    setLoadingBookmarks(false)
  }, [user, isLoggedIn])

  const loadPlaces = useCallback(async () => {
    if (!user) { setLoadingPlaces(false); return }
    setLoadingPlaces(true)
    setPlacesError('')
    try {
      // 30 s timeout (was none): a hung query left the tab on skeletons forever.
      const { data, error } = await withTimeout(supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }), 30000, 'Saved places')
      if (error) throw error
      setPlaces(data || [])
    } catch (e) {
      // A places failure used to be silent (error ignored entirely) —
      // surface it with a Retry, mirroring bookmarks (F-MED-6).
      console.warn('Places load error:', e)
      setPlacesError(e?.message || 'နေရာများ ရယူမရပါ')
      setPlaces([])
    }
    setLoadingPlaces(false)
  }, [user])

  useEffect(() => { loadBookmarks() }, [loadBookmarks])
  useEffect(() => { loadPlaces() }, [loadPlaces])

  async function switchTab(t) {
    setParams({ tab: t }, { replace: true })
  }

  async function handleDeletePlace(id) {
    if (!(await confirmDialog(lang === 'mm' ? 'ဖျက်မည်လား?' : 'Delete?', { danger: true }))) return
    const prev = places
    setPlaces(prev => prev.filter(p => p.id !== id))
    const { error } = await supabase.from('saved_places').delete().eq('id', id)
    if (error) {
      console.error('Delete place failed:', error)
      showError(error.message || (lang === 'mm' ? 'ဖျက်မရပါ — ထပ်ကြိုးစားပါ' : 'Could not delete — please try again'))
      setPlaces(prev)
    }
  }

  function openGoogleMaps(lat, lng) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank')
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70dvh] px-8 text-center">
        <Bookmark size={48} className="text-brand-400 mb-4" />
        <h2 className="font-display font-bold text-xl text-white mb-2">
          {lang === 'mm' ? 'Login လိုအပ်သည်' : 'Login Required'}
        </h2>
        <p className="text-white/50 font-myanmar mb-6">
          {lang === 'mm' ? 'သိမ်းဆည်းရန် Login ဝင်ပါ' : 'Please sign in to view saved items'}
        </p>
        <button onClick={() => navigate('/login')} className="btn-primary">
          {lang === 'mm' ? 'Login ဝင်ရောက်မည်' : 'Sign In'}
        </button>
      </div>
    )
  }

  const TABS = [
    { id: 'businesses', label: lang === 'mm' ? 'လုပ်ငန်းများ' : 'Businesses', icon: Building2, count: listings.length },
    { id: 'news', label: lang === 'mm' ? 'သတင်းများ' : 'News', icon: Newspaper, count: posts.length },
    { id: 'places', label: lang === 'mm' ? 'နေရာများ' : 'Places', icon: MapPin, count: places.length },
  ]

  const filteredPlaces = placeFilter === 'all' ? places : places.filter(p => p.category === placeFilter)
  const totalCount = listings.length + posts.length + places.length

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
              🔖 {lang === 'mm' ? 'သိမ်းထားသော' : 'Saved'}
            </h1>
            <p className="text-[10px] text-white/60 mt-0.5 font-myanmar">
              {lang === 'mm' ? `${totalCount} ခု သိမ်းထားသည်` : `${totalCount} items saved`}
            </p>
          </div>
        </div>
        {tab === 'places' && (
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 flex-shrink-0"
          >
            <Plus size={14} /> {lang === 'mm' ? 'ထည့်မည်' : 'Add'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 px-4 mb-4">
        {TABS.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
              tab === id
                ? 'bg-brand-600/60 text-brand-200 border border-brand-400/40'
                : 'bg-white/5 text-white/50 border border-white/10'
            }`}
          >
            <Icon size={12} /> {label}
            {count > 0 && <span className="bg-white/20 px-1.5 rounded-full">{count}</span>}
          </button>
        ))}
      </div>

      {/* Places category filter */}
      {tab === 'places' && places.length > 0 && (
        <div className="px-4 mb-3 flex flex-wrap gap-2 pb-1">
          <button
            onClick={() => setPlaceFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              placeFilter === 'all'
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
                onClick={() => setPlaceFilter(cat.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  placeFilter === cat.id
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

      {/* Content */}
      <div className="px-4 space-y-2">
        {tab === 'businesses' && listingsError && (
          <div className="flex flex-col items-center py-12 text-center px-8">
            <span className="text-4xl mb-3">⚠️</span>
            <p className="font-display font-semibold text-white/70">
              {lang === 'mm' ? 'သိမ်းထားသောများ ရယူမရပါ' : 'Could not load saved items'}
            </p>
            <p className="text-xs text-white/60 mt-1 font-myanmar max-w-xs">{listingsError}</p>
            <button onClick={loadBookmarks} className="btn-primary text-sm mt-4 px-5 py-2">
              {lang === 'mm' ? 'ထပ်ကြိုးစားမည်' : 'Retry'}
            </button>
          </div>
        )}
        {tab === 'news' && postsError && (
          <div className="flex flex-col items-center py-12 text-center px-8">
            <span className="text-4xl mb-3">⚠️</span>
            <p className="font-display font-semibold text-white/70">
              {lang === 'mm' ? 'သိမ်းထားသောများ ရယူမရပါ' : 'Could not load saved items'}
            </p>
            <p className="text-xs text-white/60 mt-1 font-myanmar max-w-xs">{postsError}</p>
            <button onClick={loadBookmarks} className="btn-primary text-sm mt-4 px-5 py-2">
              {lang === 'mm' ? 'ထပ်ကြိုးစားမည်' : 'Retry'}
            </button>
          </div>
        )}
        {tab === 'businesses' && !listingsError && (
          loadingBookmarks ? (
            [1, 2, 3].map(n => <div key={n} className="h-24 rounded-2xl bg-white/4 animate-pulse" />)
          ) : listings.length === 0 ? (
            <EmptyState
              icon="🔖"
              title={lang === 'mm' ? 'သိမ်းထားသော လုပ်ငန်း မရှိသေး' : 'No saved businesses'}
              message={lang === 'mm' ? 'Directory မှ လုပ်ငန်းတွေကို သိမ်းထားပါ' : 'Bookmark businesses from the directory'}
            />
          ) : (
            listings.map(l => <ListingCard key={l.id} listing={l} />)
          )
        )}

        {tab === 'news' && !postsError && (
          loadingBookmarks ? (
            [1, 2, 3].map(n => <div key={n} className="h-24 rounded-2xl bg-white/4 animate-pulse" />)
          ) : posts.length === 0 ? (
            <EmptyState
              icon="📰"
              title={lang === 'mm' ? 'သိမ်းထားသော သတင်း မရှိသေး' : 'No saved news'}
              message={lang === 'mm' ? 'News မှ သတင်းများကို သိမ်းထားပါ' : 'Bookmark news articles'}
            />
          ) : (
            posts.map(p => <PostCard key={p.id} post={p} />)
          )
        )}

        {tab === 'places' && (
          placesError ? (
            <div className="flex flex-col items-center py-12 text-center px-8">
              <span className="text-4xl mb-3">⚠️</span>
              <p className="font-display font-semibold text-white/70">
                {lang === 'mm' ? 'နေရာများ ရယူမရပါ' : 'Could not load saved places'}
              </p>
              <p className="text-xs text-white/60 mt-1 font-myanmar max-w-xs">{placesError}</p>
              <button onClick={loadPlaces} className="btn-primary text-sm mt-4 px-5 py-2">
                {lang === 'mm' ? 'ထပ်ကြိုးစားမည်' : 'Retry'}
              </button>
            </div>
          ) : loadingPlaces ? (
            [1, 2, 3].map(n => <div key={n} className="h-24 rounded-2xl bg-white/4 animate-pulse" />)
          ) : places.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <span className="text-5xl mb-4">📍</span>
              <p className="font-display font-semibold text-white/60">
                {lang === 'mm' ? 'သိမ်းထားတာ မရှိသေး' : 'No saved places yet'}
              </p>
              <p className="text-xs text-white/60 mt-1 font-myanmar max-w-xs">
                {lang === 'mm' ? 'သွားချင်တဲ့ နေရာ၊ မှတ်ထားချင်တဲ့ နေရာတွေကို သိမ်းထားပါ' : 'Save locations you want to remember'}
              </p>
            </div>
          ) : filteredPlaces.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <p className="text-white/60 font-myanmar">
                {lang === 'mm' ? 'ဤ Category တွင် မရှိပါ' : 'No places in this category'}
              </p>
            </div>
          ) : (
            filteredPlaces.map(place => (
              <PlaceCard
                key={place.id}
                place={place}
                lang={lang}
                onDelete={() => handleDeletePlace(place.id)}
                onEdit={() => { setEditing(place); setShowForm(true) }}
                onOpenMap={() => openGoogleMaps(place.latitude, place.longitude)}
              />
            ))
          )
        )}
      </div>

      {showForm && (
        <PlaceForm
          lang={lang}
          initial={editing}
          userId={user.id}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); loadPlaces() }}
        />
      )}
    </div>
  )
}
