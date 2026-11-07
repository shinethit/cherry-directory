import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// v9.25 REGENERATION — delete fixes (user reported 5 delete bugs on live
// 9.23, iPhone): (1) staleness — delete invalidates the cached queries;
// (2) points — deleting no longer deducts points (9.25 migration);
// (3+4) navigation — one step back to the list the admin came from;
// (5) bulk delete — Admin-only multi-select delete on the listings tab.
// Source assertions follow the fixes925.test.js patterns.

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(srcDir, rel), 'utf8')

function changelogEntry(header, v, nextV) {
  const start = header.indexOf(`{ v: '${v}'`)
  expect(start).toBeGreaterThan(-1)
  const end = nextV ? header.indexOf(`{ v: '${nextV}'`, start) : header.length
  return header.slice(start, end === -1 ? header.length : end)
}

describe('v9.25 delete: staleness — invalidation inside deleteListingWithCleanup', () => {
  it('deleteListing.js invalidates all 7 prefix keys, after success only', () => {
    const src = read('lib/deleteListing.js')
    for (const key of ['categories', 'listings', 'bookmarks', 'profile-stats', 'profile-month-points', 'leaderboard', 'reviews']) {
      expect(src).toContain(`'${key}'`)
    }
    expect(src).toContain('invalidateQueries')
    expect(src).toContain('queryClient.invalidateQueries')
    // Invalidation lives in the shared helper (not in the callers), and
    // the throw on listing-delete failure comes before it — a failed
    // delete invalidates nothing.
    expect(src.indexOf("if (error) throw error")).toBeLessThan(src.indexOf('invalidateQueries'))
  })
})

describe('v9.25 delete: points — 9.25 migration keeps points, decrements counters', () => {
  it('supabase-migration-9.25.sql redefines both triggers without reversal rows', () => {
    const sql = readFileSync(join(srcDir, '..', 'supabase', 'supabase-migration-9.25.sql'), 'utf8')
    expect(sql).toContain('handle_listing_deleted_points')
    expect(sql).toContain('handle_review_deleted_points')
    expect(sql).toContain('total_listings = greatest(0, total_listings - 1)')
    expect(sql).toContain('total_reviews = greatest(0, total_reviews - 1)')
    expect(sql).not.toContain("'submit_listing', -10")
    expect(sql).not.toContain("'listing_approved', -20")
    expect(sql).not.toContain("'write_review', -5")
    expect(sql).toContain('drop trigger if exists on_listing_deleted_points on public.listings')
    expect(sql).toContain('drop trigger if exists on_review_deleted_points on public.reviews')
    expect(sql).toContain('security definer')
    // Header explains the decision + that historical damage is NOT repaired here.
    expect(sql).toContain('2026-11-06')
    expect(sql).toContain('NOT REPAIRED')
  })

  it('no UI string still promises a points deduction on delete', () => {
    expect(read('lib/deleteListing.js')).not.toContain('ပြန်နှုတ်မည်')
    // PointsGuide history comment now says only RSVP reversals occur.
    expect(read('pages/PointsGuidePage.jsx')).toContain('only RSVP reversals still occur')
    // AdminPage handleDelete comment now cites 9.25, not 9.17 triggers.
    expect(read('pages/AdminPage.jsx')).toContain('v9.25: deleting keeps earned points')
  })
})

describe('v9.25 delete: navigation — one step back', () => {
  it('ListingDetailPage handleDeleteListing uses goBackOrHome, not navigate("/directory")', () => {
    const detail = read('pages/ListingDetailPage.jsx')
    expect(detail).toContain("import { goBackOrHome } from '../lib/navigation'")
    const start = detail.indexOf('async function handleDeleteListing()')
    expect(start).toBeGreaterThan(0)
    const end = detail.indexOf('async function handleReport()', start)
    const fn = detail.slice(start, end === -1 ? detail.length : end)
    expect(fn).toContain('goBackOrHome(navigate, \'/directory\')')
    expect(fn).not.toContain("navigate('/directory')")
    expect(fn).not.toContain('navigate(-1)')
  })
})

describe('v9.25 delete: bulk delete — AdminPage', () => {
  it('has the bulk state and per-row checkboxes, Admin-gated', () => {
    const admin = read('pages/AdminPage.jsx')
    expect(admin).toContain('selectedIds')
    expect(admin).toContain('useState(new Set())')
    expect(admin).toContain('bulkDeleting')
    expect(admin).toContain('type="checkbox"')
    // The per-row checkbox lives inside an {isAdmin && ...} gate:
    // anchor on its onChange handler, not the first checkbox in the
    // file (the quick-links form has one earlier, ungated).
    const toggleIdx = admin.indexOf('toggleSelectListing(item.id)')
    expect(toggleIdx).toBeGreaterThan(0)
    expect(admin.lastIndexOf('{isAdmin && (', toggleIdx)).toBeGreaterThan(0)
    // ~44px hit area on the row checkbox label.
    expect(admin).toContain('className="w-11 h-11 flex items-center justify-center flex-shrink-0 cursor-pointer"')
    expect(admin).toContain('className="w-5 h-5"')
  })

  it('bulk bar: page-level select-all + count + bulk button, Admin-gated, no overflow-x-auto', () => {
    const admin = read('pages/AdminPage.jsx')
    expect(admin).not.toContain('overflow-x-auto')
    expect(admin).toContain('စာရင်းပါ {data.length} ခု အားလုံး ရွေးမည်')
    expect(admin).toContain('{selectedIds.size} ခု ရွေးထားသည်')
    expect(admin).toContain('ရွေးထားတာ ဖျက်မည် (${selectedIds.size})')
    expect(admin).toContain('ဖျက်နေသည်… (${bulkProgress.i}/${bulkProgress.total})')
    const barIdx = admin.indexOf('စာရင်းပါ {data.length} ခု အားလုံး ရွေးမည်')
    expect(admin.lastIndexOf('{isAdmin && (', barIdx)).toBeGreaterThan(0)
  })

  it('bulk handler guards, confirms once, loops via the shared helper, refreshes', () => {
    const admin = read('pages/AdminPage.jsx')
    expect(admin).toContain('deleteListingsBulk(supabase, targets,')
    expect(admin).toContain('deleteBulkConfirmMessage(names, targets.length)')
    expect(admin).toContain("title: `လုပ်ငန်း ${targets.length} ခု ဖျက်မည်`")
    expect(admin).toContain("confirmText: 'ဖျက်မည်'")
    expect(admin).toContain('if (!isAdmin || bulkDeleting || selectedIds.size === 0) return')
    expect(admin).toContain('data.filter(l => selectedIds.has(l.id))')
    const start = admin.indexOf('async function handleBulkDelete()')
    expect(start).toBeGreaterThan(0)
    const end = admin.indexOf('async function handleEdit(', start)
    const fn = admin.slice(start, end === -1 ? admin.length : end)
    expect(fn).toContain('loadListings()')
    expect(fn).toContain('loadDashboardStats()')
    expect(fn).toContain('onProgress')
    expect(fn).toContain('setDeleting(row?.id || null)')
    expect(fn).toContain('🗑️ ${result.succeeded.length} ခု ဖျက်ပြီးပါပြီ')
    // Failed ids stay selected: only succeeded ids are cleared.
    expect(fn).toContain('succeededIds')
  })

  it('filter chips, row buttons and Load more disable while bulkDeleting; selection clears on filter change', () => {
    const admin = read('pages/AdminPage.jsx')
    expect(admin).toContain('disabled={bulkDeleting}')
    expect(admin).toContain('disabled={listingBusy === item.id || bulkDeleting}')
    expect(admin).toContain('disabled={deleting === item.id || bulkDeleting}')
    expect(admin).toContain('setListingFilter(val); setSelectedIds(new Set())')
  })

  it('no inline listing-delete SQL outside the shared helper', () => {
    const admin = read('pages/AdminPage.jsx')
    expect(admin).not.toContain(".from('listings').delete()")
    expect(admin).toContain('deleteListingWithCleanup(supabase, id, { log })')
  })
})

describe('v9.25 delete: Change Log — one 9.25 entry, zero Admin', () => {
  it('the 9.25 entry carries the delete bullets and still has zero Admin mentions', () => {
    const header = read('components/Header.jsx')
    expect(header.match(/v: '9\.25'/g).length).toBe(1)
    const entry = changelogEntry(header, '9.25', '9.23')
    expect(entry).not.toMatch(/admin/i)
    expect(entry).toContain('ဖျက်လိုက်တဲ့ လုပ်ငန်း အရေအတွက် + စာရင်းတွေ ချက်ချင်း ပြောင်းမည်')
    expect(entry).toContain('ဖျက်လိုက်ရင် အမှတ် ပြန်မနှုတ်တော့ပါ')
    expect(entry).toContain('အရင်ကြည့်နေတဲ့ စာရင်းဆီ တစ်ဆင့်တည်း ပြန်ရောက်မည်')
    expect(entry).toContain('လုပ်ငန်း အများကြီး တစ်ခါတည်း ဖျက်လို့ရပြီ')
  })
})
