import { describe, it, expect } from 'vitest'
import { toLatinDigits } from './validation'
import { toIntlDigits, maskPhone, toTelHref, toWaHref } from './phoneMask'

// phoneMask.js is pure (validation.js has no Supabase import) — no mocking needed.

describe('Myanmar-digit conversion (H-9 / I-M4)', () => {
  it('converts Myanmar digits to Latin', () => {
    expect(toLatinDigits('၀၉၇၇၁၂၃၄၅၆၇')).toBe('09771234567')
    expect(toLatinDigits('၀၉-၇၇၁၂၃-၄၅၆၇')).toBe('09-77123-4567')
    expect(toLatinDigits('')).toBe('')
    expect(toLatinDigits(null)).toBe('')
  })

  it('toTelHref works with Myanmar-digit phones (was empty string)', () => {
    expect(toTelHref('၀၉၇၇၁၂၃၄၅၆၇')).toBe('tel:+959771234567')
    expect(toTelHref('09 771 234 567')).toBe('tel:+959771234567')
  })

  it('toWaHref works with Myanmar-digit phones (was empty string)', () => {
    expect(toWaHref('၀၉၇၇၁၂၃၄၅၆၇')).toBe('https://wa.me/959771234567')
    expect(toWaHref('၀၉၇၇၁၂၃၄၅၆၇', 'hello')).toBe('https://wa.me/959771234567?text=hello')
  })

  it('maskPhone masks Myanmar-digit phones for guests', () => {
    expect(maskPhone('၀၉၇၇၁၂၃၄၅၆၇', false)).toBe('097 ••• ••• 67')
    expect(maskPhone('၀၉၇၇၁၂၃၄၅၆၇', true)).toBe('၀၉၇၇၁၂၃၄၅၆၇')
  })
})

describe('toIntlDigits', () => {
  it('converts 09… to 95…', () => {
    expect(toIntlDigits('09771234567')).toBe('959771234567')
  })

  it('leaves 959… untouched', () => {
    expect(toIntlDigits('959771234567')).toBe('959771234567')
    expect(toIntlDigits('+959771234567')).toBe('959771234567')
  })

  it('converts a Taunggyi landline 081… to +95… (I-M3)', () => {
    expect(toIntlDigits('081-2123456')).toBe('95812123456')
    expect(toTelHref('0812123456')).toBe('tel:+95812123456')
    expect(toWaHref('0812123456')).toBe('https://wa.me/95812123456')
  })

  it('returns empty for empty input', () => {
    expect(toIntlDigits('')).toBe('')
    expect(toTelHref('')).toBe('')
    expect(toWaHref('')).toBe('')
  })
})

describe('maskPhone', () => {
  it('shows the full number to logged-in users', () => {
    expect(maskPhone('09771234567', true)).toBe('09771234567')
  })

  it('masks for guests, keeping first 3 and last 2 digits', () => {
    expect(maskPhone('09771234567', false)).toBe('097 ••• ••• 67')
  })

  it('masks very short numbers fully', () => {
    expect(maskPhone('12345', false)).toBe('••• ••• ••')
  })

  it('returns empty for empty input', () => {
    expect(maskPhone('', false)).toBe('')
    expect(maskPhone(null, false)).toBe('')
  })
})
