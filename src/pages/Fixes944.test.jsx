// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// v9.44 — STALE ROW AFTER A CATEGORY MOVE + direct-row rename.
// User report (2026-11-15 ~10:28 MMT): one Pharmacy listing moved
// from Health's direct list (38 rows) to the Pharmacy sub-category
// (2 rows). The picker counts updated at once (38 -> 37, 2 -> 3)
// but re-entering the direct list the shop was STILL listed, its
// Sub Cat already showing Pharmacy.
//
// Root cause (proved by debug logging, see DirectoryPage944.test.jsx
// and the 9.44 report): hydration (9.39) merged the cached pages
// and advanced the page to the last one, and the fresh page-0
// refetch — the one carrying the move — never reached the apply
// effect at all: keepPreviousData never re-delivers a previous
// query's refetched data, so the page guard was never even the
// problem. Fix:
//   (a) hydration NO LONGER advances the page past 0 (appliedDataRef
//       = pages[0], chain re-walks from 0): the page-0 refetch lands
//       as the ACTIVE query's data and reaches the apply effect;
//   (b) the apply effect only replaces a hydrated list when the
//       fresh page-0 payload actually DIFFERS (row ids, then total)
//       — an unconditional replace would collapse every warm
//       re-entry from 172 rows back to 20 and make the chain climb
//       all over again (the 9.39 instant list, undone on entry);
//   (c) data from ANOTHER filter never applies (stale keepPreviousData
//       placeholder) — the wipe re-triggers the effect, and with
//       appliedDataRef just nulled the placeholder re-applied and
//       stranded the old rows under the new header (9.39 (B));
//   (d) ONLY a page-0 payload for this filter sets the total — a
//       stale cached page > 0 (old persisted entry, pre-9.43 shape)
//       still carries its old total and must not overwrite the fresh
//       page-0 total (37 rows / 38 total after a move).
// The behaviour proof lives in DirectoryPage944.test.jsx (4 cases:
// direct->sub, sub->direct, between subs, single-page self-heal);
// this file pins the source shape + the rename + the changelog.
// The rename: the direct-only row was labelled "အားလုံး" (All),
// which reads as if it listed everything — it is now
// "အမျိုးအစားခွဲ မရှိ" / "No sub-category" with the explanatory
// sublabel, plus the same line under the list heading.
//
// NOTE: this file has NO filesystem-path comparisons at all (no
// path.relative / path.join / readdir comparisons on file paths) —
// the only node:path use is locating source files /
// version-changes.json / Header.jsx / package.json for static
// assertions, read with readFileSync, never compared as paths —
// so the 9.19/9.25 backslash-path rule does not apply here.

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const rootDir = join(srcDir, '..')
const src = (rel) => readFileSync(join(srcDir, rel), 'utf8')

beforeEach(() => { cleanup() })
afterEach(() => { cleanup() })

describe('v9.44 (A) STALE ROW — hydration stays on page 0, fresh page-0 replaces only on a real change', () => {
  it('hydration merges cached pages without advancing the page; the apply effect diff-guards, same-filter-guards, and takes the total from page 0 only', () => {
    const page = src('pages/DirectoryPage.jsx')
    // (a) Hydration shows the full cached list at once but leaves the
    // page at 0, so the page-0 refetch lands as the ACTIVE query's
    // data. The 9.39 page advance is gone.
    expect(page).toContain('appliedDataRef.current = pages[0]')
    expect(page).not.toContain('setPage(last.page)')
    expect(page).not.toContain('pageRef.current = last.page')
    expect(page).toContain('setTotal(pages[0]?.total || 0)')
    // The chain still re-walks from page 0 through cached pages
    // (each append dedupes) and then fetches only the missing ones.
    expect(page).toContain('pageRef.current += 1')
    expect(page).toContain('setPage(pageRef.current)')
    // (b) A fresh page-0 payload that lands while the hydrated list
    // is on screen only replaces when it differs (row ids, then
    // total) — identical payloads keep the hydrated list.
    expect(page).toContain('isHydratedPage0')
    expect(page).toContain('listingsData.page === 0 && listingsData.filterKey === filterKey && listings.length > listingsData.rows.length')
    expect(page).toContain('if (sameRows && listingsData.total === total) return')
    // (c) Data from another filter never applies (stale placeholder).
    expect(page).toContain('if (listingsData.filterKey !== filterKey) return')
    // (d) Only a page-0 payload for this filter sets the total.
    expect(page).toContain('if (listingsData.page === 0 && listingsData.filterKey === filterKey && listingsData.total != null) setTotal(listingsData.total)')
    expect(page).not.toContain('if (listingsData.total != null) setTotal(listingsData.total)')
    // 9.31 preservation: page 0 still always counts and always
    // fetches rows — staleTime: 0 + refetchOnMount: 'always' untouched.
    expect(page).toContain("refetchOnMount: 'always'")
    expect(page).toContain('staleTime: 0')
  })
})

describe('v9.44 (B) RENAME — the direct-only row is "အမျိုးအစားခွဲ မရှိ", not "အားလုံး"', () => {
  it('DirectoryPage picker row + list heading are lang-aware; the listing forms use the new alias; genuinely-all labels untouched', () => {
    const page = src('pages/DirectoryPage.jsx')
    // Picker row: lang-aware main label + explanatory sublabel.
    expect(page).toContain("{lang === 'mm' ? 'အမျိုးအစားခွဲ မရှိ' : 'No sub-category'}")
    expect(page).toContain("{lang === 'mm' ? 'အမျိုးအစားခွဲ မသတ်မှတ်ရသေးသော ဆိုင်များ' : 'Shops with no sub-category'}")
    // The old hardcoded row is gone (exact old markup, not the
    // genuinely-all labels elsewhere in the file).
    expect(page).not.toContain('<p className="font-display font-semibold text-white truncate">အားလုံး</p>')
    expect(page).not.toContain('<p className="text-[10px] text-white/60 font-myanmar truncate">All listings</p>')
    // List heading: the same sublabel line under the H1, direct-only.
    expect(page).toContain('selectedSubcategory?.is_direct && (')
    // Listing forms: the parent-itself option carries the new alias.
    const submit = src('pages/SubmitListingPage.jsx')
    const edit = src('pages/EditListingPage.jsx')
    expect(submit).toContain('(အမျိုးအစားခွဲ မရှိ)</option>')
    expect(edit).toContain('(အမျိုးအစားခွဲ မရှိ)</option>')
    expect(submit).not.toContain('(အားလုံး)</option>')
    expect(edit).not.toContain('(အားလုံး)</option>')
    // Genuinely-all labels are untouched: the city filter still says
    // အားလုံး, and the Home tiles / see-all links still do.
    expect(page).toContain("'📍 အားလုံး'")
    const home = src('pages/HomePage.jsx')
    expect(home).toContain("lang === 'mm' ? 'အားလုံး' : 'All'")
  })
})

// v9.44 (F) CHANGELOG — the 9.44 entry in version-changes.json matches
// the Header.jsx history entry (Burmese), zero Admin, and the offline
// fallback leads with the same items. Follows the 9.43 (F) pattern;
// the current-version pins moved here from Fixes943.test.jsx.
const CHANGES_MY_944 = [
  'အမျိုးအစား ပြောင်းလိုက်တဲ့ လုပ်ငန်းကို အဟောင်းစာရင်းမှာ ဆက်မပြတော့ပါ — ပြောင်းလိုက်တာနဲ့ ချက်ချင်း ပျောက်သွားမည်',
  'အမျိုးအစားခွဲ မသတ်မှတ်ရသေးတဲ့ ဆိုင်တွေကို "အားလုံး" လို့ မပြတော့ဘဲ "အမျိုးအစားခွဲ မရှိ" လို့ ပြမည်',
  'စာရင်းအပေါ်က အရေအတွက် (ဥပမာ 37/37) လည်း ပြောင်းလိုက်တဲ့ အတိုင်း ချက်ချင်း မှန်သွားမည်',
]
const CHANGES_EN_944 = [
  'A listing moved to another category disappears from the old list at once — no more stale row after a category change',
  'Shops with no sub-category are no longer called "အားလုံး" — the row is now "အမျိုးအစားခွဲ မရှိ" (No sub-category)',
  'The count above the list (e.g. 37/37) now follows the move at once too',
]

describe('v9.44 (F) CHANGELOG — 9.44 entry, Header match, zero Admin', () => {
  it('(F) version-changes.json 9.44 entry matches the Header.jsx 9.44 entry, zero Admin', () => {
    const changes = JSON.parse(readFileSync(join(rootDir, 'version-changes.json'), 'utf8'))
    expect(changes['9.44']).toBeTruthy()
    expect(changes['9.44'].changesMy).toEqual(CHANGES_MY_944)
    expect(changes['9.44'].changesEn).toEqual(CHANGES_EN_944)
    const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
    expect(pkg.version).toBe('9.44')
    const header = readFileSync(join(srcDir, 'components', 'Header.jsx'), 'utf8')
    expect(header).toContain("{ v: '9.44', date: '2026-11-15'")
    for (const item of CHANGES_MY_944) {
      expect(header).toContain(item)
    }
    const entry = header.slice(header.indexOf("{ v: '9.44'"), header.indexOf("{ v: '9.43'"))
    expect(entry).not.toMatch(/Admin/i)
    expect(JSON.stringify(changes['9.44'])).not.toMatch(/Admin/i)
    // The modal's lead block (v{APP_VERSION} badge) must carry the
    // CURRENT version's date, not the previous version's.
    const lead = header.slice(header.indexOf('v{APP_VERSION}'), header.indexOf("{ v: '9.44'"))
    expect(lead).toContain('2026-11-15')
    // The offline fallback constant carries the same 9.44 items.
    expect(header).toContain('LEAD_FALLBACK_MY_944')
    const fallback = header.slice(header.indexOf('LEAD_FALLBACK_MY_944 = ['), header.indexOf('LEAD_FALLBACK_MY_944 = [') + 2000)
    for (const item of CHANGES_MY_944) {
      expect(fallback).toContain(item)
    }
  })
})
