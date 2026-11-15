// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// v9.43 — Disk IO fix. Supabase warned the project is depleting its
// daily Disk IO Budget; the data is small (2,186 approved listings),
// the cause is query patterns:
//   (a) the listings query ran a full count scan on EVERY page (9
//       scans for Car Rental) and on every background refetch — now
//       the count is requested on page 0 only;
//   (b) Home / Directory ran one head-count per top-level category
//       (~20 parallel scans) — now one aggregated RPC, with a
//       fallback to the old per-category counts when the 9.43
//       migration has not run yet;
//   (c) Chat polled for new messages every 20 s on the proxied
//       origin — now every 60 s, skipped while hidden;
//   (d) the 9.43 migration adds the hot-path composite index,
//       trigram indexes for substring search, and the
//       get_category_listing_counts() RPC (manual SQL step after
//       deploy — the app works without it, via the fallbacks).
//
// NOTE: this file has NO filesystem-path comparisons at all (no
// path.relative / path.join / readdir comparisons on file paths) —
// the only node:path use is locating source files /
// version-changes.json / Header.jsx / package.json / the migration
// file for static assertions, read with readFileSync, never
// compared as paths — so the 9.19/9.25 backslash-path rule does not
// apply here.

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const rootDir = join(srcDir, '..')
const src = (rel) => readFileSync(join(srcDir, rel), 'utf8')

beforeEach(() => { cleanup() })
afterEach(() => { cleanup() })

describe('v9.43 (A) COUNT ONCE — DirectoryPage asks for the count on page 0 only', () => {
  it('page 0 requests count:\'exact\', later pages return total: null, and neither guard lets null wipe the total', () => {
    const page = src('pages/DirectoryPage.jsx')
    expect(page).toContain(".select('*, category:categories(name, name_mm, icon)', pageF === 0 ? { count: 'exact' } : {})")
    expect(page).toContain('total: pageF === 0 ? (count || 0) : null')
    // The apply effect keeps the page-0 total when a later page
    // lands with total: null — setTotal(0) would collapse the ring
    // and stop the chain.
    expect(page).toContain('if (listingsData.total != null) setTotal(listingsData.total)')
    // Hydration reads the total from page 0, not the last page
    // (which now carries total: null).
    expect(page).toContain('setTotal(pages[0]?.total || 0)')
    // Old shapes are gone.
    expect(page).not.toContain(".select('*, category:categories(name, name_mm, icon)', { count: 'exact' })")
    expect(page).not.toContain('setTotal(last.total || 0)')
    expect(page).not.toContain('total: count || 0, page: pageF')
    // 9.31 preservation: page 0 still always counts and always
    // fetches rows — staleTime: 0 + refetchOnMount: 'always' untouched.
    expect(page).toContain("refetchOnMount: 'always'")
    expect(page).toContain('staleTime: 0')
  })
})

describe('v9.43 (B) CATEGORY COUNTS — one aggregated RPC, fallback when the migration has not run', () => {
  it('fetchCategories + loadSubcategories use the RPC helper; the fallback path is still there', () => {
    const prefetch = src('lib/prefetch.js')
    expect(prefetch).toContain("supabase.rpc('get_category_listing_counts')")
    expect(prefetch).toContain('export async function fetchListingCountsByCategory()')
    expect(prefetch).toContain('export function sumDescendantCounts(')
    // RPC unavailable (migration not run yet) → null → callers fall
    // back to the old per-category counts; the warn names the cause.
    expect(prefetch).toContain('falling back to per-category counts')
    expect(prefetch).toContain('return null')
    // The old per-category fallback still exists, including its
    // resolve-with-error → listing_count null rule (v9.25 regen #5).
    expect(prefetch).toContain("select('*', { count: 'exact', head: true })")
    expect(prefetch).toContain('listing_count: null')
    expect(prefetch).toContain('sumDescendantCounts(allCats || [], countById, cat.id)')
    const page = src('pages/DirectoryPage.jsx')
    expect(page).toContain('fetchListingCountsByCategory')
    expect(page).toContain('sumDescendantCounts(treeCats, countById, sub.id)')
  })
})

describe('v9.43 (C) CHAT POLL — 60 s, skipped while hidden', () => {
  it('the poll interval is 60000 with a document.hidden guard; no 20 s poll remains', () => {
    const chat = src('pages/ChatPage.jsx')
    expect(chat).toContain('setInterval(() => { if (isSubscribed && !document.hidden) loadMessages() }, 60000)')
    expect(chat).not.toContain('loadMessages() }, 20000')
    expect(chat).not.toContain('}, 20000)')
  })
})

describe('v9.43 (D) MIGRATION — indexes + count RPC, idempotent, manual step after deploy', () => {
  it('supabase-migration-9.43.sql has the 5 indexes, the RPC, the grant, and ANALYZE', () => {
    const sql = readFileSync(join(rootDir, 'supabase', 'supabase-migration-9.43.sql'), 'utf8')
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS listings_status_category_city_idx')
    expect(sql).toContain('ON public.listings (status, category_id, city)')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS listings_name_trgm_idx')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS listings_name_mm_trgm_idx')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS listings_description_trgm_idx')
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS listings_description_mm_trgm_idx')
    expect(sql).toContain('extensions.gin_trgm_ops')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_category_listing_counts()')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.get_category_listing_counts() TO anon, authenticated')
    expect(sql).toContain('ANALYZE public.listings')
    // Idempotent throughout: safe to run twice.
    expect(sql).toContain('safe to run twice')
    // No data changes, no policies, no triggers.
    expect(sql).not.toMatch(/CREATE POLICY|ALTER TABLE|DROP TABLE|DELETE FROM/i)
  })
})

// v9.43 (F) CHANGELOG — the 9.43 entry in version-changes.json matches
// the Header.jsx history entry (Burmese), zero Admin, and the offline
// fallback leads with the same items. Follows the 9.42 (F) pattern;
// the current-version pins moved here from Fixes942.test.jsx.
const CHANGES_MY_943 = [
  'လုပ်ငန်းစာရင်း ဖွင့်တာ ပိုမြန်လာမည် — စာရင်း အရှည်ကြီးလည်း တစ်ခါတည်း တင်ပြီးသား ဖြစ်မည်',
  'အမျိုးအစားတစ်ခုချင်းစီရဲ့ လုပ်ငန်းအရေအတွက်ကို တစ်ခါတည်း တွက်ပြမည်',
  'စကားပြောခန်းမှာ မက်ဆေ့ချ် အသစ် စစ်တာ ၆၀ စက္ကန့်တစ်ခါ ဖြစ်သွားမည်',
]
const CHANGES_EN_943 = [
  'Lists open faster — long lists still load fully in the background',
  'Category counts are now computed in a single query',
  'Chat checks for new messages every 60 seconds',
]

describe('v9.43 (F) CHANGELOG — 9.43 entry, Header match, zero Admin', () => {
  it('(F) version-changes.json 9.43 entry matches the Header.jsx 9.43 entry, zero Admin', () => {
    const changes = JSON.parse(readFileSync(join(rootDir, 'version-changes.json'), 'utf8'))
    expect(changes['9.43']).toBeTruthy()
    expect(changes['9.43'].changesMy).toEqual(CHANGES_MY_943)
    expect(changes['9.43'].changesEn).toEqual(CHANGES_EN_943)
    const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
    expect(pkg.version).toBe('9.43')
    const header = readFileSync(join(srcDir, 'components', 'Header.jsx'), 'utf8')
    expect(header).toContain("{ v: '9.43', date: '2026-11-15'")
    for (const item of CHANGES_MY_943) {
      expect(header).toContain(item)
    }
    const entry = header.slice(header.indexOf("{ v: '9.43'"), header.indexOf("{ v: '9.42'"))
    expect(entry).not.toMatch(/Admin/i)
    expect(JSON.stringify(changes['9.43'])).not.toMatch(/Admin/i)
    // The modal's lead block (v{APP_VERSION} badge) must carry the
    // CURRENT version's date, not the previous version's.
    const lead = header.slice(header.indexOf('v{APP_VERSION}'), header.indexOf("{ v: '9.43'"))
    expect(lead).toContain('2026-11-15')
    // The offline fallback constant carries the same 9.43 items.
    expect(header).toContain('LEAD_FALLBACK_MY_943')
    const fallback = header.slice(header.indexOf('LEAD_FALLBACK_MY_943 = ['), header.indexOf('LEAD_FALLBACK_MY_943 = [') + 2000)
    for (const item of CHANGES_MY_943) {
      expect(fallback).toContain(item)
    }
  })
})
