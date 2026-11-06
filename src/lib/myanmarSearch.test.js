import { describe, it, expect } from 'vitest'
import { myanmarVariants, isZawgyiWord, buildOrFilter } from './myanmarSearch'

// Myanmar search — Zawgyi / Unicode dual-encoding (v9.20).
// Live evidence (2026-11-05, production DB): stored names are MIXED
// encoding, and ilike is byte-exact, so a Unicode query never matches a
// Zawgyi-stored row. Proven live: ilike %မော်ခမ်း% (Unicode) -> [],
// ilike %ေမာ္ခမ္း% (Zawgyi) -> the restaurant row. These tests pin the
// query construction that fixes it, using the REAL reported strings.
// Codepoints are asserted as hex (not re-typed literals) so the test
// itself cannot silently be written in the wrong encoding.

const cp = (s) => [...s].map((c) => c.codePointAt(0).toString(16)).join(' ')

describe('myanmarSearch: the reported queries gain their alternate encoding', () => {
  it('the test file literals are Unicode (guards the test itself)', () => {
    expect(cp('ကော်ဖီ')).toBe('1000 1031 102c 103a 1016 102e')
    expect(cp('မွန်မွန်')).toBe('1019 103d 1014 103a 1019 103d 1014 103a')
    expect(cp('မော်ခမ်း')).toBe('1019 1031 102c 103a 1001 1019 103a 1038')
  })

  it('ကော်ဖီ (coffee) also searches its Zawgyi form', () => {
    const variants = myanmarVariants('ကော်ဖီ')
    expect(variants).toContain('ကော်ဖီ')
    // Zawgyi form: ေ U+1031 first, asat as U+1039.
    expect(variants.some((v) => cp(v) === '1031 1000 102c 1039 1016 102e')).toBe(true)
  })

  it('မွန်မွန် also searches its Zawgyi form — and no garbage third variant', () => {
    const variants = myanmarVariants('မွန်မွန်')
    expect(variants).toHaveLength(2)
    expect(variants[0]).toBe('မွန်မွန်')
    // True Zawgyi form per Rabbit: medial wa U+103c, asat U+1039.
    expect(cp(variants[1])).toBe('1019 103c 1014 1039 1019 103c 1014 1039')
  })

  it('မော်ခမ်း (the live-proven case) also searches its Zawgyi form', () => {
    const variants = myanmarVariants('မော်ခမ်း')
    expect(variants.some((v) => cp(v) === '1031 1019 102c 1039 1001 1019 1039 1038')).toBe(true)
  })

  it('a Zawgyi-typed query also searches its Unicode form', () => {
    const zg = [...'မော်ခမ်း'].length ? myanmarVariants('မော်ခမ်း')[1] : ''
    expect(isZawgyiWord(zg)).toBe(true)
    expect(myanmarVariants(zg)).toContain('မော်ခမ်း')
  })

  it('a Myanmar category word also searches its Zawgyi form', () => {
    const variants = myanmarVariants('စားသောက်ဆိုင်')
    expect(variants.some((v) => cp(v) === '1005 102c 1038 1031 101e 102c 1000 1039 1006 102d 102f 1004 1039')).toBe(true)
    const tea = myanmarVariants('လဖက်ရည်ဆိုင်')
    expect(tea.length).toBe(2)
  })

  it('English queries are untouched (one variant, no conversion)', () => {
    expect(myanmarVariants('upper')).toEqual(['upper'])
    expect(myanmarVariants('cof')).toEqual(['cof'])
    expect(myanmarVariants('hotel')).toEqual(['hotel'])
    expect(myanmarVariants('zzzzqqq')).toEqual(['zzzzqqq'])
  })
})

describe('myanmarSearch: Zawgyi detection', () => {
  it('detects Zawgyi by its impossible-in-Unicode signatures', () => {
    expect(isZawgyiWord('ေမာ္ခမ္း')).toBe(true)
    expect(isZawgyiWord('ေရႊအိုး')).toBe(true)
    expect(isZawgyiWord('မော်ခမ်း')).toBe(false)
    expect(isZawgyiWord('ကော်ဖီ')).toBe(false)
  })

  it('does NOT flag valid Unicode where ေ is followed by a consonant (စေတနာ)', () => {
    // The naive detector ("1031 followed by a consonant") wrongly flags
    // this: in Unicode ေ follows its consonant and the NEXT syllable's
    // consonant comes after it. Detection must look at what PRECEDES ေ.
    expect(isZawgyiWord('စေတနာ')).toBe(false)
    expect(isZawgyiWord('တောင်ကြီး')).toBe(false)
  })
})

describe('myanmarSearch: PostgREST filter construction', () => {
  it('buildOrFilter covers both encodings on every field', () => {
    const f = buildOrFilter(['name', 'name_mm'], ['မော်ခမ်း'])
    expect(f).toContain('name_mm.ilike.%မော်ခမ်း%')
    expect(f).toContain('name_mm.ilike.%ေမာ္ခမ္း%')
    expect(f).toContain('name.ilike.%မော်ခမ်း%')
  })

  it('buildOrFilter still escapes PostgREST specials', () => {
    const f = buildOrFilter(['name'], ['100%'])
    expect(f).toContain('name.ilike.%100\\%%')
  })

  it('buildOrFilter with an English word is exactly the old single-term filter', () => {
    expect(buildOrFilter(['name', 'name_mm'], ['upper'])).toBe(
      'name.ilike.%upper%,name_mm.ilike.%upper%'
    )
  })
})
