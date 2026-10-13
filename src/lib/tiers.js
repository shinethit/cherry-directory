export const TIERS = [
  { id: 'bronze',   min: 0,    max: 99,       emoji: '🥉', mm: 'ကြေး',        en: 'Bronze',   color: 'text-amber-600',  bg: 'bg-amber-700/20',   border: 'border-amber-700/40',  gradient: 'from-amber-700 to-amber-600' },
  { id: 'silver',   min: 100,  max: 299,      emoji: '🥈', mm: 'ငွေ',          en: 'Silver',   color: 'text-gray-300',   bg: 'bg-gray-400/20',    border: 'border-gray-400/40',   gradient: 'from-gray-400 to-gray-300' },
  { id: 'gold',     min: 300,  max: 699,      emoji: '🥇', mm: 'ရွှေ',          en: 'Gold',     color: 'text-gold-400',   bg: 'bg-gold-500/20',    border: 'border-gold-500/40',   gradient: 'from-gold-500 to-gold-400' },
  { id: 'platinum', min: 700,  max: 1499,     emoji: '💎', mm: 'ပလက်တီနမ်',   en: 'Platinum', color: 'text-cyan-300',   bg: 'bg-cyan-400/20',    border: 'border-cyan-400/40',   gradient: 'from-cyan-400 to-cyan-300' },
  { id: 'diamond',  min: 1500, max: Infinity, emoji: '👑', mm: 'စိန်',          en: 'Diamond',  color: 'text-purple-300', bg: 'bg-purple-400/20',  border: 'border-purple-400/40', gradient: 'from-purple-400 to-pink-400' },
]

export function getTier(points = 0) {
  const p = Math.max(0, Number(points) || 0)
  for (const t of TIERS) if (p >= t.min && p <= t.max) return t
  return TIERS[0]
}

export function getNextTier(points = 0) {
  const current = getTier(points)
  const idx = TIERS.findIndex(t => t.id === current.id)
  if (idx === -1 || idx === TIERS.length - 1) return null
  return TIERS[idx + 1]
}

export function getTierProgress(points = 0) {
  const current = getTier(points)
  const next = getNextTier(points)
  if (!next) return { percent: 100, current, next: null, pointsToNext: 0 }
  const range = next.min - current.min
  const progress = Math.max(0, points - current.min)
  const percent = Math.min(100, Math.round((progress / range) * 100))
  const pointsToNext = Math.max(0, next.min - points)
  return { percent, current, next, pointsToNext }
}
