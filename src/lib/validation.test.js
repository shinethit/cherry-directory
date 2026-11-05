import { describe, it, expect } from 'vitest'
import {
  validateReview,
  validateListing,
  validatePhone,
  validateUrl,
  toLatinDigits,
  normalizePhone,
} from './validation'

// validation.js is pure (no Supabase import) — no mocking needed.
// sanitizeInput / validateAndSanitizeListing were deleted in v9.17
// (zero consumers) — nothing dead left to test here.

describe('validateReview', () => {
  it('accepts a valid review', () => {
    expect(validateReview({ listing_id: 'abc', rating: 3, comment: 'ကောင်းတယ်' })).toEqual({ isValid: true, errors: [] })
  })

  it('requires a listing', () => {
    const r = validateReview({ rating: 5 })
    expect(r.isValid).toBe(false)
    expect(r.errors).toContain('စာရင်း ရွေးချယ်ရန် လိုအပ်သည်။')
  })

  it('requires rating 1–5', () => {
    for (const rating of [0, 6, null, undefined]) {
      const r = validateReview({ listing_id: 'abc', rating })
      expect(r.isValid).toBe(false)
      expect(r.errors).toContain('အဆင့်သတ်မှတ်မှု ၁ မှ ၅ အထိ ရွေးချယ်ရန် လိုအပ်သည်။')
    }
    expect(validateReview({ listing_id: 'abc', rating: 1 }).isValid).toBe(true)
    expect(validateReview({ listing_id: 'abc', rating: 5 }).isValid).toBe(true)
  })

  it('rejects comments over 1000 chars, accepts exactly 1000', () => {
    expect(validateReview({ listing_id: 'abc', rating: 4, comment: 'x'.repeat(1001) }).isValid).toBe(false)
    expect(validateReview({ listing_id: 'abc', rating: 4, comment: 'x'.repeat(1000) }).isValid).toBe(true)
  })
})

describe('validateListing (fixed: name_mm-only + Myanmar digits)', () => {
  it('accepts a Myanmar-only name (no English name)', () => {
    expect(validateListing({ name_mm: 'ရွှေဆိုင်', category_id: 'cat-1' }).isValid).toBe(true)
  })

  it('accepts an English-only name', () => {
    expect(validateListing({ name: 'Golden Shop', category_id: 'cat-1' }).isValid).toBe(true)
  })

  it('rejects a listing with neither name nor name_mm', () => {
    const r = validateListing({ name: '  ', name_mm: '', category_id: 'cat-1' })
    expect(r.isValid).toBe(false)
    expect(r.errors).toContain('အမည် ထည့်သွင်းရန် လိုအပ်သည်။')
  })

  it('requires a category', () => {
    const r = validateListing({ name_mm: 'ဆိုင်' })
    expect(r.isValid).toBe(false)
    expect(r.errors).toContain('အမျိုးအစား ရွေးချယ်ရန် လိုအပ်သည်။')
  })

  it('accepts Myanmar-digit phones in phones[] and phone_1', () => {
    expect(validateListing({ name_mm: 'ဆိုင်', category_id: 'c', phones: ['၀၉၁၂၃၄၅၆၇၈၉'] }).isValid).toBe(true)
    expect(validateListing({ name_mm: 'ဆိုင်', category_id: 'c', phone_1: '၀၉၁၂၃၄၅၆၇၈၉' }).isValid).toBe(true)
    expect(validateListing({ name_mm: 'ဆိုင်', category_id: 'c', phones: ['09123456789', '၀၉၇၇၇၇၇၇၇၇'] }).isValid).toBe(true)
  })

  it('rejects a bad phone in any slot', () => {
    const r = validateListing({ name_mm: 'ဆိုင်', category_id: 'c', phones: ['09123456789', 'abc'] })
    expect(r.isValid).toBe(false)
    expect(r.errors).toContain('ဖုန်းနံပါတ် မှားမှားမှားနေသည်။')
  })

  it('rejects a bad website, out-of-range lat/lng', () => {
    expect(validateListing({ name_mm: 'ဆိုင်', category_id: 'c', website: 'not-a-url' }).isValid).toBe(false)
    expect(validateListing({ name_mm: 'ဆိုင်', category_id: 'c', website: 'https://example.com' }).isValid).toBe(true)
    expect(validateListing({ name_mm: 'ဆိုင်', category_id: 'c', latitude: 100 }).isValid).toBe(false)
    expect(validateListing({ name_mm: 'ဆိုင်', category_id: 'c', longitude: 200 }).isValid).toBe(false)
    expect(validateListing({ name_mm: 'ဆိုင်', category_id: 'c', latitude: 20.78, longitude: 97.03 }).isValid).toBe(true)
  })
})

describe('v9.17: M1 non-finite coordinates', () => {
  it('rejects NaN / Infinity latitude and longitude', () => {
    const base = { name_mm: 'ဆိုင်', category_id: 'c' }
    expect(validateListing({ ...base, latitude: NaN }).isValid).toBe(false)
    expect(validateListing({ ...base, longitude: NaN }).isValid).toBe(false)
    expect(validateListing({ ...base, latitude: Infinity }).isValid).toBe(false)
    expect(validateListing({ ...base, latitude: 'abc' }).isValid).toBe(false)
    expect(validateListing({ ...base, latitude: 20.78, longitude: 97.03 }).isValid).toBe(true)
    expect(validateListing({ ...base }).isValid).toBe(true)
  })
})

describe('v9.17: M2 phone needs real digits', () => {
  it('rejects digit-less strings', () => {
    expect(validatePhone('-------')).toBe(false)
    expect(validatePhone('   ')).toBe(false)
    expect(validatePhone('')).toBe(false)
    expect(validatePhone('abc')).toBe(false)
  })

  it('accepts valid Myanmar numbers (Latin + Myanmar digits)', () => {
    expect(validatePhone('09123456789')).toBe(true)
    expect(validatePhone('၀၉၁၂၃၄၅၆၇၈၉')).toBe(true)
    expect(validatePhone('+95 9 123 456 789')).toBe(true)
    expect(validatePhone('081-123-456')).toBe(true)
  })
})

describe('v9.17: S21 URL scheme', () => {
  it('rejects javascript: and other non-http(s) schemes', () => {
    expect(validateUrl('javascript:alert(1)')).toBe(false)
    expect(validateUrl('data:text/html,<h1>x</h1>')).toBe(false)
    expect(validateUrl('ftp://example.com')).toBe(false)
    expect(validateUrl('not-a-url')).toBe(false)
  })

  it('accepts http/https URLs', () => {
    expect(validateUrl('https://example.com')).toBe(true)
    expect(validateUrl('http://example.com/page?q=1')).toBe(true)
  })
})

describe('Myanmar digit helpers', () => {
  it('toLatinDigits converts ၀-၉', () => {
    expect(toLatinDigits('၀၉၁၂၃၄၅၆၇၈၉')).toBe('09123456789')
    expect(toLatinDigits(null)).toBe('')
    expect(toLatinDigits('abc')).toBe('abc')
  })

  it('validatePhone accepts Myanmar digits', () => {
    expect(validatePhone('၀၉၁၂၃၄၅၆၇၈၉')).toBe(true)
    expect(validatePhone('09123456789')).toBe(true)
    expect(validatePhone('abc')).toBe(false)
  })

  it('normalizePhone strips +95/0 prefix and spaces', () => {
    expect(normalizePhone('+95 9 123 456 789')).toBe('9123456789')
    expect(normalizePhone('၀၉၁၂၃၄၅၆၇၈၉')).toBe('9123456789')
    expect(normalizePhone('09123456789')).toBe('9123456789')
  })
})
