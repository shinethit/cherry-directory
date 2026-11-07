// @vitest-environment jsdom
// v9.23: the crash screen shows clear recovery steps — Android clears the
// cache, iOS deletes the home-screen Shortcut and re-adds it. Render-proves
// the platform-aware lines appear (and the wrong platform's line does not),
// and that Retry + Go to Home are still offered.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function Thrower() {
  throw new Error('boom-923-test')
}

function setUA(ua) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}

beforeEach(() => {
  window.sessionStorage.clear()
  // Silence React's "error occurred in <Thrower>" console dump — the
  // boundary catches it by design; the test asserts the rendered screen.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// v9.24: the 2nd-trip button label was too long and wrapped to two lines
// inside the purple button — shortened to 'Profile ရှင်းမည်'.
// v9.25 (A-7): whitespace-nowrap was REMOVED from the crash-screen buttons
// (a 320px screen overflowed the card by ~1px per button); the short label
// stays, but it may now wrap to two lines instead of overflowing. min-w-0
// lets both flex-1 buttons shrink. 2nd trip = sessionStorage already holds
// 1 trip; the boundary increments it to 2 in componentDidCatch and shows
// the clear-profile button instead of plain Retry.
describe('ErrorBoundary 2nd-trip button (v9.24)', () => {
  it('2nd trip shows the short label, buttons shrinkable (no whitespace-nowrap)', () => {
    setUA(DESKTOP_UA)
    window.sessionStorage.setItem('cherry-error-boundary-trips', '1')
    render(<ErrorBoundary><Thrower /></ErrorBoundary>)
    const btn = screen.getByText('Profile ရှင်းမည်')
    expect(btn).toBeTruthy()
    expect(btn.className).toContain('min-w-0')
    expect(btn.className).not.toContain('whitespace-nowrap')
    expect(screen.queryByText('ပြန်ကြိုးစားမည်')).toBeNull()
  })
})

describe('ErrorBoundary recovery steps (v9.23)', () => {
  it('iOS shows only the Shortcut line', () => {
    setUA(IPHONE_UA)
    render(<ErrorBoundary><Thrower /></ErrorBoundary>)
    expect(screen.getByText('တစ်ခုခု မှားသွားပါပြီ')).toBeTruthy()
    expect(screen.getByText(/Shortcut/)).toBeTruthy()
    expect(screen.queryByText(/Clear cache/)).toBeNull()
    expect(screen.getByText('ပြန်ကြိုးစားမည်')).toBeTruthy()
    expect(screen.getByText('ပင်မသို့ သွားမည်')).toBeTruthy()
  })

  it('Android shows only the Clear-cache line', () => {
    setUA(ANDROID_UA)
    render(<ErrorBoundary><Thrower /></ErrorBoundary>)
    expect(screen.getByText(/Clear cache/)).toBeTruthy()
    expect(screen.queryByText(/Shortcut/)).toBeNull()
  })

  it('desktop/unknown shows both lines', () => {
    setUA(DESKTOP_UA)
    render(<ErrorBoundary><Thrower /></ErrorBoundary>)
    expect(screen.getByText(/Clear cache/)).toBeTruthy()
    expect(screen.getByText(/Shortcut/)).toBeTruthy()
  })
})
