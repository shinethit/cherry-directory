import { describe, it, expect } from 'vitest'
import { TIERS, getTier, getNextTier, getTierProgress } from './tiers'

// Tier thresholds (points): bronze 0–99, silver 100–299, gold 300–699,
// platinum 700–1499, diamond 1500+.
describe('getTier thresholds', () => {
  it.each([
    [0, 'bronze'],
    [1, 'bronze'],
    [99, 'bronze'],
    [100, 'silver'],
    [299, 'silver'],
    [300, 'gold'],
    [699, 'gold'],
    [700, 'platinum'],
    [1499, 'platinum'],
    [1500, 'diamond'],
    [100000, 'diamond'],
  ])('%s points → %s', (points, id) => {
    expect(getTier(points).id).toBe(id)
  })

  it('clamps negative / missing points to bronze', () => {
    expect(getTier(-5).id).toBe('bronze')
    expect(getTier(undefined).id).toBe('bronze')
    expect(getTier(NaN).id).toBe('bronze')
    expect(getTier('250').id).toBe('silver')
  })

  it('exposes the tier list in ascending order', () => {
    expect(TIERS.map(t => t.id)).toEqual(['bronze', 'silver', 'gold', 'platinum', 'diamond'])
  })
})

describe('getNextTier', () => {
  it('returns the next tier, null at the top', () => {
    expect(getNextTier(0)?.id).toBe('silver')
    expect(getNextTier(299)?.id).toBe('gold')
    expect(getNextTier(1499)?.id).toBe('diamond')
    expect(getNextTier(1500)).toBeNull()
    expect(getNextTier(99999)).toBeNull()
  })
})

describe('getTierProgress', () => {
  it('0 points → 0% into bronze, 100 to silver', () => {
    const p = getTierProgress(0)
    expect(p.percent).toBe(0)
    expect(p.pointsToNext).toBe(100)
    expect(p.next.id).toBe('silver')
  })

  it('150 points → 25% through silver (100–300), 150 to gold', () => {
    const p = getTierProgress(150)
    expect(p.current.id).toBe('silver')
    expect(p.percent).toBe(25)
    expect(p.pointsToNext).toBe(150)
  })

  it('299 points → 99%+ through silver, 1 to gold', () => {
    const p = getTierProgress(299)
    expect(p.percent).toBe(100) // Math.round(199/200*100) = 100
    expect(p.pointsToNext).toBe(1)
  })

  it('diamond is capped at 100% with nothing next', () => {
    const p = getTierProgress(2000)
    expect(p.percent).toBe(100)
    expect(p.next).toBeNull()
    expect(p.pointsToNext).toBe(0)
  })
})
