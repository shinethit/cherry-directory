import { describe, it, expect } from 'vitest'
import { ALL_ICONS, EMOJI_KEYWORDS, searchIcons } from './iconSearch'

describe('searchIcons', () => {
  it('matches an English keyword (shop → 🏪)', () => {
    expect(searchIcons('shop')).toContain('🏪')
  })

  it('is case-insensitive and matches partial keywords (SHOP, cof → ☕)', () => {
    expect(searchIcons('SHOP')).toContain('🏪')
    expect(searchIcons('cof')).toContain('☕')
  })

  it('matches a Myanmar keyword (ဆိုင် → 🏪, ဆေးရုံ → 🏥)', () => {
    expect(searchIcons('ဆိုင်')).toContain('🏪')
    expect(searchIcons('ဆေးရုံ')).toContain('🏥')
  })

  it('returns an empty list when nothing matches', () => {
    expect(searchIcons('zzzzqqq')).toEqual([])
  })

  it('returns all icons for an empty term', () => {
    expect(searchIcons('')).toEqual(ALL_ICONS)
    expect(searchIcons('   ')).toEqual(ALL_ICONS)
  })

  it('returns all icons for undefined / null', () => {
    expect(searchIcons(undefined)).toEqual(ALL_ICONS)
    expect(searchIcons(null)).toEqual(ALL_ICONS)
  })
})

describe('ALL_ICONS', () => {
  it('has no duplicates — every emoji appears once', () => {
    expect(new Set(ALL_ICONS).size).toBe(ALL_ICONS.length)
  })

  it('every icon has keywords', () => {
    ALL_ICONS.forEach(emoji => {
      expect(EMOJI_KEYWORDS[emoji]).toBeTruthy()
    })
  })
})
