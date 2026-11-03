import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, Clock, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useSEO } from '../hooks/useSEO'
import { showError } from '../lib/toast'

export default function ClaimPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, user, isLoggedIn } = useAuth()
  const { t } = useLang()
  useSEO({ title: 'Claim Business' })

  const [phone, setPhone] = useState(profile?.phone || '')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // Profile loads async — sync the phone field when it arrives late,
  // otherwise the field would keep the stale '' from mount.
  useEffect(() => {
    if (profile?.phone) setPhone(profile.phone)
  }, [profile?.phone])

  // NOTE: the claim uses user.id, never profile.id — a slow/failed profile
  // fetch must not throw or leave the page stuck. Profile is only used to
  // prefill the phone number above.
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70dvh] px-8 text-center">
        <ShieldCheck size={48} className="text-brand-400 mb-4" />
        <h2 className="font-display font-bold text-xl text-white mb-2">Login လိုအပ်သည်</h2>
        <p className="text-white/50 font-myanmar mb-6">Business Claim လုပ်ရန် Login ဝင်ရောက်ပါ</p>
        <button onClick={() => navigate('/login')} className="btn-primary">Login ဝင်ရောက်မည်</button>
      </div>
    )
  }

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
      setError(checkError.message || 'Claim စစ်ဆေးမရပါ — ထပ်ကြိုးစားပါ')
      setSubmitting(false)
      return
    }

    if (existing) {
      // Rejected claims CAN be re-submitted; pending/approved cannot.
      if (existing.status === 'pending') {
        setError('ဤလုပ်ငန်းအတွက် Claim တင်ပြီးဖြစ်သည်')
        setSubmitting(false)
        return
      }
      if (existing.status === 'approved') {
        setError('ဤလုပ်ငန်းကို Claim အတည်ပြုပြီးဖြစ်သည်')
        setSubmitting(false)
        return
      }
      // status === 'rejected' → fall through and allow a fresh claim.
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
      setError(insertError.message || 'Claim တင်မရပါ — ထပ်ကြိုးစားပါ')
      showError(insertError.message || 'Claim တင်မရပါ — ထပ်ကြိုးစားပါ')
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

  return (
    <div className="pb-8">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display font-bold text-lg text-white">{t('claim_title')}</h1>
      </div>

      <div className="px-4 space-y-5">
        {/* Info card */}
        <div className="card-dark p-5 rounded-2xl space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600/30 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={20} className="text-brand-300" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-white text-sm">Business Claim ဆိုသည်မှာ</h3>
              <p className="text-xs text-white/50 mt-1 font-myanmar leading-relaxed">
                Cherry Directory ထဲရှိ ဤလုပ်ငန်းသည် သင်၏ လုပ်ငန်းဖြစ်ကြောင်း Admin ထံ verify လျှောက်ထားခြင်းဖြစ်သည်။
                Verify ပြီးသောလုပ်ငန်းတွင် ✓ badge ပေါ်မည်ဖြစ်ပြီး Info ကို သင်ကိုယ်တိုင် ပြင်ဆင်နိုင်မည်ဖြစ်သည်။
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/40 border-t border-white/8 pt-3">
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
