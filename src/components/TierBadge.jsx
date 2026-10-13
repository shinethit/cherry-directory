import { getTier } from '../lib/tiers'

export default function TierBadge({ points = 0, size = 'sm', showLabel = false, lang = 'mm' }) {
  const tier = getTier(points)
  const sizes = {
    xs: 'text-[9px] px-1.5 py-0.5 gap-0.5',
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1',
    lg: 'text-sm px-3 py-1.5 gap-1.5',
  }
  const cls = sizes[size] || sizes.sm
  return (
    <span className={`inline-flex items-center rounded-full border font-bold font-display ${cls} ${tier.bg} ${tier.border} ${tier.color}`} title={`${tier.emoji} ${lang === 'mm' ? tier.mm : tier.en}`}>
      <span>{tier.emoji}</span>
      {showLabel && <span>{lang === 'mm' ? tier.mm : tier.en}</span>}
    </span>
  )
}
