import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MessageCircle, MapPin, Star, Send, CheckCircle, ExternalLink, Bookmark, BookmarkCheck, Flag, Edit3, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { useBookmarks } from '../hooks/useBookmarks'
import { StarRating, ReactionBar, Skeleton } from '../components/UI'
import MapEmbed from '../components/MapEmbed'
import VerifiedOwnerBadge from '../components/VerifiedOwnerBadge'
import { getOptimizedUrl } from '../lib/cloudinary'

export default function ListingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isLoggedIn, profile, isAdmin, isModerator } = useAuth()
  const { t, lang } = useLang()
  const { isBookmarked, toggleBookmark } = useBookmarks()
  const [listing, setListing] = useState(null)
  const [reviews, setReviews] = useState([])
  const [myRating, setMyRating] = useState(0)
  const [myComment, setMyComment] = useState('')
  const [activeImg, setActiveImg] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [claimStatus, setClaimStatus] = useState(null)
  const [myVote, setMyVote] = useState(false)    // has current user voted
  const [voteLoading, setVoteLoading] = useState(false)

  useSEO({
    title: listing ? (lang === 'mm' ? listing.name_mm || listing.name : listing.name) : 'Business',
    description: listing?.description_mm || listing?.description,
    url: `/directory/${id}`,
    image: listing?.cover_url || listing?.logo_url,
    type: 'business.business',
  })

  useEffect(() => {
    async function load() {
      const [{ data: l }, { data: r }] = await Promise.all([
        supabase.from('listings').select('*, category:categories(name, name_mm, icon), owner:profiles!owner_id(full_name, avatar_url)').eq('id', id).single(),
        supabase.from('reviews').select('*, user:profiles(full_name, avatar_url)').eq('listing_id', id).order('created_at', { ascending: false }).limit(20),
      ])
      setListing(l)
      setReviews(r || [])
      supabase.from('listings').update({ view_count: (l?.view_count || 0) + 1 }).eq('id', id)

      if (profile) {
        const [{ data: claim }, { data: vote }] = await Promise.all([
          supabase.from('listing_claims').select('status').eq('listing_id', id).eq('user_id', profile.id).maybeSingle(),
          supabase.from('listing_votes').select('id').eq('listing_id', id).eq('user_id', profile.id).maybeSingle(),
        ])
        if (claim) setClaimStatus(claim.status)
        setMyVote(!!vote)
      }
    }
    load()
  }, [id, profile])

  async function toggleVote() {
    if (!isLoggedIn || voteLoading) return
    setVoteLoading(true)
    if (myVote) {
      await supabase.from('listing_votes').delete().match({ listing_id: id, user_id: profile.id })
      setMyVote(false)
      setListing(l => ({ ...l, community_votes: Math.max(0, (l.community_votes || 0) - 1) }))
    } else {
      await supabase.from('listing_votes').insert({ listing_id: id, user_id: profile.id })
      setMyVote(true)
      setListing(l => ({ ...l, community_votes: (l.community_votes || 0) + 1 }))
    }
    setVoteLoading(false)
  }

  async function submitReview() {
    if (!isLoggedIn || myRating === 0) return
    setSubmitting(true)
    await supabase.from('reviews').upsert({ listing_id: id, user_id: profile.id, rating: myRating, comment: myComment })
    const { data } = await supabase.from('reviews').select('*, user:profiles(full_name, avatar_url)').eq('listing_id', id).order('created_at', { ascending: false }).limit(20)
    setReviews(data || [])
    setMyComment(''); setSubmitting(false)
  }

  if (!listing) return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-64" /><Skeleton className="h-32" /><Skeleton className="h-20" />
    </div>
  )

  const allImages = [listing.cover_url, listing.logo_url, ...(listing.images || [])].filter(Boolean)
  const cover = allImages[activeImg] ? getOptimizedUrl(allImages[activeImg], { width: 800 }) : null
  const bookmarked = isBookmarked('listing', id)
  const displayName = lang === 'mm' ? (listing.name_mm || listing.name) : listing.name

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <div className="flex items-center gap-2">
          {/* Edit button — visible to owner/admin */}
          {isLoggedIn && (listing.owner_id === profile?.id || listing.submitted_by === profile?.id || isAdmin || isModerator) && (
            <button
              onClick={() => navigate(`/directory/${id}/edit`)}
              className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors"
              title="ဆိုင် ပြင်မည်"
            >
              <Edit3 size={16} className="text-white/60" />
            </button>
          )}
          {/* Menu button — always visible */}
          <button
            onClick={() => navigate(`/directory/${id}/menu`)}
            className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors"
            title="Menu & Prices"
          >
            <UtensilsCrossed size={16} className="text-white/60" />
          </button>
          {/* Bookmark */}
          <button
            onClick={() => toggleBookmark('listing', id)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${bookmarked ? 'bg-gold-500/20 text-gold-400' : 'bg-white/8 text-white/50 hover:text-white'}`}
          >
            {bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
        </div>
      </div>

      {/* Cover images */}
      {cover && (
        <div className="relative h-52 overflow-hidden mx-4 rounded-2xl mb-4">
          <img src={cover} alt={displayName} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          {allImages.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {allImages.map((_, i) => (
                <button key={i} onClick={() => setActiveImg(i)} className={`w-1.5 h-1.5 rounded-full ${i === activeImg ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="px-4 space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-start gap-3">
            {listing.logo_url && (
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                <img src={getOptimizedUrl(listing.logo_url, { width: 120 })} alt="" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-start gap-2 flex-wrap">
                <h1 className="font-display font-bold text-xl text-white">{displayName}</h1>
              </div>
              {listing.name_mm && lang === 'en' && <p className="text-sm text-white/50 font-myanmar">{listing.name_mm}</p>}

              {/* Verified badge — 3 types */}
              {listing.is_verified && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {listing.verify_type === 'owner' || (!listing.verify_type && listing.is_verified) ? (
                    <VerifiedOwnerBadge />
                  ) : listing.verify_type === 'community' ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-semibold">
                      👥 Community Verified
                      {listing.community_votes > 0 && <span className="text-blue-300/60">({listing.community_votes})</span>}
                    </span>
                  ) : listing.verify_type === 'cherry' ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-600/20 border border-brand-400/30 text-brand-300 text-xs font-semibold">
                      🍒 Cherry Directory Verified
                    </span>
                  ) : (
                    <VerifiedOwnerBadge />
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="badge bg-brand-700/60 text-brand-200">{listing.category?.icon} {lang === 'mm' ? listing.category?.name_mm : listing.category?.name}</span>
                {listing.is_featured && <span className="badge-featured">⭐ Featured</span>}
              </div>
            </div>
          </div>

          {listing.rating_avg > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <StarRating rating={listing.rating_avg} size={16} />
              <span className="text-sm font-bold text-white">{listing.rating_avg.toFixed(1)}</span>
              <span className="text-white/40 text-sm">({listing.rating_count} {t('reviews_title')})</span>
            </div>
          )}
        </div>

        {/* Description */}
        {(listing.description_mm || listing.description) && (
          <div className="card-dark p-4 rounded-2xl">
            <p className="text-sm text-white/70 font-myanmar leading-relaxed">
              {lang === 'mm' ? (listing.description_mm || listing.description) : (listing.description || listing.description_mm)}
            </p>
          </div>
        )}

        {/* Location */}
        {(listing.address_mm || listing.address || listing.ward) && (
          <div className="flex items-start gap-3 card-dark p-4 rounded-2xl">
            <MapPin size={18} className="text-brand-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-white/80 font-myanmar">
                {lang === 'mm' ? (listing.address_mm || listing.address) : (listing.address || listing.address_mm)}
              </p>
              <p className="text-xs text-white/40 mt-0.5">{[listing.ward, listing.township, listing.city].filter(Boolean).join(' • ')}</p>
            </div>
          </div>
        )}

        {/* Map */}
        {listing.latitude && listing.longitude && (
          <MapEmbed
            lat={parseFloat(listing.latitude)}
            lng={parseFloat(listing.longitude)}
            name={displayName}
            address={listing.address_mm || listing.address}
          />
        )}

        {/* Contact buttons */}
        <div className="grid grid-cols-2 gap-2">
          {listing.phone_1 && (
            <a href={`tel:${listing.phone_1}`} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-600/20 border border-green-500/30 text-green-400 font-semibold text-sm hover:bg-green-600/30 transition-colors">
              <Phone size={16} /> {listing.phone_1}
            </a>
          )}
          {listing.phone_2 && (
            <a href={`tel:${listing.phone_2}`} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/8 transition-colors">
              <Phone size={16} /> {listing.phone_2}
            </a>
          )}
          {listing.viber && (
            <a href={`viber://chat?number=${listing.viber.replace(/\s/g, '')}`} className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm hover:bg-purple-600/30 transition-colors">
              <MessageCircle size={16} /> Viber
            </a>
          )}
          {listing.telegram && (
            <a href={`https://t.me/${listing.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-sky-600/20 border border-sky-500/30 text-sky-300 text-sm hover:bg-sky-600/30 transition-colors">
              <Send size={16} /> Telegram
            </a>
          )}
          {listing.whatsapp && (
            <a href={`https://wa.me/${listing.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-700/20 border border-green-600/30 text-green-300 text-sm hover:bg-green-700/30 transition-colors">
              💬 WhatsApp
            </a>
          )}
          {listing.facebook && (
            <a href={listing.facebook} target="_blank" rel="noopener noreferrer" className={`flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-300 text-sm hover:bg-blue-600/30 transition-colors ${!listing.whatsapp ? 'col-span-2' : ''}`}>
              <ExternalLink size={16} /> Facebook Page
            </a>
          )}
        </div>

        {/* ── Verified Owner Panel / Claim button ─────────── */}
        {listing.is_verified && listing.owner ? (
          /* Show owner card when verified */
          <div className="relative overflow-hidden rounded-2xl border border-gold-500/30 bg-gradient-to-br from-gold-500/10 via-gold-500/5 to-transparent p-4">
            {/* shimmer bar */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
            <div className="flex items-center gap-3">
              {/* Owner avatar */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500/30 to-gold-600/20 border border-gold-500/40 flex items-center justify-center text-base font-bold text-gold-300 flex-shrink-0">
                {listing.owner.avatar_url
                  ? <img src={listing.owner.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
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
          /* Verified but owner profile not loaded */
          <div className="flex items-center gap-2.5 p-3.5 rounded-2xl border border-gold-500/25 bg-gold-500/8">
            <VerifiedOwnerBadge />
            <span className="text-xs text-white/50 font-myanmar">
              {lang === 'mm' ? 'ဆိုင်ရှင်မှ Verify ပြုလုပ်ပြီး' : 'Ownership has been verified'}
            </span>
          </div>
        ) : isLoggedIn && listing.owner_id !== profile?.id ? (
          /* Not verified — show claim UI */
          <div>
            {claimStatus === 'pending' ? (
              <div className="flex items-center gap-2.5 p-4 card-dark rounded-2xl border border-amber-500/25">
                <span className="text-lg">⏳</span>
                <div>
                  <p className="text-sm font-display font-semibold text-amber-400">Claim စစ်ဆေးဆဲ</p>
                  <p className="text-xs text-white/40 font-myanmar mt-0.5">{t('claim_note')}</p>
                </div>
              </div>
            ) : claimStatus === 'approved' ? (
              <div className="flex items-center gap-2.5 p-4 bg-green-500/10 border border-green-500/25 rounded-2xl">
                <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-display font-semibold text-green-400">{t('claimed')}</p>
                  <p className="text-xs text-white/40 font-myanmar mt-0.5">Admin စစ်ဆေးပြီးနောက် badge ပေါ်မည်</p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => navigate(`/claim/${id}`)}
                className="w-full group flex items-center gap-3 py-3.5 px-4 rounded-2xl border border-brand-400/25 bg-brand-600/10 hover:bg-brand-600/20 hover:border-brand-400/40 transition-all"
              >
                <Flag size={16} className="text-brand-400 flex-shrink-0" />
                <div className="text-left flex-1">
                  <p className="text-sm font-display font-semibold text-brand-300">{t('claim_business')}</p>
                  <p className="text-[10px] text-white/35 font-myanmar mt-0.5">
                    {lang === 'mm' ? 'ဆိုင်ရှင်ဖြစ်ကြောင်း Verify လုပ်ပြီး Badge ရယူပါ' : 'Verify ownership and get the Owner badge'}
                  </p>
                </div>
                <span className="text-white/20 group-hover:text-brand-400 transition-colors text-xs">→</span>
              </button>
            )}
          </div>
        ) : null}

        {/* ── Community Vote (for unverified listings) ─────── */}
        {!listing.is_verified && isLoggedIn && listing.owner_id !== profile?.id && (
          <div className="card-dark rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-display font-semibold text-white">
                  👥 {lang === 'mm' ? 'ဤဆိုင် တကယ်ရှိသလား?' : 'Confirm this business?'}
                </p>
                <p className="text-[10px] text-white/40 mt-0.5 font-myanmar">
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
            {/* Progress bar to 10 */}
            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, ((listing.community_votes || 0) / 10) * 100)}%` }}
              />
            </div>
            <p className="text-[9px] text-white/25 font-myanmar">
              {lang === 'mm'
                ? 'Member ၁၀ ဦး အတည်ပြုပါက Community Verified badge ရမည်'
                : '10 member confirmations = Community Verified badge'}
            </p>
          </div>
        )}

        {/* Community Vote — Members can vouch for this listing */}
        {isLoggedIn && !listing.is_verified && (
          <div className="card-dark p-4 rounded-2xl space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-display font-semibold text-white">
                  👥 {lang === 'mm' ? 'Community စစ်ဆေးခြင်း' : 'Community Verify'}
                </p>
                <p className="text-[10px] text-white/40 mt-0.5 font-myanmar">
                  {lang === 'mm'
                    ? `Member ${listing.community_votes || 0}/10 ဦး အတည်ပြုပြီး`
                    : `${listing.community_votes || 0}/10 members confirmed`}
                </p>
              </div>
              <button
                onClick={toggleVote}
                disabled={voteLoading}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  myVote
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                    : 'bg-white/5 border-white/15 text-white/60 hover:border-blue-500/30 hover:text-blue-400'
                }`}
              >
                {myVote ? '✓ ' : ''}{lang === 'mm' ? 'ဆိုင်မှန်ကန်' : 'Vouch'}
              </button>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, ((listing.community_votes || 0) / 10) * 100)}%` }}
              />
            </div>
            <p className="text-[9px] text-white/25 font-myanmar">
              {lang === 'mm'
                ? '10 ဦး အတည်ပြုပြီးပါက Community Verified badge အလိုအလျောက် ရမည်'
                : '10 member vouches = automatic Community Verified badge'}
            </p>
          </div>
        )}
        <div>
          <p className="text-xs text-white/40 mb-2 font-display font-semibold uppercase tracking-wider">{t('reactions')}</p>
          <ReactionBar targetType="listing" targetId={id} />
        </div>

        {/* Reviews */}
        <div>
          <p className="text-sm font-display font-bold text-white mb-3">{t('reviews_title')} ({reviews.length})</p>

          {isLoggedIn && (
            <div className="card-dark p-4 rounded-2xl mb-4 space-y-3">
              <p className="text-xs text-white/50 font-myanmar">{t('write_review')}</p>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setMyRating(n)}>
                    <Star size={24} className={n <= myRating ? 'star-filled fill-amber-400' : 'star-empty'} />
                  </button>
                ))}
              </div>
              <textarea value={myComment} onChange={e => setMyComment(e.target.value)} placeholder={t('review_placeholder')} className="input-dark text-sm resize-none h-20 font-myanmar" />
              <button onClick={submitReview} disabled={myRating === 0 || submitting} className="btn-primary text-sm w-full">
                {submitting ? t('submitting') : t('submit_review')}
              </button>
            </div>
          )}

          {reviews.map(r => (
            <div key={r.id} className="card-dark p-4 rounded-2xl mb-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-sm font-bold text-white">
                  {r.user?.full_name?.[0] || '?'}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{r.user?.full_name || 'Anonymous'}</p>
                  <StarRating rating={r.rating} size={11} />
                </div>
                <span className="ml-auto text-[10px] text-white/30">{new Date(r.created_at).toLocaleDateString('my-MM')}</span>
              </div>
              {r.comment && <p className="text-sm text-white/60 font-myanmar">{r.comment}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
