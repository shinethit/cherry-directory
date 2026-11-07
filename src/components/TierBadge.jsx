import { useState } from 'react'
import { getTier, getNextTier } from '../lib/tiers'

// H15/H24: the tier badge is tappable — tapping shows what the tier means
// (points range + how to earn more). Tiers are points tiers (Bronze…Diamond),
// not "Premium"/"Standard".
export default function TierBadge({ points = 0, size = 'sm', showLabel = false, lang = 'mm' }) {
  const [showTip, setShowTip] = useState(false)
  const tier = getTier(points)
  const next = getNextTier(points)
  const sizes = {
    xs: 'text-[9px] px-1.5 py-0.5 gap-0.5',
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1',
    lg: 'text-sm px-3 py-1.5 gap-1.5',
  }
  const cls = sizes[size] || sizes.sm
  const range = tier.max === Infinity
    ? (lang === 'mm' ? `${tier.min}+ အမှတ်` : `${tier.min}+ pts`)
    : (lang === 'mm' ? `${tier.min}–${tier.max} အမှတ်` : `${tier.min}–${tier.max} pts`)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setShowTip(v => !v)}
        aria-expanded={showTip}
        aria-label={lang === 'mm' ? `${tier.mm} အဆင့် အကြောင်း` : `About the ${tier.en} tier`}
        className={`inline-flex items-center rounded-full border font-bold font-display cursor-pointer ${cls} ${tier.bg} ${tier.border} ${tier.color}`}
        title={`${tier.emoji} ${lang === 'mm' ? tier.mm : tier.en}`}
      >
        <span>{tier.emoji}</span>
        {showLabel && <span>{lang === 'mm' ? tier.mm : tier.en}</span>}
      </button>
      {showTip && (
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50 w-56 max-w-[calc(100vw-2rem)] rounded-xl bg-[#1a0030] border border-white/15 p-3 text-left shadow-xl shadow-black/50 normal-case">
          <span className="block text-xs font-bold text-white font-myanmar">
            {tier.emoji} {lang === 'mm' ? tier.mm : tier.en} {lang === 'mm' ? 'အဆင့်' : 'Tier'} · {range}
          </span>
          <span className="block text-[11px] text-white/60 mt-1 leading-relaxed font-myanmar">
            {lang === 'mm'
              ? (next
                ? `Community တွင် ပါဝင်မှုများလေ အမှတ်များလေ အဆင့်မြင့်လေဖြစ်သည်။ နောက် ${next.mm} အဆင့်ရောက်ရန် ${next.min - Math.max(0, Number(points) || 0)} အမှတ် လိုသေးသည်။`
                : 'Community တွင် ပါဝင်မှုများလေ အမှတ်များလေ အဆင့်မြင့်လေဖြစ်သည်။ အမြင့်ဆုံးအဆင့်သို့ ရောက်ရှိနေပါပြီ။')
              : (next
                ? `Earn points by contributing to the community to reach higher tiers. ${next.min - Math.max(0, Number(points) || 0)} more points to ${next.en}.`
                : 'Earn points by contributing to the community to reach higher tiers. You are at the top tier.')}
          </span>
        </span>
      )}
    </span>
  )
}
