import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, Clock, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeout } from '../lib/withTimeout'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { showError, showSuccess } from '../lib/toast'
import { getThumbnailUrl } from '../lib/cloudinary'
import { goBackOrHome } from '../lib/navigation'

// F1: which shop is being claimed — name + address + thumbnail, shown
// at the top of the form so the user never claims the wrong shop.
function ListingSummary({ listing, lang }) {
  if (!listing) return null
  const name = lang === 'mm' ? (listing.name_mm || listing.name) : listing.name
  const address = lang === 'mm' ? (listing.address_mm || listing.address) : (listing.address || listing.address_mm)
  const thumb = listing.cover_url || listing.logo_url
  return (
    <div className="card-dark p-4 rounded-2xl flex items-center gap-3">
      <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
        {thumb
          ? <img src={getThumbnailUrl(thumb)} alt={name} className="w-full h-full object-cover" />
          : <ShieldCheck size={20} className="text-brand-300" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-display font-semibold text-white truncate font-myanmar">{name}</p>
        {address && <p className="text-xs text-white/50 truncate font-myanmar mt-0.5">{address}</p>}
      </div>
    </div>
  )
}

export default function ClaimPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, user, isLoggedIn } = useAuth()
  const { t, lang } = useLang()
  useSEO({ title: 'ပိုင်ဆိုင်ကြောင်း တောင်းဆိုခြင်း' })

  const [phone, setPhone] = useState(profile?.phone || '')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  // The user's latest claim for this listing (if any), loaded on mount so
  // a rejected claim can show a "rejected — you may re-apply" state
  // instead of a bare form (H-M10).
  const [existingClaim, setExistingClaim] = useState(null)
  const [showReapply, setShowReapply] = useState(false)
  // FB-15: a failed claim-status fetch is shown, never swallowed.
  const [claimStatusError, setClaimStatusError] = useState('')
  // F1: the listing being claimed (name + address + thumbnail).
  const [listing, setListing] = useState(null)
  // FB-15 (completed v9.5): a failed LISTING fetch is shown too — the old
  // `.catch(() => {})` left the form rendering with no shop shown (F1
  // violated silently) and no error at all.
  const [listingError, setListingError] = useState('')

  async function loadListing() {
    if (!id) return
    setListingError('')
    try {
      // 30 s timeout (was none): a hung query left the form rendering
      // with no shop shown and no error at all.
      const { data, error } = await withTimeout(supabase
        .from('listings')
        .select('id, name, name_mm, address, address_mm, cover_url, logo_url')
        .eq('id', id)
        .maybeSingle(), 30000, 'Claim listing')
      if (error) throw error
      if (!data) { setListingError('ဤလုပ်ငန်း မတွေ့တော့ပါ'); return }
      setListing(data)
    } catch {
      setListingError('လုပ်ငန်း အချက်အလက် တင်မရပါ — ပြန်ကြိုးစားမည်')
    }
  }

  // Profile loads async — sync the phone field when it arrives late,
  // otherwise the field would keep the stale '' from mount.
  useEffect(() => {
    if (profile?.phone) setPhone(profile.phone)
  }, [profile?.phone])

  useEffect(() => {
    loadListing()
  }, [id])

  useEffect(() => {
    if (!user) return
    supabase
      .from('listing_claims')
      .select('id, status')
      .eq('listing_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { setClaimStatusError('ပိုင်ဆိုင်ကြောင်း အခြေအနေ စစ်ဆေး၍ မရပါ'); return }
        if (data) setExistingClaim(data)
      })
      .catch(() => { setClaimStatusError('ပိုင်ဆိုင်ကြောင်း အခြေအနေ စစ်ဆေး၍ မရပါ') })
  }, [id, user?.id])

  // NOTE: the claim uses user.id, never profile.id — a slow/failed profile
  // fetch must not throw or leave the page stuck. Profile is only used to
  // prefill the phone number above.
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70dvh] px-8 text-center">
        <ShieldCheck size={48} className="text-brand-400 mb-4" />
        <h2 className="font-display font-bold text-xl text-white mb-2">Login လိုအပ်သည်</h2>
        <p className="text-white/50 font-myanmar mb-6">ပိုင်ဆိုင်ကြောင်း တောင်းဆိုရန် Login ဝင်ရောက်ပါ</p>
        <button onClick={() => navigate('/login')} className="btn-primary">Login ဝင်ရောက်မည်</button>
      </div>
    )
  }

  if (listingError) return (
    <div className="flex flex-col items-center justify-center min-h-[70dvh] px-8 text-center">
      <p className="text-4xl mb-3">⚠️</p>
      <h2 className="font-display font-bold text-xl text-white mb-2 font-myanmar">လုပ်ငန်း အချက်အလက် တင်မရပါ</h2>
      <p className="text-white/50 font-myanmar mb-6">{listingError}</p>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <button onClick={loadListing} className="btn-primary">ပြန်ကြိုးစားမည်</button>
        <button onClick={() => goBackOrHome(navigate, `/directory/${id}`)} className="btn-ghost">ပြန်သွားမည်</button>
      </div>
    </div>
  )

  async function handleSubmit(e) {
    e.preventDefault()
    if (!phone.trim()) { setError('ဖုန်းနံပါတ် ထည့်ပါ'); return }
    if (!user) { setError('အကောင့်အချက်အလက် ရယူနေသည် — ပြန်ဝင်ပါ'); return }
    setSubmitting(true)
    setError('')

    // Check for existing claim — fetch the latest one, not just any row.
    const { data: existing, error: checkError } = await supabase
      .from('listing_claims')
      .select('id, status')
      .eq('listing_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (checkError) {
      setError(checkError.message || 'ပိုင်ဆိုင်ကြောင်း စစ်ဆေးမရပါ — ထပ်ကြိုးစားပါ')
      setSubmitting(false)
      return
    }

    if (existing) {
      // Rejected claims CAN be re-submitted; pending/approved cannot.
      if (existing.status === 'pending') {
        setError('ဤလုပ်ငန်းအတွက် ပိုင်ဆိုင်ကြောင်း တောင်းဆိုပြီးဖြစ်သည်')
        setSubmitting(false)
        return
      }
      if (existing.status === 'approved') {
        setError('ဤလုပ်ငန်းကို ပိုင်ဆိုင်ကြောင်း အတည်ပြုပြီးဖြစ်သည်')
        setSubmitting(false)
        return
      }
      // status === 'rejected' → re-open the SAME row as pending instead
      // of INSERTing a second row: listing_claims has a blanket
      // unique(listing_id, user_id), so a fresh INSERT would fail with
      // a duplicate-key error. (NOTE: listing_claims has no reviewed_at
      // column — only reviewed_by is cleared. A claimant UPDATE policy
      // is also required on the DB side; if the update is refused by
      // RLS the friendly error below is shown.)
      const now = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('listing_claims')
        .update({
          status: 'pending',
          reviewed_by: null,
          contact_phone: phone,
          note: note || null,
          created_at: now,
          updated_at: now,
        })
        .eq('id', existing.id)
      if (updateError) {
        console.error('Claim re-submit failed:', updateError)
        setError('ပိုင်ဆိုင်ကြောင်း ထပ်တောင်းဆိုမရပါ — ထပ်ကြိုးစားပါ')
        showError(updateError.message || 'ပိုင်ဆိုင်ကြောင်း ထပ်တောင်းဆိုမရပါ — ထပ်ကြိုးစားပါ')
        setSubmitting(false)
        return
      }
      showSuccess('✓ ပိုင်ဆိုင်ကြောင်း ထပ်တောင်းဆိုပြီးပါပြီ — Admin စစ်ဆေးပေးမည်')
      setDone(true)
      setSubmitting(false)
      return
    }

    const { error: insertError } = await supabase.from('listing_claims').insert({
      listing_id: id,
      user_id: user.id,
      contact_phone: phone,
      note: note,
      status: 'pending',
    })

    if (insertError) {
      console.error('Claim submit failed:', insertError)
      setError(insertError.message || 'ပိုင်ဆိုင်ကြောင်း တောင်းဆိုမရပါ — ထပ်ကြိုးစားပါ')
      showError(insertError.message || 'ပိုင်ဆိုင်ကြောင်း တောင်းဆိုမရပါ — ထပ်ကြိုးစားပါ')
      setSubmitting(false)
      return
    }

    setDone(true)
    setSubmitting(false)
  }

  if (done) return (
    <div className="flex flex-col items-center justify-center min-h-[70dvh] px-8 text-center">
      <CheckCircle size={56} className="text-green-400 mb-4" />
      <h2 className="font-display font-bold text-2xl text-white mb-2">{t('claim_sent')}</h2>
      <p className="text-white/50 font-myanmar mb-6">{t('claim_note')}</p>
      <button onClick={() => navigate(`/directory/${id}`)} className="btn-primary">ပြန်သွားမည်</button>
    </div>
  )

  // Rejected earlier — show the outcome and let the user re-apply
  // instead of a bare form (the Claim button just reappearing was how
  // users walked straight into the duplicate-key error).
  if (existingClaim?.status === 'rejected' && !showReapply && !done) return (
    <div className="pb-8">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => goBackOrHome(navigate, `/directory/${id}`)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display font-bold text-lg text-white">{t('claim_title')}</h1>
      </div>
      <div className="px-4 space-y-5">
        <ListingSummary listing={listing} lang={lang} />
        <div className="card-dark p-5 rounded-2xl space-y-3 border border-red-500/30">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={20} className="text-red-300" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white text-sm">ပိုင်ဆိုင်ကြောင်း တောင်းဆိုခြင်း ပယ်ချခံရသည်</h3>
              <p className="text-xs text-white/50 mt-1 font-myanmar leading-relaxed">
                Admin မှ ဤလုပ်ငန်း၏ ပိုင်ဆိုင်ကြောင်း တောင်းဆိုခြင်းကို ပယ်ချလိုက်ပါသည်။ အချက်အလက် မှန်ကန်ကြောင်း သေချာပြီးပါက ထပ်တောင်းဆိုနိုင်ပါသည်။
              </p>
            </div>
          </div>
          <button onClick={() => setShowReapply(true)} className="btn-primary w-full">
            ပိုင်ဆိုင်ကြောင်း ထပ်တောင်းဆိုမည်
          </button>
          <button onClick={() => navigate(`/directory/${id}`)} className="btn-ghost w-full">
            ပြန်သွားမည်
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="pb-8">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => goBackOrHome(navigate, `/directory/${id}`)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display font-bold text-lg text-white">{t('claim_title')}</h1>
      </div>

      <div className="px-4 space-y-5">
        {claimStatusError && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-300 font-myanmar">
            {claimStatusError}
          </div>
        )}
        <ListingSummary listing={listing} lang={lang} />
        {/* Info card */}
        <div className="card-dark p-5 rounded-2xl space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600/30 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={20} className="text-brand-300" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white text-sm">ပိုင်ဆိုင်ကြောင်း တောင်းဆိုခြင်းဆိုသည်မှာ</h3>
              <p className="text-xs text-white/50 mt-1 font-myanmar leading-relaxed">
                Cherry Directory ထဲရှိ ဤလုပ်ငန်းသည် သင်၏ လုပ်ငန်းဖြစ်ကြောင်း Admin ထံ verify လျှောက်ထားခြင်းဖြစ်သည်။
                Verify ပြီးသောလုပ်ငန်းတွင် ✓ badge ပေါ်မည်ဖြစ်ပြီး Info ကို သင်ကိုယ်တိုင် ပြင်ဆင်နိုင်မည်ဖြစ်သည်။
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/60 border-t border-white/8 pt-3">
            <Clock size={12} />
            <span className="font-myanmar">{t('claim_note')}</span>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {[
            { n: 1, text: 'ဖောင် ဖြည့်ပြီး တင်သွင်းပါ' },
            { n: 2, text: 'Admin မှ ဖုန်းဖြင့် စစ်ဆေးမည်' },
            { n: 3, text: 'Verify ပြီးပါက Owner badge ရမည်' },
          ].map(s => (
            <div key={s.n} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-brand-600/40 flex items-center justify-center text-xs font-bold text-brand-300 flex-shrink-0">{s.n}</div>
              <p className="text-xs text-white/60 font-myanmar">{s.text}</p>
            </div>
          ))}
        </div>

        {/* Re-applying after a rejection — keep the context visible */}
        {existingClaim?.status === 'rejected' && showReapply && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-300 font-myanmar">
            ယခင် ပိုင်ဆိုင်ကြောင်း တောင်းဆိုခြင်း ပယ်ချခံရဖူးသည် — အချက်အလက် စစ်ပြီး ထပ်တောင်းဆိုနေပါသည်
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-myanmar">{t('claim_phone')} <span className="text-brand-400">*</span></label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="09xxxxxxxxx"
              className="input-dark"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-myanmar">မှတ်ချက် (Optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="ပိုင်ဆိုင်ကြောင်း သက်သေ / မှတ်ချက်..."
              className="input-dark resize-none h-20 font-myanmar"
            />
          </div>

          {error && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-2 text-sm text-red-300 font-myanmar">
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                တင်သွင်းနေသည်...
              </span>
            ) : t('claim_submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
