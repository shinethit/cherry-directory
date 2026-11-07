import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Route-audit guards (v9.20): static source assertions in the
// layout.test.js pattern. Each test pins one route-audit fix so a later
// edit cannot silently reintroduce the defect. File paths are relative
// to src/.

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(srcDir, rel), 'utf8')

describe('route audit v9.20: blocks-use defects', () => {
  it('M-SHAPE: fetchMarketPrices returns {prices, recent}, not a bare array', () => {
    const prefetch = read('lib/prefetch.js')
    expect(prefetch).toContain('return { prices: prices || [], recent: recent || [] }')
    const page = read('pages/MarketPricePage.jsx')
    expect(page).toContain('setPrices(marketData.prices || [])')
    expect(page).toContain('setRecent(marketData.recent || [])')
  })

  it('M1: AddItemModal onAdded calls refetchPrices (no bare `load` identifier)', () => {
    const page = read('pages/MarketPricePage.jsx')
    expect(page).toContain('onAdded={() => refetchPrices()}')
    expect(page).not.toContain('onAdded={load}')
  })

  it('D1: categories-query failure clears the ?cat= gate so the error + Retry renders', () => {
    const page = read('pages/DirectoryPage.jsx')
    expect(page).toContain('if (categoryQueryError) setUrlResolved(true)')
  })

  it('E7: AdminPage has an audit tab honouring ?tab= and ?target=', () => {
    const admin = read('pages/AdminPage.jsx')
    expect(admin).toContain("'audit'")
    expect(admin).toContain("searchParams.get('tab')")
    expect(admin).toContain("searchParams.get('target')")
    expect(admin).toContain('audit_logs')
  })

  it('EF2: EventForm Save mirrors handleSave — either title is enough', () => {
    const page = read('pages/EventFormPage.jsx')
    expect(page).toContain("(!form.title?.trim() && !form.title_mm?.trim())")
  })

  it('H1: DirectoryPage reads ?featured= and filters is_featured', () => {
    const page = read('pages/DirectoryPage.jsx')
    expect(page).toContain("searchParams.get('featured') === 'true'")
    expect(page).toContain(".eq('is_featured', true)")
  })
})

describe('route audit v9.20: annoyances', () => {
  it('MS5: MySubmissions has no owner delete — Admin only', () => {
    const page = read('pages/MySubmissionsPage.jsx')
    expect(page).not.toContain('handleDelete')
    expect(page).not.toContain('deleteListingWithCleanup')
    expect(page).not.toContain('Trash2')
    expect(page).not.toContain("supabase.from('listings').delete()")
  })

  it('J6/LF7/R5/T5: error-state Retry calls load() with no argument', () => {
    for (const f of ['pages/JobBoardPage.jsx', 'pages/LostFoundPage.jsx', 'pages/RentPage.jsx', 'pages/TutoringPage.jsx']) {
      expect(read(f)).toContain('onClick={() => load()}')
      expect(read(f)).not.toContain('onClick={load}')
    }
  })

  it('F1/EM1: loading state uses isLoading only, never isFetching', () => {
    expect(read('pages/FuelPage.jsx')).toContain('setLoading(fuelQueryLoading)')
    expect(read('pages/FuelPage.jsx')).not.toContain('fuelQueryLoading || fuelQueryFetching')
    expect(read('pages/EmergencyPage.jsx')).toContain('setLoading(contactsQueryLoading)')
    expect(read('pages/EmergencyPage.jsx')).not.toContain('contactsQueryLoading || contactsQueryFetching')
  })

  it('SV3: SavedPage tracks listings/posts errors separately', () => {
    const page = read('pages/SavedPage.jsx')
    expect(page).toContain('listingsError')
    expect(page).toContain('postsError')
    expect(page).not.toContain('bookmarksError')
  })

  it('E8: approve uses the shared buildListingStatusUpdate (approved sets is_verified + verify_type)', () => {
    const helper = read('lib/listingStatus.js')
    expect(helper).toContain("verify_type: 'cherry'")
    expect(read('pages/EditListingPage.jsx')).toContain('buildListingStatusUpdate')
    expect(read('pages/AdminPage.jsx')).toContain('buildListingStatusUpdate')
  })

  it('SB7/E9: category selects offer the parent itself inside each optgroup', () => {
    expect(read('pages/SubmitListingPage.jsx')).toContain('(အားလုံး)')
    expect(read('pages/EditListingPage.jsx')).toContain('(အားလုံး)')
  })

  it('NB2: rejectNotice sets status=rejected instead of deleting the row', () => {
    const page = read('pages/NoticeBoardPage.jsx')
    expect(page).toContain(".update({ status: 'rejected' })")
    // The only remaining .delete() is deleteNotice (a real feature) —
    // rejectNotice itself must not delete.
    const rejectFn = page.slice(page.indexOf('async function rejectNotice'))
    expect(rejectFn.slice(0, rejectFn.indexOf('\n  }\n'))).not.toContain('.delete()')
  })

  it('NB1: loadPending has a timeout + error state with retry', () => {
    const page = read('pages/NoticeBoardPage.jsx')
    expect(page).toContain("withTimeout(supabase.from('notices').select('*').eq('status', 'pending')")
    expect(page).toContain('pendingError')
  })

  it('C1/C2: Chat has a messages error banner + retry and a rooms loading state', () => {
    const page = read('pages/ChatPage.jsx')
    expect(page).toContain('messagesError')
    expect(page).toContain('messagesRetryTick')
    expect(page).toContain('roomsLoading')
  })

  it('A3: AdminPage data-tab fetches in 1000-row pages', () => {
    const page = read('pages/AdminPage.jsx')
    expect(page).toContain('fetchAllPaged')
    expect(page).toContain('.range(')
  })

  it('D2: failed subcategory count falls back to null (renders – , button enabled)', () => {
    expect(read('pages/DirectoryPage.jsx')).toContain('listing_count: null')
  })

  it('Directory search splits per word like SearchPage', () => {
    expect(read('pages/DirectoryPage.jsx')).toContain('for (const word of qF.trim().split(/\\s+/))')
  })

  it('S-C: SearchPage input has no autoFocus attribute (no mobile keyboard pop on entry)', () => {
    const page = read('pages/SearchPage.jsx')
    expect(page).not.toMatch(/<input[^>]*autoFocus/)
    expect(page).not.toContain('autoFocus={')
  })

  it('F2: Fuel station search uses myanmarVariants', () => {
    expect(read('pages/FuelPage.jsx')).toContain('myanmarVariants')
  })

  it('LFD1: claim banner no longer claims a record was made', () => {
    const page = read('pages/LostFoundDetailPage.jsx')
    expect(page).toContain('ဆက်သွယ်ရန် အချက်အလက်ကို အောက်မှာ ပြသထားသည်')
    expect(page).not.toContain('တောင်းဆိုချက် မှတ်တမ်းတင်ပြီးပါပြီ')
  })

  it('LFD2: guest claim navigates to login with a return path', () => {
    const page = read('pages/LostFoundDetailPage.jsx')
    expect(page).toContain("navigate('/login', { state: { from: `/lost-found/${id}` } })")
  })

  it('LFD3: edit enforces the S27 contact requirement like create', () => {
    expect(read('pages/LostFoundDetailPage.jsx')).toContain("if (!editForm.contact_phone?.trim() && !editForm.contact_name?.trim())")
  })

  it('HD1: Header back uses goBackOrHome, not history.length', () => {
    const header = read('components/Header.jsx')
    expect(header).toContain('goBackOrHome(navigate')
    expect(header).not.toContain('window.history.length')
  })

  it('SB1: duplicate-check fetch uses canonical phones, not raw input', () => {
    const page = read('pages/SubmitListingPage.jsx')
    expect(page).toContain('for (const canonPhone of phoneCanons)')
    expect(page).not.toContain('for (const rawPhone of form.phones.filter(Boolean))')
  })

  it('SB9: submit draft covers logo/cover/menu items, not just the form', () => {
    const page = read('pages/SubmitListingPage.jsx')
    expect(page).toContain('saveDraftDebounced.current({ ...form, logo, coverImg, menuItems })')
    expect(page).toContain('const { logo: dLogo, coverImg: dCover, menuItems: dMenu, ...dForm } = d.form')
  })

  it('B1/K1: bus routes, tour guides and RSVP counts use withTimeout', () => {
    expect(read('pages/CommunityFeaturePages.jsx')).toContain("withTimeout(supabase.from('bus_routes')")
    expect(read('pages/CommunityFeaturePages.jsx')).toContain("withTimeout(supabase.from('tour_guides')")
    expect(read('pages/CalendarPage.jsx')).toContain('withTimeout(Promise.all([')
  })

  it('AS5: AppSettings load has a timeout + retry, and no raw error reaches the user', () => {
    const page = read('pages/AppSettingsPage.jsx')
    expect(page).toContain("withTimeout(supabase.from('app_config').select('*')")
    expect(page).toContain('loadSettings')
    expect(page).not.toContain("showError('Settings ရယူရာတွင် အမှားရှိသည်: '")
    expect(page).not.toContain('failedKeys.push(entry.key')
  })

  it('V1: VisitorsPage surfaces the query error with a retry', () => {
    const page = read('pages/VisitorsPage.jsx')
    expect(page).toContain('statsQueryError')
    expect(page).toContain('refetchStats()')
    expect(page).not.toContain('9.12 migration run ပြီးမှ ပေါ်မည်')
  })

  it('PG2: points-history error has a retry button', () => {
    expect(read('pages/PointsGuidePage.jsx')).toContain('setHistoryRetryTick(t => t + 1)')
  })

  it('CM5: category delete uses withTimeout + a busy state', () => {
    const page = read('pages/CategoryManagerPage.jsx')
    expect(page).toContain('deletingId')
    expect(page).toContain("withTimeout(supabase.from('categories').delete()")
  })

  it('UI1: ReactionBar load uses withTimeout', () => {
    expect(read('components/UI.jsx')).toContain("withTimeout(supabase")
  })

  it('UI4: batched bookmark hook exists and cards accept a bookmarked prop', () => {
    expect(read('hooks/useBookmarksDB.js')).toContain('useBookmarkedSet')
    expect(read('components/UI.jsx')).toContain('bookmarked: bookmarkedProp')
    expect(read('pages/DirectoryPage.jsx')).toContain('useBookmarkedSet(listings.map(l => l.id))')
  })

  it('E5: draft-mode edit grants canEdit to staff only, never unconditionally', () => {
    const page = read('pages/EditListingPage.jsx')
    expect(page).toContain('setCanEdit(isAdmin || isModerator)')
    expect(page).not.toContain('setCanEdit(true)')
  })
})

describe('route audit v9.20: cosmetics', () => {
  it('CL5: ClaimPage typo fixed', () => {
    const page = read('pages/ClaimPage.jsx')
    expect(page).toContain('ဖုန်းနံပါတ် မှားနေသည်။')
    expect(page).not.toContain('မှားမှားမှား')
  })

  it('K2/PD1/H-B3: MMT parts instead of device-local Dates', () => {
    expect(read('pages/CalendarPage.jsx')).toContain('mmtBefore(endP || startP, nowP)')
    expect(read('pages/PostDetailPage.jsx')).toContain('mmtIsPast(post.event_end || post.event_start)')
    expect(read('pages/CommunityFeaturePages.jsx')).toContain('const todayStr = yangonToday()')
  })

  it('LD-D: load-more-reviews has one label', () => {
    const page = read('pages/ListingDetailPage.jsx')
    expect(page).toContain('ထပ်တင်ရန် (${listing.rating_count - reviews.length} ကျန်)')
    expect(page).not.toContain('Review အားလုံး ကြည့်ရန်')
  })

  it('LD-E: menu-check failure is silent (no toast)', () => {
    expect(read('pages/ListingDetailPage.jsx')).not.toContain("showError('Menu ရှိမရှိ စစ်မရပါ')")
  })

  it('J3/J4: unknown salary unit / post type fall back to raw/neutral, not month/offer', () => {
    const page = read('pages/JobBoardPage.jsx')
    expect(page).toContain("salaryUnitMm")
    expect(page).toContain("id: 'unknown', mm: job.post_type || 'အခြား'")
  })

  it('RSV2: unknown RSVP status shows the raw status, not Interested', () => {
    const page = read('pages/MyRsvpsPage.jsx')
    expect(page).toContain("mm: ev._rsvp || 'အခြား'")
    expect(page).not.toContain('RSVP_STATUS.interested')
  })

  it('MR4: My Reviews has an edit button to ?review=edit', () => {
    expect(read('pages/MyReviewsPage.jsx')).toContain('?review=edit')
    expect(read('pages/ListingDetailPage.jsx')).toContain("searchParams.get('review') === 'edit'")
  })

  it('CM2/CM8: parents filtered by form.type; parent select shown when editing', () => {
    const page = read('pages/CategoryManagerPage.jsx')
    expect(page).toContain('c.type === form.type')
    expect(page).toContain('(!parentId || isEdit)')
  })

  it('CM7: category search uses myanmarVariants', () => {
    expect(read('pages/CategoryManagerPage.jsx')).toContain('myanmarVariants(search)')
  })

  it('MN5: menu sort_order is max+1, not items.length', () => {
    const page = read('pages/MenuPage.jsx')
    expect(page).toContain('Math.max(0, ...items.map(i => i.sort_order ?? 0)) + 1')
    expect(page).not.toContain('sort_order: items.length')
  })

  it('MN6: menu items have up/down reorder controls', () => {
    const page = read('pages/MenuPage.jsx')
    expect(page).toContain('moveItem(item, -1)')
    expect(page).toContain('moveItem(item, 1)')
  })

  it('MN4: menu addCategory has a duplicate-name check', () => {
    expect(read('pages/MenuPage.jsx')).toContain('အမည်တူ Category ရှိပြီးဖြစ်သည်')
  })

  it('BI2: dedupe key discriminates no-phone rows by township/address', () => {
    const page = read('pages/BulkImportPage.jsx')
    expect(page).toContain('function dedupeKey(name, phone, township, address)')
    expect(page).toContain("if (!t && !a) return null")
  })

  it('BI3: missing city defaults from config, not hardcoded Taunggyi', () => {
    const page = read('pages/BulkImportPage.jsx')
    expect(page).toContain("config.cities?.[0] || 'Taunggyi'")
    expect(page).not.toContain("row.city?.trim() || 'Taunggyi'")
  })

  it('PG1: action links keyed by POINT_ACTIONS id, not index', () => {
    const page = read('pages/PointsGuidePage.jsx')
    expect(page).toContain('ACTION_LINKS[id]')
    expect(page).not.toContain('ACTION_LINKS[i]')
    expect(read('lib/tiers.js')).toContain("id: 'write_review'")
  })

  it('LB2: rank banner keeps cached rank during refetch (9.25 supersedes the v9.20 hide)', () => {
    const page = read('pages/LeaderboardPage.jsx')
    expect(page).not.toContain('!boardFetching && !rankFetching')
    expect(page).toContain("(myRank || rankBeyond) && !loading && profile")
    // stale pill shows while the refetch is in flight, banner stays put
    expect(page).toContain('အသစ်ရယူနေသည်…')
  })

  it('LF2: lost & found search uses buildOrFilter (Zawgyi variants)', () => {
    expect(read('pages/LostFoundPage.jsx')).toContain('buildOrFilter([')
  })

  it('LF5: lost & found form validates the phone format', () => {
    expect(read('pages/LostFoundPage.jsx')).toContain('validatePhone(form.contact_phone)')
  })

  it('PP10: stats-grid dead `highlight` removed', () => {
    expect(read('pages/ProfilePage.jsx')).not.toContain('highlight')
  })

  it('AR1: report claim runs before the listing suspend, with rollback', () => {
    const page = read('pages/AdminReportsPage.jsx')
    const claimAt = page.indexOf(".eq('status', 'pending')")
    const suspendAt = page.indexOf("update({ status: 'suspended' })")
    expect(claimAt).toBeGreaterThan(-1)
    expect(suspendAt).toBeGreaterThan(-1)
    expect(claimAt).toBeLessThan(suspendAt)
    expect(page).toContain("update({ status: 'pending', reviewed_at: null, reviewed_by: null })")
  })

  it('HY1/HY8: timeAgo clamps future timestamps; history orders by created_at', () => {
    const page = read('pages/HistoryPage.jsx')
    expect(page).toContain('Math.max(0, Math.floor((Date.now() - new Date(iso)) / 60000))')
    expect(page).toContain("if (m === 0) return lang === 'mm' ? 'ယခု' : 'now'")
    expect(page).not.toContain(".order('event_date', { ascending: false, nullsFirst: false })")
  })

  it('HY10: History detail has moderator edit/delete', () => {
    const page = read('pages/HistoryPage.jsx')
    expect(page).toContain('setShowEdit(true)')
    expect(page).toContain('handleDelete()')
  })

  it('no raw error.message reaches the user in the fixed files', () => {
    for (const f of [
      'pages/RentPage.jsx', 'pages/TutoringPage.jsx', 'pages/MySubmissionsPage.jsx',
      'pages/AdminReportsPage.jsx', 'pages/ProfilePage.jsx', 'pages/MenuPage.jsx',
      'pages/BulkImportPage.jsx', 'pages/AppSettingsPage.jsx', 'pages/CategoryManagerPage.jsx',
      'pages/LostFoundPage.jsx', 'pages/LostFoundDetailPage.jsx', 'pages/NoticeBoardPage.jsx',
      'pages/HistoryPage.jsx', 'pages/MyReviewsPage.jsx',
    ]) {
      expect(read(f)).not.toContain('showError(error.message')
      expect(read(f)).not.toContain('showError(err.message')
    }
  })
})
