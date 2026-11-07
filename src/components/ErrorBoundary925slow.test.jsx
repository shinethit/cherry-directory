// @vitest-environment jsdom
// v9.25 slow-network fixes — ErrorBoundary 2nd trip (worker D).
// The 2nd-trip escape hatch used to clear only the cached profile
// ('cherry-directory-profile') and go Home — it never touched the
// persisted query cache ('cherry-directory-cache'), so a poisoned entry
// there re-crashed the app a 3rd time. Now it clears both.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Thrower() {
  throw new Error('boom-925slow-test')
}

let locationStub

beforeEach(() => {
  window.sessionStorage.clear()
  window.localStorage.clear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // Stub location so handleRetry's navigation is observable instead of
  // jsdom's "Not implemented: navigation" no-op.
  locationStub = { href: 'http://localhost/', reload: vi.fn() }
  Object.defineProperty(window, 'location', { value: locationStub, writable: true, configurable: true })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ErrorBoundary 2nd trip clears the query cache (v9.25)', () => {
  it('2nd trip removes cherry-directory-cache AND the profile, then goes Home', () => {
    window.localStorage.setItem('cherry-directory-cache', '{"clientState":{"queries":[]}}')
    window.localStorage.setItem('cherry-directory-profile', '{"full_name":"Test"}')
    window.sessionStorage.setItem('cherry-error-boundary-trips', '1')
    render(<ErrorBoundary><Thrower /></ErrorBoundary>)
    fireEvent.click(screen.getByText('Profile ရှင်းမည်'))
    expect(window.localStorage.getItem('cherry-directory-cache')).toBeNull()
    expect(window.localStorage.getItem('cherry-directory-profile')).toBeNull()
    expect(locationStub.href).toBe('/')
    expect(locationStub.reload).not.toHaveBeenCalled()
  })

  it('1st trip still plain-reloads and does NOT clear the caches', () => {
    window.localStorage.setItem('cherry-directory-cache', '{"clientState":{"queries":[]}}')
    window.localStorage.setItem('cherry-directory-profile', '{"full_name":"Test"}')
    render(<ErrorBoundary><Thrower /></ErrorBoundary>)
    fireEvent.click(screen.getByText('ပြန်ကြိုးစားမည်'))
    expect(window.localStorage.getItem('cherry-directory-cache')).not.toBeNull()
    expect(window.localStorage.getItem('cherry-directory-profile')).not.toBeNull()
    expect(locationStub.reload).toHaveBeenCalledTimes(1)
    expect(locationStub.href).toBe('http://localhost/')
  })
})
