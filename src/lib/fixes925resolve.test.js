import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// v9.25 regen #5 — resolve-with-error sweep. supabase-js RESOLVES with
// { data: null, error } on a dead connection instead of throwing, so
// every destructure that only took { data } / { count } silently rendered
// empty or wiped good data. The instances below have no owning render
// test file (their pages render through heavy contexts / static mocks),
// so the guards — and the checked-harmless evidence — are asserted on
// the source here. Happy-path behaviour is unchanged: every fix below
// only runs when `error` is non-null.

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = p => readFileSync(join(root, p), 'utf8')

describe('resolve-with-error FIXED (v9.25 regen #5)', () => {
  it('CalendarPage: event-category lookup throws on error, keeping the last good filter options', () => {
    const s = src('pages/CalendarPage.jsx')
    expect(s).toContain('const { data: cats, error: catError }')
    expect(s).toContain('if (catError) throw catError')
  })

  it('SubmitListingPage: category re-fetch after quick-add keeps the last good list on error', () => {
    const s = src('pages/SubmitListingPage.jsx')
    expect(s).toContain('const { data: cats, error: catsErr }')
    expect(s).toContain('if (!catsErr) setCategories(cats || [])')
  })

  it('LostFoundDetailPage: duplicate-report check fails closed on error (no duplicate report)', () => {
    const s = src('pages/LostFoundDetailPage.jsx')
    expect(s).toContain('const { data: existing, error: existingErr }')
    expect(s).toContain('if (existingErr) { showError')
  })

  it('CommunityFeaturePages: bus-departure dup check throws on error (form stays open to retry)', () => {
    const s = src('pages/CommunityFeaturePages.jsx')
    expect(s).toContain('const { data: dup, error: dupErr }')
    expect(s).toContain('if (dupErr) throw dupErr')
  })
})

describe('resolve-with-error CHECKED-HARMLESS (v9.25 regen #5)', () => {
  it('ChatPage: quoted-message fetches only fill replyMap when data arrives — a failure just leaves the quote blank', () => {
    const s = src('pages/ChatPage.jsx')
    // Both quoted fetches (initial load + realtime echo) guard on data.
    expect(s).toContain('const { data: quoted } = await supabase')
    expect(s).toContain('if (quoted) {')
    expect(s).toContain('if (quoted) setReplyMap')
    // The reply bubble renders the quote only when replyMap has it.
    expect(s).toContain('const quoted = msg.reply_to ? replyMap?.[msg.reply_to] : null')
  })

  it('HistoryPage: related posts default to [] on error — correct, because related belongs to the current post and stale rows would be wrong', () => {
    const s = src('pages/HistoryPage.jsx')
    const i = s.indexOf('History related')
    expect(i).toBeGreaterThan(-1)
    expect(s.slice(i, i + 900)).toContain("} catch (relErr) { console.warn(relErr) }")
    // The main post load already throws on error into the load_failed state.
    expect(s).toContain("setLoadError(error.code === 'PGRST116' ? 'not_found' : 'load_failed')")
  })

  it('SimilarBusinesses: error leaves the initial [] — the section hides, exactly like the no-similar empty state; no good data is wiped', () => {
    const s = src('components/SimilarBusinesses.jsx')
    expect(s).toContain('const [items, setItems] = useState([])')
    expect(s).toContain('if (items.length === 0) return null')
  })

  it('usePresence: a failed session insert leaves sessionRef undefined, so ping/endSession no-op — presence just stays absent, nothing false is shown', () => {
    const s = src('hooks/usePresence.js')
    expect(s).toContain('sessionRef.current = data?.id')
    expect(s).toContain('if (!sessionRef.current) return')
  })

  it('AdminReportsPage: count error sets totalCount null, and the header falls back to the page length — the same fallback as the catch path', () => {
    const s = src('pages/AdminReportsPage.jsx')
    expect(s).toContain('setTotalCount(count ?? null)')
    expect(s).toContain("(totalCount ?? items.length) + ' ခု'")
  })

  it('AdminReportsPage: target-name lookup is a documented secondary fetch — a failure leaves _target null and the list still renders', () => {
    const s = src('pages/AdminReportsPage.jsx')
    expect(s).toContain('a failed lookup must not fail')
    expect(s).toContain("} catch (nameErr) { console.warn('Report target names failed:', nameErr) }")
  })
})
