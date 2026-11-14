// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { goBackOrHome, NAV_DEPTH_KEY } from './navigation'

// v9.41 FIX 1 — Back button no longer ejects the user from the app on
// a directly opened page. window.history.length counts external entries
// (a fresh tab's new-tab page counts), so the helper now reads the
// in-app navigation depth App.jsx tracks in sessionStorage instead:
// depth 0 = this tab entered the app on this page → fallback;
// depth > 0 = the user navigated inside the app → navigate(-1).
//
// NOTE: this file has NO filesystem-path comparisons at all (no
// path.relative / path.join / readdir comparisons on file paths) — the
// only node:path use is locating App.jsx for a static assertion, read
// with readFileSync, never compared as paths — so the 9.19/9.25
// backslash-path rule does not apply here.

describe('v9.41 FIX 1 — goBackOrHome follows sessionStorage depth, not history.length', () => {
  const navigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  it('(a) no depth key → fallback "/" with replace (directly opened page)', () => {
    goBackOrHome(navigate)
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('(a) depth "0" → fallback; a custom fallback is honoured', () => {
    sessionStorage.setItem(NAV_DEPTH_KEY, '0')
    goBackOrHome(navigate, '/directory')
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/directory', { replace: true })
  })

  it('(a) a garbage depth value is treated as 0 → fallback', () => {
    sessionStorage.setItem(NAV_DEPTH_KEY, 'abc')
    goBackOrHome(navigate)
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('(b) depth > 0 → navigate(-1)', () => {
    sessionStorage.setItem(NAV_DEPTH_KEY, '2')
    goBackOrHome(navigate)
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith(-1)
  })

  it('(b) depth "1" → navigate(-1)', () => {
    sessionStorage.setItem(NAV_DEPTH_KEY, '1')
    goBackOrHome(navigate, '/directory')
    expect(navigate).toHaveBeenCalledWith(-1)
  })

  it('(c) explicit `from` still wins with replace — at depth 0 and at depth > 0', () => {
    goBackOrHome(navigate, '/', '/login')
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true })
    vi.clearAllMocks()
    sessionStorage.setItem(NAV_DEPTH_KEY, '3')
    goBackOrHome(navigate, '/', '/login')
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('the depth key is cherry-nav-depth', () => {
    expect(NAV_DEPTH_KEY).toBe('cherry-nav-depth')
  })
})

describe('v9.41 FIX 1 — App.jsx tracks the depth (source)', () => {
  it('TrackNavDepth is defined and rendered, and increments the stored depth on pathname change', () => {
    const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
    const app = readFileSync(join(rootDir, 'App.jsx'), 'utf8')
    expect(app).toContain('function TrackNavDepth()')
    expect(app).toContain('<TrackNavDepth />')
    expect(app).toContain('NAV_DEPTH_KEY')
    expect(app).toContain("sessionStorage.getItem(NAV_DEPTH_KEY)")
    expect(app).toContain('sessionStorage.setItem(NAV_DEPTH_KEY')
    // The ref starts at the first pathname, so the first mount does
    // NOT count as a navigation.
    expect(app).toContain('lastPathRef = useRef(pathname)')
    // The helper no longer branches on history.length at all (the
    // comment still names it to explain WHY it is unreliable).
    const nav = readFileSync(join(rootDir, 'lib', 'navigation.js'), 'utf8')
    expect(nav).not.toMatch(/if \(window\.history\.length/)
  })
})
