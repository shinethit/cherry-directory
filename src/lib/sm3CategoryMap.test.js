import { describe, it, expect } from 'vitest'
import { mapSm3Category, SM3_CATEGORY_MAP } from './sm3CategoryMap'
import { uni2zg } from './rabbit.js'

// sm3 Category Mapping — Cherry Directory v9.26.
// Pins the raw sm3 sub-category -> Directory category mapping for the
// 874 sm3dir Category 23 shops, plus the unmapped contract: an unknown
// value returns null and must NEVER silently fall back to အထွေထွေ.
// NOTE: this test file compares no filesystem paths (delivery-time
// AGENTS.md rule — nothing to normalise here).

describe('sm3CategoryMap: every distinct sm3 sub-category maps', () => {
  it.each([
    ['Real Estate', 'Real Estate'],
    ['Car Rental Service', 'Car Rental Service'],
    ['Advertising Agency', 'Advertising Agency'],
    ['Oversea Employment Service', 'Oversea Employment Service'],
    ['Insurance Agent', 'Insurance'],
    ['Seaman & Shipping Employment Service', 'Seaman & Shipping Employment Service'],
    ['Local Employment Service', 'Local Employment Service'],
    ['Custom Clearance Agents', 'Custom Clearance'],
    // General Services genuinely belongs in အထွေထွေ — the ONLY value
    // that maps there.
    ['General Services', 'အထွေထွေ'],
  ])('%s -> %s', (raw, expected) => {
    expect(mapSm3Category(raw)).toBe(expected)
  })

  it('the table covers exactly the 9 distinct sm3 values', () => {
    const raws = SM3_CATEGORY_MAP.flatMap((e) => e.raw)
    expect(raws).toHaveLength(9)
    expect(new Set(raws).size).toBe(9)
  })
})

describe('sm3CategoryMap: semicolon lists take the FIRST segment', () => {
  it.each([
    ['Local Employment Service; Real Estate', 'Local Employment Service'],
    ['Local Employment Service; Oversea Employment Service', 'Local Employment Service'],
    ['General Services; Real Estate', 'အထွေထွေ'],
    ['Car Rental Service; Real Estate', 'Car Rental Service'],
    ['Car Rental Service; General Services; Real Estate', 'Car Rental Service'],
    ['Real Estate; Advertising Agency', 'Real Estate'],
    ['Car Rental Service; Local Employment Service; General Services; Real Estate', 'Car Rental Service'],
  ])('%s -> %s', (raw, expected) => {
    expect(mapSm3Category(raw)).toBe(expected)
  })
})

describe('sm3CategoryMap: tolerant of case and whitespace', () => {
  it('lowercase / upper-case English still maps', () => {
    expect(mapSm3Category('real estate')).toBe('Real Estate')
    expect(mapSm3Category('CAR RENTAL SERVICE')).toBe('Car Rental Service')
    expect(mapSm3Category('insurance agent')).toBe('Insurance')
  })

  it('surrounding whitespace is trimmed', () => {
    expect(mapSm3Category('  Real Estate  ')).toBe('Real Estate')
    expect(mapSm3Category('  Local Employment Service ; Real Estate ')).toBe('Local Employment Service')
  })
})

describe('sm3CategoryMap: Myanmar names in Unicode or Zawgyi', () => {
  it('Unicode Myanmar name maps', () => {
    expect(mapSm3Category('အိမ်ခြံမြေ')).toBe('Real Estate')
    expect(mapSm3Category('ကားငှားဝန်ဆောင်မှု')).toBe('Car Rental Service')
    expect(mapSm3Category('အာမခံ')).toBe('Insurance')
  })

  it('Zawgyi Myanmar name maps (converted, not re-typed)', () => {
    // Zawgyi forms are COMPUTED from the Unicode literals so the test
    // itself cannot silently be written in the wrong encoding.
    expect(mapSm3Category(uni2zg('အိမ်ခြံမြေ'))).toBe('Real Estate')
    expect(mapSm3Category(uni2zg('ကားငှားဝန်ဆောင်မှု'))).toBe('Car Rental Service')
    expect(mapSm3Category(uni2zg('အာမခံ'))).toBe('Insurance')
    expect(mapSm3Category(uni2zg('ပြည်ပအလုပ်အကိုင်'))).toBe('Oversea Employment Service')
  })
})

describe('sm3CategoryMap: existing categories pass through', () => {
  it('seeded English names pass through (any case)', () => {
    expect(mapSm3Category('taxi & transport')).toBe('Taxi & Transport')
    expect(mapSm3Category('Finance & Banking')).toBe('Finance & Banking')
  })

  // v9.27: the live category was renamed 'Restaurant & Food' →
  // 'Restaurant' (9.27 migration); the old seed name is kept as an
  // alias so rows carrying it still resolve, and the Myanmar name maps
  // to the LIVE name — the old mapping sent 'စားသောက်ဆိုင်' rows to a
  // category that does not exist live, so they failed as "not found".
  it("'စားသောက်ဆိုင်' and the old seed name map to the live 'Restaurant'", () => {
    expect(mapSm3Category('စားသောက်ဆိုင်')).toBe('Restaurant')
    expect(mapSm3Category(uni2zg('စားသောက်ဆိုင်'))).toBe('Restaurant')
    expect(mapSm3Category('Restaurant & Food')).toBe('Restaurant')
    expect(mapSm3Category('restaurant & food')).toBe('Restaurant')
    expect(mapSm3Category('Restaurant')).toBe('Restaurant')
  })
})

describe('sm3CategoryMap: unmapped is null — never a silent အထွေထွေ', () => {
  it.each([
    'Pizza Parlour',
    'Unknown Service',
    'General',
    '',
    '   ',
    null,
    undefined,
  ])('%s -> null', (raw) => {
    expect(mapSm3Category(raw)).toBeNull()
  })

  it('a near-miss does not fall back to အထွေထွေ', () => {
    expect(mapSm3Category('General Service')).toBeNull()
    expect(mapSm3Category('Real Estates')).toBeNull()
    expect(mapSm3Category('Car Rental')).toBeNull()
  })
})
