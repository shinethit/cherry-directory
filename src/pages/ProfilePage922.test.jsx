// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProfilePage from './ProfilePage'
import { ErrorBoundary } from '../components/ErrorBoundary'

// v9.22 FIX 4 (crash): ProfilePage threw
//   TypeError: Cannot read properties of undefined (reading 'icon')
// on /profile whenever the stored profile's role was outside the 4-key
// ROLE_CONFIG — live rows carry 'user' (AdminPage maps 'user' → 'member'
// in its role dropdown). The throw fired during render, so the
// top-level ErrorBoundary caught it on every reload (deterministic crash
// loop). The guard falls back to Member, and the boundary now counts
// same-session trips: on the 2nd trip Retry clears the cached profile
// and goes Home instead of reloading into the same throw.
// jsdom + @testing-library/react (devDependencies, added in 9.22);
// vitest's default env is node, so this file opts into jsdom per-file.

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: {
    profile: null,
    user: { id: 'u1' },
    isLoggedIn: true,
    isAdmin: false,
    isModerator: false,
    signOut: vi.fn(async () => ({ error: null })),
    updateProfile: vi.fn(async () => {}),
    profileLoading: false,
    profileError: '',
    refreshProfile: vi.fn(),
  },
}))

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockAuth }))
vi.mock('../contexts/LangContext', () => ({ useLang: () => ({ lang: 'mm' }) }))
vi.mock('../contexts/AppConfigContext', () => ({
  useAppConfig: () => ({ app_name: 'Cherry Directory', app_city: 'Taunggyi' }),
}))
vi.mock('../hooks/usePWA', () => ({
  usePWA: () => ({
    installable: false,
    installApp: vi.fn(),
    pushEnabled: false,
    enablePush: vi.fn(async () => {}),
    disablePush: vi.fn(async () => {}),
  }),
}))
vi.mock('../hooks/useSEO', () => ({ useSEO: () => {} }))
vi.mock('../lib/cloudinary', () => ({ uploadImage: vi.fn(), getOptimizedUrl: (u) => u }))
vi.mock('../lib/toast', () => ({ showError: vi.fn() }))
vi.mock('../components/OfflineCachePanel', () => ({ default: () => null }))
vi.mock('../components/TierBadge', () => ({ default: () => null }))

// Chainable supabase builder: every query resolves empty (stats 0,
// month points null) — the role badge is what this test asserts.
function chainable() {
  const builder = {
    select() { return builder },
    eq() { return builder },
    in() { return builder },
    order() { return builder },
    limit() { return builder },
    single() { return builder },
    maybeSingle() { return builder },
    then(resolve) { resolve({ data: null, count: 0, error: null }) },
  }
  return builder
}
vi.mock('../lib/supabase', () => ({ supabase: { from: () => chainable() } }))

function renderProfile(role) {
  mockAuth.profile = {
    id: 'u1', full_name: 'Test User', nickname: 'testuser',
    bio: '', avatar_url: null, points: 120, role,
    last_seen: null,
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <QueryClientProvider client={client}>
        <ProfilePage />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

// vitest here runs without globals, so @testing-library/react's
// auto-cleanup is not registered — unmount after every test so one
// render's DOM cannot leak into the next test's queries.
afterEach(() => { cleanup() })

describe('FIX 4: /profile renders with an unlisted role (no throw)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it("role 'user' (the live value) renders the Member badge, no crash", async () => {
    renderProfile('user')
    await waitFor(() => expect(screen.getByText('Test User')).toBeTruthy())
    expect(screen.getByText('Member')).toBeTruthy()
    expect(screen.queryByText(/တစ်ခုခု မှားသွားပါပြီ/)).toBeNull()
  })

  it("an unknown role string ('superuser') also falls back to Member", async () => {
    renderProfile('superuser')
    await waitFor(() => expect(screen.getByText('Test User')).toBeTruthy())
    expect(screen.getByText('Member')).toBeTruthy()
    expect(screen.queryByText(/တစ်ခုခု မှားသွားပါပြီ/)).toBeNull()
  })

  it("role 'member' still renders Member (no regression)", async () => {
    renderProfile('member')
    await waitFor(() => expect(screen.getByText('Test User')).toBeTruthy())
    expect(screen.getByText('Member')).toBeTruthy()
  })
})

describe('FIX 4: ErrorBoundary stops the reload loop on the 2nd trip', () => {
  function Thrower() {
    throw new Error('boom')
  }

  beforeEach(() => {
    window.sessionStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('1st trip offers plain Retry; 2nd trip in the same session offers clear-profile + Home', () => {
    const { unmount } = render(
      <ErrorBoundary><Thrower /></ErrorBoundary>
    )
    expect(screen.getByText('ပြန်ကြိုးစားမည်')).toBeTruthy()
    expect(screen.queryByText('Profile ရှင်းပြီး ပင်မသို့ သွားမည်')).toBeNull()
    unmount()

    render(
      <ErrorBoundary><Thrower /></ErrorBoundary>
    )
    expect(screen.getByText('Profile ရှင်းပြီး ပင်မသို့ သွားမည်')).toBeTruthy()
    expect(screen.queryByText('ပြန်ကြိုးစားမည်')).toBeNull()
  })
})
