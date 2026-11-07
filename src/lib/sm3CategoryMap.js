// sm3 Category Mapping — Cherry Directory v9.26.
//
// Maps an incoming sm3dir sub-category string to the right Directory
// category (the category's English `name`, which BulkImportPage's catMap
// matches case-insensitively; for အထွေထွေ there is no English name, so
// the Myanmar name itself is returned).
//
// SOURCE OF TRUTH: the 874 sm3dir Category 23 (General Services) shops in
// ~/workspace/sm3dir-category-23/ngwesaryin-public-shops-sm3dir-874.json.
// Every shop carries ONE `subCategory` string (15 shops carry a ';'
// -joined list — the FIRST segment is the primary category, the rest stay
// visible in description_mm). The 9 distinct values are:
//
//   Real Estate                          330 (+1 multi-primary = 331)
//   Car Rental Service                   179 (+4 multi-primary = 183)
//   Advertising Agency                   135
//   Oversea Employment Service            83
//   Insurance Agent                       42
//   Seaman & Shipping Employment Service  33
//   Local Employment Service              30 (+7 multi-primary = 37)
//   General Services                      23 (+3 multi-primary = 26)
//   Custom Clearance Agents                4
//
// NEW CATEGORIES (created by supabase-migration-9.26.sql — run it in the
// Supabase SQL Editor AFTER deploy, BEFORE importing the CSV):
//   Top-level: Real Estate (အိမ်ခြံမြေ), Advertising Agency
//     (ကြော်ငြာအေဂျင်စီ), Employment Services (အလုပ်အကိုင်ဝန်ဆောင်မှု)
//   Sub-categories: Car Rental Service (ကားငှားဝန်ဆောင်မှု, under
//     Taxi & Transport), Insurance (အာမခံ, under Finance & Banking),
//     Custom Clearance (အကောက်ခွန်ရှင်းလင်းရေး, under Delivery Service),
//     Oversea / Local / Seaman & Shipping Employment Service (under
//     Employment Services).
//   General Services genuinely belongs in the existing အထွေထွေ category
//   (26 rows) — it is the ONLY value mapped there, never a fallback.
//
// UNMAPPED CONTRACT: mapSm3Category returns null for anything it cannot
// map. It NEVER silently falls back to အထွေထွေ — the import must list an
// unmapped row as a per-row failure (BulkImportPage already does this for
// a category with no catMap entry).
//
// The module is deliberately standalone: BulkImportPage.jsx is owned by
// another worker, so this file is NOT wired in here. Integration is one
// call — resolve the CSV row's category through mapSm3Category() first,
// and only if it returns null fall back to the import's existing catMap
// lookup (which covers live categories added via the Admin panel that
// this file cannot know about).

import { zg2uni, uni2zg } from './rabbit.js'

// ---------------------------------------------------------------------------
// The mapping table. `name` is the Directory category's English `name`
// (what the CSV category column carries); `nameMm` is its Myanmar
// `name_mm`. `raw` lists every incoming sm3 string that maps to it.
// ---------------------------------------------------------------------------
export const SM3_CATEGORY_MAP = [
  {
    name: 'Real Estate',
    nameMm: 'အိမ်ခြံမြေ',
    raw: ['Real Estate'],
  },
  {
    name: 'Car Rental Service',
    nameMm: 'ကားငှားဝန်ဆောင်မှု',
    raw: ['Car Rental Service'],
  },
  {
    name: 'Advertising Agency',
    nameMm: 'ကြော်ငြာအေဂျင်စီ',
    raw: ['Advertising Agency'],
  },
  {
    name: 'Oversea Employment Service',
    nameMm: 'ပြည်ပအလုပ်အကိုင်',
    raw: ['Oversea Employment Service'],
  },
  {
    name: 'Local Employment Service',
    nameMm: 'ပြည်တွင်းအလုပ်အကိုင်',
    raw: ['Local Employment Service'],
  },
  {
    name: 'Seaman & Shipping Employment Service',
    nameMm: 'သင်္ဘောသားအလုပ်အကိုင်',
    raw: ['Seaman & Shipping Employment Service'],
  },
  {
    name: 'Insurance',
    nameMm: 'အာမခံ',
    raw: ['Insurance Agent'],
  },
  {
    name: 'Custom Clearance',
    nameMm: 'အကောက်ခွန်ရှင်းလင်းရေး',
    raw: ['Custom Clearance Agents'],
  },
  {
    // Genuinely general — the ONLY value that maps to အထွေထွေ.
    // NOTE (verify live): အထွေထွေ is not in the repo's category seed —
    // the repo seed has 20 directory categories and the live DB is
    // reported to have 41. The delivered CSV already used အထွေထွေ, so
    // it is assumed to exist live; confirm in the live DB before
    // importing, or these 26 rows fail validation as "not found".
    name: 'အထွေထွေ',
    nameMm: 'အထွေထွေ',
    raw: ['General Services'],
  },
]

// ---------------------------------------------------------------------------
// Pass-through: existing seeded Directory categories. If a row already
// carries one of these (English name, any case, or Myanmar name in either
// encoding) it passes through unchanged, normalised to the canonical
// English `name`. Live-only categories added later via the Admin panel
// are NOT listed here — the import's own catMap lookup covers those.
// ---------------------------------------------------------------------------
export const EXISTING_CATEGORY_PASSTHROUGH = [
  // v9.27: 'Restaurant & Food' is the OLD seed name — it does not exist
  // live (the 9.27 migration renames that category to name='Restaurant',
  // name_mm stays 'စားသောက်ဆိုင်'). Mapping the Myanmar name to the dead
  // seed name made CSV rows carrying 'စားသောက်ဆိုင်' fail as "not found",
  // where the BulkImportPage catMap fallback (by name_mm) would have
  // resolved them. Both the live name and the old seed name now map to
  // 'Restaurant', so old-seed-named rows still resolve.
  { name: 'Restaurant', nameMm: 'စားသောက်ဆိုင်', aliases: ['Restaurant & Food'] },
  { name: 'Hotel & Accommodation', nameMm: 'တည်းခိုရေး' },
  { name: 'Hospital & Clinic', nameMm: 'ဆေးရုံ/ကလင်းနစ်' },
  { name: 'Education & School', nameMm: 'ကျောင်း/ပညာရေး' },
  { name: 'Shopping & Retail', nameMm: 'ဈေးဝယ်/လက်လီရောင်းချ' },
  { name: 'Finance & Banking', nameMm: 'ဘဏ်/ငွေကြေး' },
  { name: 'Entertainment', nameMm: 'ဖျော်ဖြေရေး' },
  { name: 'Beauty & Salon', nameMm: 'အလှပြင်ဆိုင်' },
  { name: 'Other Business', nameMm: 'အခြား လုပ်ငန်းများ' },
  { name: 'Tutor & Private Teacher', nameMm: 'ကိုယ်ပိုင်ဆရာ/မ (Tutor)' },
  { name: 'Cleaning Service', nameMm: 'သန့်ရှင်းရေး/အိမ်ရှင်း' },
  { name: 'Laundry Service', nameMm: 'အဝတ်လျှော်ဝန်ဆောင်မှု' },
  { name: 'Plumbing & Electric', nameMm: 'ရေပိုက်/မီးပြင်ဝန်ဆောင်မှု' },
  { name: 'Construction & Repair', nameMm: 'ဆောက်လုပ်ရေး/ပြုပြင်' },
  { name: 'Delivery Service', nameMm: 'ပို့ဆောင်ရေး Delivery' },
  { name: 'Taxi & Transport', nameMm: 'Taxi/ယာဉ်ငှားရမ်း' },
  { name: 'Other Service', nameMm: 'အခြား ဝန်ဆောင်မှု' },
  { name: 'Property Rent & Sale', nameMm: 'အိမ်ငှား/အိမ်ရောင်း' },
  { name: 'Vehicle Sale', nameMm: 'ကား/ဆိုင်ကယ် ရောင်းချ' },
  { name: 'Second Hand Items', nameMm: 'ပစ္စည်းအသုံးအဆောင် ရောင်းဝယ်' },
]

// Lookup: normalised input -> canonical Directory category `name`.
// Keys cover the raw English value (lowercased), the Myanmar name in
// Unicode AND in Zawgyi, so a Zawgyi-typed Myanmar value still maps.
function buildLookup() {
  const map = new Map()
  const add = (key, canonical) => {
    if (!key) return
    const k = key.trim().toLowerCase()
    if (k && !map.has(k)) map.set(k, canonical)
  }
  for (const entry of SM3_CATEGORY_MAP) {
    for (const rawValue of entry.raw) add(rawValue, entry.name)
    // The Myanmar name itself (either encoding) also resolves.
    add(entry.nameMm, entry.name)
    add(zg2uni(entry.nameMm), entry.name)
    add(uni2zg(entry.nameMm), entry.name)
  }
  for (const entry of EXISTING_CATEGORY_PASSTHROUGH) {
    add(entry.name, entry.name)
    add(entry.nameMm, entry.name)
    // v9.27: old names kept as aliases (e.g. 'Restaurant & Food' →
    // 'Restaurant' after the live rename) so rows carrying the old
    // seed name still resolve instead of failing as "not found".
    for (const alias of entry.aliases || []) add(alias, entry.name)
    add(zg2uni(entry.nameMm), entry.name)
    add(uni2zg(entry.nameMm), entry.name)
  }
  return map
}

const LOOKUP = buildLookup()

// A ';'-joined sm3 value lists several sub-categories — the FIRST is the
// primary one (the rest stay visible in description_mm).
function primarySegment(raw) {
  return String(raw).split(';')[0].trim()
}

/**
 * Map an incoming raw category string to its Directory category.
 *
 * @param {string|null|undefined} raw — e.g. 'Real Estate',
 *   'Local Employment Service; Real Estate', '  car rental service  ',
 *   or a Myanmar name in Unicode or Zawgyi.
 * @returns {string|null} the Directory category `name` to put in the CSV
 *   `category` column (e.g. 'Real Estate', 'အိမ်ခြံမြေ' never — the
 *   English name, except 'အထွေထွေ' which has no English name), or
 *   `null` when the value cannot be mapped. Null is the unmapped signal:
 *   the caller must report the row as a failure, never fall back to
 *   အထွေထွေ.
 */
export function mapSm3Category(raw) {
  if (raw === null || raw === undefined) return null
  const first = primarySegment(raw)
  if (!first) return null
  const key = first.toLowerCase()
  if (LOOKUP.has(key)) return LOOKUP.get(key)
  // Myanmar input in the other encoding: try both conversions.
  const asUnicode = zg2uni(first)
  if (LOOKUP.has(asUnicode.toLowerCase())) return LOOKUP.get(asUnicode.toLowerCase())
  const asZawgyi = uni2zg(first)
  if (LOOKUP.has(asZawgyi.toLowerCase())) return LOOKUP.get(asZawgyi.toLowerCase())
  return null
}

export default mapSm3Category
