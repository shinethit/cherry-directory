import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { supabase } from '../lib/supabase'
import { useSEO } from '../hooks/useSEO'
import { goBackOrHome } from '../lib/navigation'
import { EmptyState, StarRating } from '../components/UI'
import { formatMyanmarDate } from '../lib/myanmarDate'
import { confirmDialog } from '../lib/confirmDialog'
import { showError, showSuccess } from '../lib/toast'

// F8 (v9.5): the Profile "Reviews" stat used to be a dead div — there was
// no page listing the user's own reviews. This page lists them (newest
// first) with the business name, stars, comment and date, a link back to
// the business, and delete for the user's own review.
export default function MyReviewsPage() {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useAuth()
  const { lang } = useLang()
  useSEO({ title: lang === 'mm' ? 'ကျွန်ုပ်၏ Reviews များ' : 'My Reviews' })

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoadError(false)
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, listing:listings(name, name_mm)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setItems(data || [])
    } catch (err) {
      console.error('loadMyReviews error:', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  async function deleteReview(id) {
    if (!(await confirmDialog(lang === 'mm' ? 'ဤ Review ကို ဖျက်မှာလား?' : 'Delete this review?', { danger: true }))) return
    const { error } = await supabase.from('reviews').delete().eq('id', id).eq('user_id', user.id)
    if (error) { showError(error.message); return }
    showSuccess(lang === 'mm' ? 'ဖျက်ပြီးပါပြီ' : 'Deleted')
    setItems(prev => prev.filter(r => r.id !== id))
  }

  if (!isLoggedIn) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-white/60 font-myanmar">{lang === 'mm' ? 'ကိုယ့် Reviews များ ကြည့်ရန် Login ဝင်ပါ' : 'Login to see your reviews'}</p>
        <button onClick={() => navigate('/login')} className="btn-primary text-sm px-6 py-3 min-h-[44px] mt-4">
          {lang === 'mm' ? 'Login ဝင်မည်' : 'Login'}
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 space-y-3 pb-24">
      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => goBackOrHome(navigate, '/profile')} className="w-11 h-11 rounded-xl bg-white/8 flex items-center justify-center" aria-label={lang === 'mm' ? 'နောက်သို့' : 'Back'}>
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="font-display font-bold text-xl text-white font-myanmar">
          {lang === 'mm' ? 'ကျွန်ုပ်၏ Reviews များ' : 'My Reviews'}
        </h1>
      </div>

      {loading ? (
        [1, 2, 3].map(n => <div key={n} className="h-24 rounded-2xl shimmer" />)
      ) : loadError ? (
        <div className="card-dark rounded-2xl p-4 text-center space-y-2 border border-red-500/30">
          <p className="text-sm text-red-400 font-myanmar">{lang === 'mm' ? 'တင်မရပါ' : 'Could not load'}</p>
          <button onClick={load} className="btn-primary text-xs px-4 py-2">{lang === 'mm' ? 'ပြန်ကြိုးစားမည်' : 'Retry'}</button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="⭐"
          title={lang === 'mm' ? 'Review မရေးရသေးပါ' : 'No reviews yet'}
          message={lang === 'mm' ? 'လုပ်ငန်းတစ်ခုကို ကြည့်ပြီး Review ရေးနိုင်ပါသည်' : 'Visit a business and write a review'}
        />
      ) : (
        items.map(r => {
          const name = lang === 'mm' ? (r.listing?.name_mm || r.listing?.name) : (r.listing?.name || r.listing?.name_mm)
          return (
            <div key={r.id} className="card-dark rounded-2xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => navigate(`/directory/${r.listing_id}`)} className="text-left flex-1 min-w-0">
                  <p className="font-display font-semibold text-sm text-white truncate">{name || (lang === 'mm' ? 'လုပ်ငန်း' : 'Business')}</p>
                  <p className="text-[11px] text-white/60 mt-0.5">{formatMyanmarDate(r.created_at)}</p>
                </button>
                <button onClick={() => deleteReview(r.id)} className="w-9 h-9 rounded-lg btn-danger flex items-center justify-center flex-shrink-0" aria-label={lang === 'mm' ? 'ဖျက်မည်' : 'Delete'}>
                  <Trash2 size={14} />
                </button>
              </div>
              <StarRating rating={r.rating} size={14} />
              {r.comment && <p className="text-sm text-white/75 font-myanmar">{r.comment}</p>}
            </div>
          )
        })
      )}
    </div>
  )
}
