// Myanmar search — Zawgyi / Unicode dual-encoding (v9.20).
//
// LIVE EVIDENCE (2026-11-05, against the production database):
// the stored listing names are MIXED encoding. At least 22 name_mm rows
// carry hard Zawgyi signatures (e.g. 'ေမာ္ခမ္းစားေသာက္ဆိုင္'), while
// iOS/Android keyboards type Unicode. PostgREST ilike is byte-exact, so a
// Unicode query can never match a Zawgyi-stored row:
//   ilike %မော်ခမ်း% (Unicode) -> []   — the restaurant exists
//   ilike %ေမာ္ခမ္း% (Zawgyi)  -> the row
//   ilike %ကော်%   (Unicode, control) -> exactly the 3 Unicode rows
// The proxy is NOT the cause (direct API shows the same behaviour), and
// name_mm WAS already queried (SearchPage searchFields) — the encoding
// mismatch is why it did not match. The fix: every Myanmar query word is
// also searched in its alternate encoding.
//
// Two honest limits, found the same day: the reported strings 'မွန်မွန်'
// and 'ကော်ဖီ' exist NOWHERE in the live listings table — not in any text
// field, in either encoding — and no category is named 'ကော်ဖီဆိုင်', so
// even a perfect dual-encoding query still returns 0 for those two words
// until such a listing/category exists. What this fix removes is the
// encoding barrier (proven by မော်ခမ်း) and the category barrier (a query
// matching a category name now also returns that category's listings).
// Live re-check should use a word that exists, e.g. 'မော်ခမ်း' or
// 'လဖက်ရည်ဆိုင်'.

import { uni2zg, zg2uni } from './rabbit.js'
import { escapePostgrestOr } from '../hooks/useListings.js'

// Zawgyi detection — two patterns that are IMPOSSIBLE in valid Unicode:
//  - U+1031 (ေ) not directly preceded by a consonant (U+1000–U+1021):
//    in Unicode the preposed vowel always follows its consonant; in
//    Zawgyi it is stored BEFORE it, so a word starting with ေ, or ေ after
//    a vowel sign / space, is Zawgyi. (Careful: the naive check "1031
//    followed by a consonant" is WRONG — valid Unicode 'စေတနာ' has
//    exactly that.)
//  - U+1039 (virama) not directly followed by a consonant: in Unicode it
//    always stacks the next consonant, so a word-final 1039, or 1039
//    before a space / vowel sign, is Zawgyi (its asat).
// A Zawgyi word with neither signature (e.g. one with no asat and no
// preposed vowel) is usually byte-identical to its Unicode form anyway,
// so missing it costs nothing.
export function isZawgyiWord(word) {
  if (!word) return false
  return /(^|[^\u1000-\u1021])\u1031/.test(word) ||
    /\u1039($|[^\u1000-\u1021])/.test(word)
}

export function hasMyanmarChars(word) {
  return /[\u1000-\u109F]/.test(word || '')
}

// All encodings of one query word to search: the word itself, plus its
// alternate-encoding form — but ONLY when the conversion round-trips.
// The converters are near-inverses, so converting the WRONG way produces
// a plausible-looking garbage string that sometimes round-trips too
// (e.g. zg2uni('မွန်မွန်') = 'မှနျမှနျ'); detecting the input encoding
// first and converting one way only keeps the garbage out.
export function myanmarVariants(word) {
  if (!word) return []
  if (!hasMyanmarChars(word)) return [word]
  const out = [word]
  if (isZawgyiWord(word)) {
    const uni = zg2uni(word)
    if (uni !== word && uni2zg(uni) === word) out.push(uni)
  } else {
    const zg = uni2zg(word)
    if (zg !== word && zg2uni(zg) === word) out.push(zg)
  }
  return out
}

// PostgREST .or() filter string for `words` across `fields`, with every
// Myanmar word searched in both encodings. Each word's field-group is one
// OR group; callers AND groups per word (successive .or() calls) exactly
// like the v9.18 multi-word search.
export function buildOrFilter(fields, words) {
  const terms = []
  for (const word of words) {
    for (const variant of myanmarVariants(word)) {
      const esc = escapePostgrestOr(variant)
      for (const field of fields) terms.push(`${field}.ilike.%${esc}%`)
    }
  }
  return terms.join(',')
}
