import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MessageCircle, MapPin, Star, Send, CheckCircle, ExternalLink, Bookmark, BookmarkCheck, BadgeCheck, Edit3, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { useIsBookmarked, useAddBookmark, useRemoveBookmark } from '../hooks/useBookmarksDB'
import { StarRating, ReactionBar, Skeleton } from '../components/UI'
import MapEmbed from '../components/MapEmbed'
import VerifiedOwnerBadge from '../components/VerifiedOwnerBadge'
import { getOptimizedUrl } from '../lib/cloudinary'
import { showError, showSuccess } from '../lib/toast'
import { confirmDialog } from '../lib/confirmDialog'
import { useDeleteReview, useCreateReview } from '../hooks/useReviews'
import { maskPhone, toTelHref, toWaHref, toIntlDigits } from '../lib/phoneMask'
import { displayName as listingDisplayName } from '../lib/displayName'
import { formatMyanmarDate } from '../lib/myanmarDate'
import Lightbox from '../components/Lightbox'
import ShareButton from '../components/ShareButton'
import BusinessHours from '../components/BusinessHours'
import SimilarBusinesses from '../components/SimilarBusinesses'

// One review card. A child component (not a hook call inside .map()) so
// useDeleteReview follows the rules of hooks. Delete is allowed for the
// review owner and for admin/mod (enforced again by RLS); the local list
// is updated via onDeleted because this page keeps reviews in local state.
function ReviewRow({ r, listingId, onDeleted }) {
  const { profile, isAdmin, isModerator } = useAuth()
  const deleteReview = useDeleteReview(listingId, r.id)

  async function handleDeleteReview() {
    if (!(await confirmDialog('ဒီ Review ကို ဖျက်မည်လား?', { danger: true }))) return
    try {
      await deleteReview.mutateAsync()
      showSuccess('Review ဖျက်ပြီးပါပြီ')
      onDeleted()
    } catch (err) {
      // No toast here: useDeleteReview already toasts via
      // handleSupabaseError on every Supabase failure (I-M2).
      console.warn('Delete review failed:', err)
    }
  }

  return (
    <div className="card-dark p-4 rounded-2xl mb-2">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-sm font-bold text-white">
          {r.user?.full_name?.[0] || '?'}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white truncate">{r.user?.full_name || 'Anonymous'}</p>
          <StarRating rating={r.rating} size={11} />
        </div>
        <span className="ml-auto text-[10px] text-white/60">{formatMyanmarDate(r.created_at, { year: true })}</span>
        {(profile?.id === r.user_id || isAdmin || isModerator) && (
          <button
            onClick={handleDeleteReview}
            className="ml-2 text-[10px] text-red-400 hover:text-red-300"
          >
            ဖျက်
          </button>
        )}
      </div>
      {r.comment && <p className="text-sm text-white/60 font-myanmar">{r.comment}</p>}
    </div>
  )
}

export default function ListingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isLoggedIn, profile, isAdmin, isModerator, user } = useAuth()
  const { t, lang } = useLang()
  const { data: bookmarked = false, isError: bookmarkCheckError } = useIsBookmarked(id)
  const addBookmark = useAddBookmark()
  const removeBookmark = useRemoveBookmark()
  const bookmarkPending = addBookmark.isPending || removeBookmark.isPending
  const createReview = useCreateReview(id)

  function toggleBookmark() {
    if (!isLoggedIn) { showError('အကောင့်ဝင်မှ သိမ်းနိုင်မည်'); navigate('/login'); return }
    // No in-flight guard used to let two fast taps fire add-then-remove
    // and land out of order; the icon also flipped only after the
    // refetch round-trip. Optimistic updates now live in the hooks.
    if (bookmarkPending) return
    // If the bookmark check itself failed, `bookmarked` silently reads
    // false and a tap can hit the unique constraint — disable instead.
    if (bookmarkCheckError) { showError('သိမ်းထားမှု စစ်မရပါ — ထပ်ကြိုးစားပါ'); return }
    // No per-call onError: the bookmark hooks already toast via
    // handleSupabaseError on failure (I-M2) — a second toast here would
    // show the same error twice.
    if (bookmarked) {
      removeBookmark.mutate({ targetId: id, targetType: 'listing' })
    } else {
      addBookmark.mutate({ targetId: id, targetType: 'listing' })
    }
  }
  const [listing, setListing] = useState(null)
  const [reviews, setReviews] = useState([])
  const [myRating, setMyRating] = useState(0)
  const [myComment, setMyComment] = useState('')
  // S4 (v9.17): the current user's own review, for prefill + update.
  const [myReview, setMyReview] = useState(null)
  const [activeImg, setActiveImg] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [claimStatus, setClaimStatus] = useState(null)
  const [myVote, setMyVote] = useState(false)
  const [voteLoading, setVoteLoading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [hasMenu, setHasMenu] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDetail, setReportDetail] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [reviewLimit, setReviewLimit] = useState(20)
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false)

  // S6 (v9.17): the view-count RPC must fire once per listing id — the
  // old effect re-ran on every profile change and re-incremented.
  const viewCountedRef = useRef(null)

  useSEO({
    title: listing ? listingDisplayName(listing, lang) : 'Business',
    description: listing?.description_mm || listing?.description,
    url: `/directory/${id}`,
    image: listing?.cover_url || listing?.logo_url,
    type: 'business.business',
  })

  useEffect(() => {
    async function load() {
      setLoading(true)
      setNotFound(false)
      setLoadError(false)
      try {
        // 30 s timeout (was none — a hung query left the skeletons up
        // forever). allSettled: the listing is core, reviews are not —
        // a failed reviews query used to blank the whole page.
        const [lRes, rRes] = await withTimeout(Promise.allSettled([
          supabase.from('listings').select('*, category:categories(name, name_mm, icon), owner:profiles!owner_id(full_name, avatar_url)').eq('id', id).single(),
          supabase.from('reviews').select('*, user:profiles(full_name, avatar_url)').eq('listing_id', id).order('created_at', { ascending: false }).limit(20),
        ]), 30000, 'Listing detail')
        const l = lRes.status === 'fulfilled' ? lRes.value.data : null
        const lErr = lRes.status === 'fulfilled' ? lRes.value.error : lRes.reason
        if (lErr && lErr.code !== 'PGRST116') { setLoadError(true); setLoading(false); return }
        if (!l) { setNotFound(true); setLoading(false); return }
        const r = rRes.status === 'fulfilled' ? rRes.value.data : null
        const rErr = rRes.status === 'fulfilled' ? rRes.value.error : rRes.reason
        if (rErr) { console.warn(rErr); showError('Review များ တင်မရပါ — ထပ်ကြိုးစားပါ') }
        setListing(l)
        setReviews(r || [])
        // S4 (v9.17): prefill the form from the current user's own
        // review, so returning to edit it shows the old values and the
        // button can read "Update review".
        const mine = (r || []).find(x => x.user_id === profile?.id)
        if (mine) {
          setMyReview(mine)
          setMyRating(mine.rating || 0)
          setMyComment(mine.comment || '')
        } else {
          setMyReview(null)
          setMyRating(0)
          setMyComment('')
        }
        // The listing is visible now — the checks below are secondary
        // and must never hold the page on skeletons.
        setLoading(false)
        // "View Menu & Prices" only when the listing actually has menu items.
        try {
          const { count: menuCount, error: menuErr } = await withTimeout(supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('listing_id', id), 30000, 'Listing menu check')
          if (menuErr) { console.warn(menuErr); showError('Menu ရှိမရှိ စစ်မရပါ') }
          else setHasMenu((menuCount || 0) > 0)
        } catch (menuEx) { console.warn(menuEx); showError('Menu ရှိမရှိ စစ်မရပါ') }
        // View count: the direct UPDATE is owner-only under RLS, so it
        // silently never worked for guests (and raced for everyone).
        // The security-definer RPC increments atomically instead. If the
        // migration has not run yet the RPC is missing — log and carry on;
        // the page must never break over a view count.
        // S6 (v9.17): fire once per id — this effect re-runs when the
        // profile arrives, and each re-run used to count another view.
        if (viewCountedRef.current !== id) {
          viewCountedRef.current = id
          try {
            const { error: viewErr } = await withTimeout(supabase.rpc('increment_listing_views', { p_listing_id: id }), 30000, 'Listing view count')
            if (viewErr) console.warn('increment_listing_views failed:', viewErr)
          } catch (viewEx) { console.warn('increment_listing_views failed:', viewEx) }
        }
      } catch (e) { console.warn(e); setLoadError(true) }
      finally { setLoading(false) }
    }
    load()
  }, [id, profile])

  // S6 (v9.17): claim/vote load in a separate effect keyed on
  // profile?.id — a profile refresh must not re-fetch the listing or
  // re-count the view above.
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    async function loadClaimVote() {
      const [claimRes, voteRes] = await withTimeout(Promise.allSettled([
        supabase.from('listing_claims').select('status').eq('listing_id', id).eq('user_id', profile.id).maybeSingle(),
        supabase.from('listing_votes').select('id').eq('listing_id', id).eq('user_id', profile.id).maybeSingle(),
      ]), 30000, 'Listing claim/vote').catch(() => [null, null])
      if (cancelled) return
      const claim = claimRes?.status === 'fulfilled' ? claimRes.value.data : null
      const vote = voteRes?.status === 'fulfilled' ? voteRes.value.data : null
      if (claim) setClaimStatus(claim.status)
      setMyVote(!!vote)
    }
    loadClaimVote()
    return () => { cancelled = true }
  }, [id, profile?.id])

  async function toggleVote() {
    if (!isLoggedIn || voteLoading) return
    setVoteLoading(true)
    if (myVote) {
      const { error } = await supabase.from('listing_votes').delete().match({ listing_id: id, user_id: profile.id })
      if (error) { showError(error.message); setVoteLoading(false); return }
      setMyVote(false)
      setListing(l => ({ ...l, community_votes: Math.max(0, (l.community_votes || 0) - 1) }))
    } else {
      const { error } = await supabase.from('listing_votes').insert({ listing_id: id, user_id: profile.id })
      if (error) { showError(error.message); setVoteLoading(false); return }
      setMyVote(true)
      setListing(l => ({ ...l, community_votes: (l.community_votes || 0) + 1 }))
    }
    setVoteLoading(false)
  }

  async function submitReview() {
    if (!isLoggedIn || myRating === 0) return
    // useCreateReview runs validateReview (rating 1–5, comment ≤1000) and
    // uses user.id — the old hand-rolled upsert skipped validation and
    // dereferenced profile.id with only an isLoggedIn guard, so a null
    // profile threw with no try/catch and left submitting=true until remount.
    if (!user) { showError('အကောင့်ဝင်မှ Review ရေးနိုင်မည်'); return }
    setSubmitting(true)
    try {
      // S4 (v9.17): a blank comment on UPDATE must not wipe the old one
      // — the upsert would store '' over it. Keep the old comment.
      const commentToSend = myComment.trim() ? myComment : (myReview?.comment || '')
      await createReview.mutateAsync({ rating: myRating, comment: commentToSend })
      const { data, error: refetchErr } = await supabase.from('reviews').select('*, user:profiles(full_name, avatar_url)').eq('listing_id', id).order('created_at', { ascending: false }).limit(reviewLimit)
      if (refetchErr) { console.warn(refetchErr); showError('Review တင်ပြီးပါပြီ — စာရင်း ပြန်တင်မရပါ') }
      else {
        setReviews(data || [])
        // Re-prefill from the saved row (the form stays in "update" mode
        // instead of blanking out).
        const mine = (data || []).find(x => x.user_id === user?.id)
        if (mine) { setMyReview(mine); setMyRating(mine.rating || 0); setMyComment(mine.comment || '') }
      }
    } catch (err) {
      showError(err?.message || 'Review တင်မရပါ — ထပ်ကြိုးစားပါ')
    } finally {
      setSubmitting(false)
    }
  }

  // B41: reviews are fetched 20 at a time — load more on demand instead
  // of capping the list at 20 with no way to see the rest.
  async function loadMoreReviews() {
    if (loadingMoreReviews) return
    setLoadingMoreReviews(true)
    try {
      const nextLimit = reviewLimit + 20
      const { data, error } = await supabase.from('reviews').select('*, user:profiles(full_name, avatar_url)').eq('listing_id', id).order('created_at', { ascending: false }).limit(nextLimit)
      if (error) { showError('Review များ တင်မရပါ — ထပ်ကြိုးစားပါ'); return }
      setReviews(data || [])
      setReviewLimit(nextLimit)
    } catch (err) {
      console.warn('loadMoreReviews failed:', err)
      showError('Review များ တင်မရပါ — ထပ်ကြိုးစားပါ')
    } finally {
      setLoadingMoreReviews(false)
    }
  }

  async function handleReport() {
    if (!reportReason.trim()) return
    setReportSubmitting(true)
    try {
      // Same shape as LostFoundDetailPage: the "Anyone can report"
      // policy allows reporter_id null (guest) or auth.uid().
      const { error } = await supabase.from('reports').insert({
        target_type: 'listing',
        target_id: id,
        reporter_id: user?.id || null,
        reason: reportReason.trim(),
        note: reportDetail.trim() || null,
        status: 'pending',
      })
      if (error) throw error
      // No client-side report_count UPDATE: the on_report_created
      // trigger (migration §21) increments it server-side. A client
      // update here would double-count whenever RLS allowed it
      // (owner/admin reporters). Just bump the local copy for display.
      setListing(l => l ? { ...l, report_count: (l.report_count || 0) + 1 } : l)
      setReporting(false)
      setReported(true)
      setReportReason('')
      setReportDetail('')
      showSuccess('Report တင်ပြီးပါပြီ — Admin မှ စစ်ဆေးမည်')
    } catch (err) {
      console.warn('Report failed:', err)
      showError('Report တင်မရပါ — ထပ်ကြိုးစားပါ')
    } finally {
      setReportSubmitting(false)
    }
  }

  if (loading) return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-64" /><Skeleton className="h-32" /><Skeleton className="h-20" />
    </div>
  )

  if (notFound) return (
    <div className="p-4 py-16 text-center space-y-3">
      <p className="text-5xl">😶</p>
      <p className="font-display font-semibold text-white/70">မတွေ့ပါ</p>
      <p className="text-xs text-white/60 font-myanmar">ဤလုပ်ငန်း မရှိတော့ပါ (ဖျက်လိုက်ပြီ ဖြစ်နိုင်သည်)</p>
      <button onClick={() => navigate('/directory')} className="btn-primary text-sm px-5 py-2.5">နောက်သို့</button>
    </div>
  )

  if (loadError) return (
    <div className="p-4 py-16 text-center space-y-3">
      <p className="text-sm text-red-400 font-myanmar">Data တင်ရာတွင် အမှားဖြစ်သွားသည်</p>
      <button onClick={() => window.location.reload()} className="btn-primary text-sm px-5 py-2.5">ပြန်ကြိုးစားမည်</button>
    </div>
  )

  if (!listing) return null

  const fbUrl = listing.facebook && (listing.facebook.startsWith('http://') || listing.facebook.startsWith('https://')) ? listing.facebook : (listing.facebook ? 'https://' + listing.facebook : null)
  // NICE (v9.17): dedupe gallery images — cover == logo used to render twice.
  const allImages = [...new Set([listing.cover_url, listing.logo_url, ...(listing.images || [])].filter(Boolean))]
  const cover = allImages[activeImg] ? getOptimizedUrl(allImages[activeImg], { width: 800 }) : null
  // Issue 1 (v9.17): EN mode falls back to the Myanmar name — a bare
  // listing.name rendered a blank H1 for Myanmar-only listings.
  const displayName = listingDisplayName(listing, lang)
  // S3 (v9.17): strip a pasted t.me/ prefix and all leading @s.
  const telegramHandle = (listing.telegram || '').replace(/^(https?:\/\/)?t\.me\//i, '').replace(/^@+/, '')

  const openLightbox = (index) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="flex items-center gap-2">
          <ShareButton
            url={window.location.href}
            title={displayName}
            description={listing.description_mm || listing.description}
          />
          {isLoggedIn && (listing.owner_id === profile?.id || listing.submitted_by === profile?.id || isAdmin || isModerator) && (
            <button
              onClick={() => navigate(`/directory/${id}/edit`)}
              className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors"
              title="လုပ်ငန်း ပြင်မည်"
            >
              <Edit3 size={16} className="text-white/60" />
            </button>
          )}
          <button
            onClick={toggleBookmark}
            disabled={bookmarkPending}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 ${bookmarked ? 'bg-gold-500/20 text-gold-400' : 'bg-white/8 text-white/50 hover:text-white'}`}
          >
            {bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
        </div>
      </div>

      {/* Images gallery with lightbox */}
      {cover && (
        <div className="relative h-52 overflow-hidden mx-4 rounded-2xl mb-4 cursor-pointer" onClick={() => openLightbox(activeImg)}>
          <img src={cover} alt={displayName} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.parentElement.style.display = 'none' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          {allImages.length > 1 && (
            <>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5">
                {allImages.map((_, i) => (
                  <button key={i} onClick={(e) => { e.stopPropagation(); setActiveImg(i); }} aria-label={`ပုံ ${i + 1}`} className="p-2 flex items-center justify-center">
                    <span className={`block w-1.5 h-1.5 rounded-full ${i === activeImg ? 'bg-white' : 'bg-white/40'}`} />
                  </button>
                ))}
              </div>
              <span className="absolute bottom-2 right-3 text-[10px] text-white/80 bg-black/40 px-1.5 py-0.5 rounded-full">{activeImg + 1}/{allImages.length}</span>
            </>
          )}
        </div>
      )}

      <div className="px-4 space-y-4">
        <div>
          <div className="flex items-start gap-3">
            {listing.logo_url && (
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => openLightbox(allImages.indexOf(listing.logo_url))}>
                <img src={getOptimizedUrl(listing.logo_url, { width: 120 })} alt={displayName} className="w-full h-full object-contain" onError={(e) => { e.currentTarget.parentElement.style.display = 'none' }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <h1 className="font-display font-bold text-xl text-white break-words">{displayName}</h1>
              </div>
              {listing.name_mm && lang === 'en' && <p className="text-sm text-white/50 font-myanmar">{listing.name_mm}</p>}

              {listing.is_verified && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {listing.verify_type === 'owner' || (!listing.verify_type && listing.is_verified) ? (
                    <VerifiedOwnerBadge />
                  ) : listing.verify_type === 'cherry' ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-brand-600/30 to-brand-700/30 border border-brand-400/40">
                      <span className="text-sm">🍒</span>
                      <span className="text-xs font-semibold text-brand-300">Cherry အတည်ပြု ✓</span>
                    </span>
                  ) : listing.verify_type === 'community' ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-semibold">
                      👥 Community အတည်ပြု ✓
                      {listing.community_votes > 0 && <span className="text-blue-300/60">({listing.community_votes})</span>}
                    </span>
                  ) : (
                    <VerifiedOwnerBadge />
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="badge bg-brand-700/60 text-brand-200">{listing.category?.icon} {lang === 'mm' ? listing.category?.name_mm : listing.category?.name}</span>
                {listing.is_featured && <span className="badge-featured">⭐ Featured</span>}
                {listing.business_type === 'service' && (
                  <span className="badge bg-blue-500/15 text-blue-300 border border-blue-500/25">🛠 ဝန်ဆောင်မှု</span>
                )}
                {listing.business_type === 'home' && (
                  <span className="badge bg-green-500/15 text-green-300 border border-green-500/25">🏠 Home-based</span>
                )}
              </div>
            </div>
          </div>

          {listing.rating_avg > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <StarRating rating={listing.rating_avg} size={16} />
              <span className="text-sm font-bold text-white">{listing.rating_avg.toFixed(1)}</span>
              <span className="text-white/60 text-sm">({listing.rating_count} {t('reviews_title')})</span>
            </div>
          )}
        </div>

        {(listing.description_mm || listing.description) && (
          <div className="card-dark p-4 rounded-2xl">
            <p className={`text-sm text-white/70 font-myanmar leading-relaxed break-words ${descExpanded ? '' : 'line-clamp-4'}`}>
              {lang === 'mm' ? (listing.description_mm || listing.description) : (listing.description || listing.description_mm)}
            </p>
            {((lang === 'mm' ? (listing.description_mm || listing.description) : (listing.description || listing.description_mm)) || '').length > 200 && (
              <button onClick={() => setDescExpanded(e => !e)} className="text-xs text-brand-300 hover:text-brand-200 font-myanmar mt-2">
                {descExpanded ? 'လျှော့မည် ↑' : 'ဆက်ဖတ်ရန် ↓'}
              </button>
            )}
          </div>
        )}

        {(listing.address_mm || listing.address || listing.ward) && (
          <div className="flex items-start gap-3 card-dark p-4 rounded-2xl">
            <MapPin size={18} className="text-brand-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-white/80 font-myanmar">
                {lang === 'mm' ? (listing.address_mm || listing.address) : (listing.address || listing.address_mm)}
              </p>
              <p className="text-xs text-white/60 mt-0.5">{[listing.ward, listing.township, listing.city].filter(Boolean).join(' • ')}</p>
            </div>
          </div>
        )}

        {listing.latitude && listing.longitude && (
          <MapEmbed
            lat={parseFloat(listing.latitude)}
            lng={parseFloat(listing.longitude)}
            name={displayName}
            address={listing.address_mm || listing.address}
          />
        )}

        <BusinessHours hours={listing.hours} lang={lang} />

        <div className="grid grid-cols-2 gap-2">
          {/* S2: guests get NO tel:/WhatsApp/Viber link — the masked number
              must not dial the full number. One login button instead. */}
          {isLoggedIn ? (
            <>
              {listing.phone_1 && (
                <a href={toTelHref(listing.phone_1, true)} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-600/20 border border-green-500/30 text-green-400 font-semibold text-sm hover:bg-green-600/30 transition-colors">
                  <Phone size={16} /> {maskPhone(listing.phone_1, true)}
                </a>
              )}
              {listing.phone_2 && (
                <a href={toTelHref(listing.phone_2, true)} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-600/20 border border-green-500/30 text-green-400 font-semibold text-sm hover:bg-green-600/30 transition-colors">
                  <Phone size={16} /> {maskPhone(listing.phone_2, true)}
                </a>
              )}
              {listing.viber && (
                <a href={`viber://chat?number=${toIntlDigits(listing.viber)}`} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm hover:bg-purple-600/30 transition-colors">
                  <MessageCircle size={16} /> Viber
                </a>
              )}
              {listing.whatsapp && (
                <a href={toWaHref(listing.whatsapp, '', true)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-700/20 border border-green-600/30 text-green-300 text-sm hover:bg-green-700/30 transition-colors">
                  💬 WhatsApp
                </a>
              )}
            </>
          ) : (
            (listing.phone_1 || listing.phone_2 || listing.viber || listing.whatsapp) && (
              <button
                onClick={() => navigate('/login')}
                className="col-span-2 flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-600/20 border border-green-500/30 text-green-300 font-semibold text-sm hover:bg-green-600/30 transition-colors"
              >
                🔒 ဖုန်းနံပါတ် အပြည့်အစုံ ကြည့်ရန် Login ဝင်ပါ
              </button>
            )
          )}
          {listing.telegram && telegramHandle && (
            <a href={`https://t.me/${telegramHandle}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-sky-600/20 border border-sky-500/30 text-sky-300 text-sm hover:bg-sky-600/30 transition-colors">
              <Send size={16} /> Telegram
            </a>
          )}
          {fbUrl && (
            <a href={fbUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-300 text-sm hover:bg-blue-600/30 transition-colors ${(!listing.whatsapp || !isLoggedIn) ? 'col-span-2' : ''}`}>
              <ExternalLink size={16} /> Facebook Page
            </a>
          )}
        </div>

        {/* Prominent Menu Button — M4 (v9.17): always shown for the
            owner/admin/mod (was hidden when no menu existed, so nobody
            could ever add the first item). Label reads "Add menu" when empty. */}
        {(hasMenu || (isLoggedIn && (listing.owner_id === profile?.id || listing.submitted_by === profile?.id || isAdmin || isModerator))) && (
        <button
          onClick={() => navigate(`/directory/${id}/menu`)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-brand-600/40 to-brand-700/40 border border-brand-400/50 text-brand-200 font-semibold text-base hover:from-brand-600/60 hover:to-brand-700/60 transition-all"
        >
          <UtensilsCrossed size={20} className="text-brand-300" />
          <span className="font-display font-bold">{hasMenu ? 'မီနူးနှင့် ဈေးနှုန်းများ ကြည့်ရန်' : (lang === 'mm' ? 'မီနူး ထည့်မည်' : 'Add menu')}</span>
        </button>
        )}

        {/* Owner verification section */}
        {listing.is_verified && listing.owner ? (
          <div className="relative overflow-hidden rounded-2xl border border-gold-500/30 bg-gradient-to-br from-gold-500/10 via-gold-500/5 to-transparent p-4">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500/30 to-gold-600/20 border border-gold-500/40 flex items-center justify-center text-base font-bold text-gold-300 flex-shrink-0">
                {listing.owner.avatar_url
                  ? <img src={listing.owner.avatar_url} alt={listing.owner.full_name || 'လုပ်ငန်းပိုင်ရှင်'} className="w-full h-full object-cover rounded-xl" />
                  : (listing.owner.full_name?.[0] || '👤')
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <VerifiedOwnerBadge />
                </div>
                <p className="text-xs text-white/50 mt-1 font-myanmar">
                  <span className="text-white/70 font-semibold">{listing.owner.full_name}</span>
                  {lang === 'mm' ? ' မှ ဤဆိုင်ကို ပိုင်ဆိုင်ကြောင်း စစ်ဆေးပြီး' : ' has been verified as the owner'}
                </p>
              </div>
            </div>
          </div>
        ) : listing.is_verified ? (
          <div className="flex items-center gap-2.5 p-3.5 rounded-2xl border border-gold-500/25 bg-gold-500/8">
            <VerifiedOwnerBadge />
            <span className="text-xs text-white/50 font-myanmar">
              {lang === 'mm' ? 'ဆိုင်ရှင်မှ Verify ပြုလုပ်ပြီး' : 'Ownership has been verified'}
            </span>
          </div>
        ) : isLoggedIn && listing.owner_id !== profile?.id ? (
          <div>
            {claimStatus === 'pending' ? (
              <div className="flex items-center gap-2.5 p-4 card-dark rounded-2xl border border-amber-500/25">
                <span className="text-lg">⏳</span>
                <div>
                  <p className="text-sm font-display font-semibold text-amber-400">ပိုင်ဆိုင်ကြောင်း စစ်ဆေးဆဲ</p>
                  <p className="text-xs text-white/60 font-myanmar mt-0.5">{t('claim_note')}</p>
                </div>
              </div>
            ) : claimStatus === 'approved' ? (
              <div className="flex items-center gap-2.5 p-4 bg-green-500/10 border border-green-500/25 rounded-2xl">
                <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-display font-semibold text-green-400">{t('claimed')}</p>
                  <p className="text-xs text-white/60 font-myanmar mt-0.5">Admin စစ်ဆေးပြီးနောက် badge ပေါ်မည်</p>
                </div>
              </div>
            ) : claimStatus === 'rejected' ? (
              <div className="p-4 bg-red-500/10 border border-red-500/25 rounded-2xl space-y-2">
                <p className="text-sm font-display font-semibold text-red-400">ပိုင်ဆိုင်ကြောင်း တောင်းဆိုခြင်း ပယ်ချခံရပါတယ် — ပြန်လျှောက်နိုင်ပါတယ်</p>
                <p className="text-xs text-white/60 font-myanmar">အချက်အလက် ပြည့်စုံအောင် ပြင်ပြီး ပြန်လျှောက်ပါ</p>
                <button
                  onClick={() => navigate(`/claim/${id}`)}
                  className="w-full py-2.5 rounded-xl bg-brand-600/40 border border-brand-400/40 text-brand-200 text-xs font-bold"
                >
                  ပြန်လျှောက်မည်
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate(`/claim/${id}`)}
                className="w-full group flex items-center gap-3 py-3.5 px-4 rounded-2xl border border-brand-400/25 bg-brand-600/10 hover:bg-brand-600/20 hover:border-brand-400/40 transition-all"
              >
                <BadgeCheck size={16} className="text-brand-400 flex-shrink-0" />
                <div className="text-left flex-1">
                  <p className="text-sm font-display font-semibold text-brand-300">{t('claim_business')}</p>
                  <p className="text-[10px] text-white/35 font-myanmar mt-0.5">
                    {lang === 'mm' ? 'ဆိုင်ရှင်ဖြစ်ကြောင်း Verify လုပ်ပြီး Badge ရယူပါ' : 'Verify ownership and get the Owner badge'}
                  </p>
                </div>
                <span className="text-white/60 group-hover:text-brand-400 transition-colors text-xs">→</span>
              </button>
            )}
          </div>
        ) : !isLoggedIn ? (
          // B11: guests must see that claiming exists — a clear card with
          // a Login button, not a hidden section.
          <div className="card-dark rounded-2xl p-4 space-y-2">
            <p className="text-sm font-display font-semibold text-white font-myanmar">ဤဆိုင်ရဲ့ ပိုင်ရှင်လား?</p>
            <p className="text-xs text-white/50 font-myanmar">ပိုင်ဆိုင်ကြောင်း တောင်းဆိုပြီး ပိုင်ရှင် Badge ရယူရန် Login ဝင်ပါ</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 rounded-xl bg-brand-600/40 border border-brand-400/40 text-brand-200 text-xs font-bold"
            >
              Login ဝင်ပြီး ပိုင်ဆိုင်ကြောင်း တောင်းဆိုမည်
            </button>
          </div>
        ) : null}

        {/* Community verify section */}
        {!listing.is_verified && !isLoggedIn && (
          <div className="card-dark rounded-2xl p-4 space-y-2">
            <p className="text-sm font-display font-semibold text-white">
              👥 {lang === 'mm' ? 'ဤလုပ်ငန်း တကယ်ရှိသလား?' : 'Confirm this business?'}
            </p>
            <p className="text-[10px] text-white/60 font-myanmar">
              {lang === 'mm'
                ? `Member ${listing.community_votes || 0}/10 ဦး အတည်ပြုပြီး — အတည်ပြုရန် Login ဝင်ပါ`
                : `${listing.community_votes || 0}/10 members confirmed — log in to confirm`}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold"
            >
              {lang === 'mm' ? 'Login ဝင်ပြီး အတည်ပြုမည်' : 'Log in to confirm'}
            </button>
          </div>
        )}
        {!listing.is_verified && isLoggedIn && listing.owner_id !== profile?.id && (
          <div className="card-dark rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-display font-semibold text-white">
                  👥 {lang === 'mm' ? 'ဤလုပ်ငန်း တကယ်ရှိသလား?' : 'Confirm this business?'}
                </p>
                <p className="text-[10px] text-white/60 mt-0.5 font-myanmar">
                  {lang === 'mm'
                    ? `Member ${listing.community_votes || 0}/10 ဦး အတည်ပြုပြီး`
                    : `${listing.community_votes || 0}/10 members confirmed`}
                </p>
              </div>
              <button
                onClick={toggleVote}
                disabled={voteLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  myVote
                    ? 'bg-blue-500/25 border-blue-500/40 text-blue-400'
                    : 'bg-white/6 border-white/15 text-white/60 hover:border-blue-500/30 hover:text-blue-400'
                }`}
              >
                {voteLoading
                  ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  : myVote ? '✓' : '+'
                }
                {myVote
                  ? (lang === 'mm' ? 'အတည်ပြုပြီး' : 'Confirmed')
                  : (lang === 'mm' ? 'အတည်ပြုမည်' : 'Confirm')
                }
              </button>
            </div>
            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, ((listing.community_votes || 0) / 10) * 100)}%` }}
              />
            </div>
            <p className="text-[9px] text-white/60 font-myanmar">
              {lang === 'mm'
                ? 'Member ၁၀ ဦး အတည်ပြုပါက Community Verified badge ရမည်'
                : '10 member confirmations = Community Verified badge'}
            </p>
          </div>
        )}

        {/* Reactions */}
        <div>
          <p className="text-xs text-white/60 mb-2 font-display font-semibold uppercase tracking-wider">{t('reactions')}</p>
          <ReactionBar targetType="listing" targetId={id} />
        </div>

        {/* Reviews */}
        <div>
          {/* Reviews are fetched 20 at a time — "ထပ်တင်ရန်" below loads
              the next page instead of capping the list at 20. */}
          <p className="text-sm font-display font-bold text-white mb-3">{t('reviews_title')} ({listing.rating_count ?? reviews.length})</p>

          {isLoggedIn ? (
            <div className="card-dark p-4 rounded-2xl mb-4 space-y-3">
              <p className="text-xs text-white/50 font-myanmar">{t('write_review')}</p>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setMyRating(n)} aria-label={`${n} ကြယ်`} className="p-1.5">
                    <Star size={24} className={n <= myRating ? 'star-filled fill-amber-400' : 'star-empty'} />
                  </button>
                ))}
              </div>
              <textarea value={myComment} onChange={e => setMyComment(e.target.value)} maxLength={1000} placeholder={t('review_placeholder')} className="input-dark resize-none h-20 font-myanmar" />
              {/* S5 (v9.17): 1000-char cap + counter (validateReview enforces it server-side too). */}
              <p className="text-[10px] text-white/40 text-right -mt-1">{myComment.length}/1000</p>
              <button onClick={submitReview} disabled={myRating === 0 || submitting} className="btn-primary text-sm w-full">
                {submitting ? t('submitting') : (myReview ? (lang === 'mm' ? 'Review ပြင်မည်' : 'Update review') : t('submit_review'))}
              </button>
            </div>
          ) : (
            <div className="card-dark p-4 rounded-2xl mb-4 space-y-2">
              <p className="text-sm font-display font-semibold text-white font-myanmar">Review ရေးချင်ပါသလား?</p>
              <p className="text-xs text-white/50 font-myanmar">Review ရေးရန် Login ဝင်ပါ</p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-2.5 rounded-xl bg-brand-600/40 border border-brand-400/40 text-brand-200 text-xs font-bold"
              >
                Login ဝင်ပြီး Review ရေးမည်
              </button>
            </div>
          )}

          {reviews.map(r => (
            <ReviewRow key={r.id} r={r} listingId={id} onDeleted={() => setReviews(prev => prev.filter(x => x.id !== r.id))} />
          ))}

          {(listing.rating_count ?? 0) > reviews.length && (
            <button
              onClick={loadMoreReviews}
              disabled={loadingMoreReviews}
              className="w-full btn-ghost text-sm mt-2 disabled:opacity-50"
            >
              {loadingMoreReviews ? 'တင်နေသည်...' : `Review အားလုံး ကြည့်ရန် (${listing.rating_count} ခု) — ထပ်တင်ရန် (${listing.rating_count - reviews.length} ကျန်)`}
            </button>
          )}
        </div>
        <SimilarBusinesses listingId={id} categoryId={listing.category_id} lang={lang} />

        {/* V3: Report lives at the bottom as a text button, not a header icon */}
        {reported ? (
          <p className="text-center text-xs text-green-400 font-myanmar py-2">✓ တိုင်ကြားပြီးပါပြီ — Admin မှ စစ်ဆေးမည်</p>
        ) : (
          <button
            onClick={() => setReporting(r => !r)}
            className="w-full py-2.5 text-xs text-white/60 hover:text-red-400 font-myanmar transition-colors"
          >
            🚩 ဤလုပ်ငန်းကို တိုင်ကြားမည်
          </button>
        )}
        {reporting && (
          <div className="space-y-2 rounded-2xl bg-white/5 border border-white/10 p-3">
            <p className="text-xs font-semibold text-white/70 font-myanmar">ဤလုပ်ငန်းကို Report လုပ်မည်</p>
            <input
              type="text"
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              placeholder="Report လုပ်ရသည့် အကြောင်းရင်း..."
              className="input-dark font-myanmar w-full"
            />
            <textarea
              value={reportDetail}
              onChange={e => setReportDetail(e.target.value)}
              placeholder="အသေးစိတ် (မဖြစ်မနေ မဟုတ်)"
              className="input-dark font-myanmar w-full resize-none h-16"
            />
            <div className="flex gap-2">
              <button onClick={handleReport} disabled={!reportReason.trim() || reportSubmitting} className="flex-1 py-2 rounded-xl btn-danger text-xs font-bold disabled:opacity-40">
                {reportSubmitting ? 'တင်နေသည်...' : 'Report တင်မည်'}
              </button>
              <button onClick={() => { setReporting(false); setReportReason(''); setReportDetail('') }} className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <Lightbox
          images={allImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}