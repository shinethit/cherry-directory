import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getOptimizedUrl } from '../lib/cloudinary'

export default function SimilarBusinesses({ listingId, categoryId, lang = 'mm' }) {
  const navigate = useNavigate()
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!listingId || !categoryId) return
    let cancelled = false
    async function load() {
      try {
        const { data } = await supabase
          .from('listings')
          .select('id, name, name_mm, logo_url, cover_url, rating_avg, rating_count, is_verified, is_featured, category:categories(icon)')
          .eq('category_id', categoryId)
          .eq('status', 'approved')
          .neq('id', listingId)
          .order('is_featured', { ascending: false })
          .order('rating_avg', { ascending: false })
          .limit(6)
        if (!cancelled) setItems(data || [])
      } catch (e) { console.warn(e) }
    }
    load()
    return () => { cancelled = true }
  }, [listingId, categoryId])

  if (items.length === 0) return null

  return (
    <div>
      <p className="text-sm font-display font-bold text-white mb-3">
        {lang === 'mm' ? 'ဆင်တူလုပ်ငန်းများ' : 'Similar Businesses'}
      </p>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
        {items.map(l => {
          const img = l.logo_url || l.cover_url
          const displayName = lang === 'mm' ? (l.name_mm || l.name) : l.name
          return (
            <button
              key={l.id}
              onClick={() => navigate('/directory/' + l.id)}
              className="flex-shrink-0 w-36 card-dark rounded-2xl p-3 text-left hover:border-brand-400/30 transition-colors"
            >
              <div className="w-full h-20 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden mb-2">
                {img ? (
                  <img
                    src={getOptimizedUrl(img, { width: 200 })}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-3xl">{l.category?.icon || '🏢'}</span>
                )}
              </div>
              <p className="text-xs font-semibold text-white truncate font-myanmar">
                {displayName}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {l.rating_avg > 0 ? (
                  <>
                    <span className="text-[10px] text-amber-400 font-bold">
                      ★ {Number(l.rating_avg).toFixed(1)}
                    </span>
                    <span className="text-[9px] text-white/30">({l.rating_count})</span>
                  </>
                ) : (
                  <span className="text-[9px] text-white/30">
                    {lang === 'mm' ? 'အသစ်' : 'New'}
                  </span>
                )}
                {l.is_verified && (
                  <span className="text-[9px] text-gold-400 ml-auto">✓</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
