// @vitest-environment jsdom
// v9.26 — RequireAdmin boot-only gate.
// Bug: RequireAdmin showed a spinner whenever profileLoading was true,
// so the hourly TOKEN_REFRESHED (autoRefreshToken) unmounted the admin
// page mid-import — BulkImportPage remounted fresh (preview/progress
// lost) while the import loop kept inserting invisibly. The spinner
// must apply at BOOT ONLY: once the first profile load has settled
// (profileBooted), a background refetch keeps rendering children with
// the last good profile. AuthContext already holds that last good
// profile in `profile` (a refetch never clears it) and restores it
// from the 'cherry-directory-profile' cache on failure — no extra
// cache-seeding was needed.
// These tests render the REAL AuthProvider + the REAL (exported)
// RequireAdmin against a mocked supabase client whose profile queries
// are deferred promises the test resolves by hand, so the loading /
// refetch / user-switch states are all observable.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act } from 'react'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(srcDir, rel), 'utf8')

// Mocked supabase: getSession returns the configured session; every
// profiles query is a deferred promise pushed onto mockState.queries
// (resolve/reject in hand); onAuthStateChange captures its handler so
// the test can fire TOKEN_REFRESHED / SIGNED_IN like the real client.
const { mockState } = vi.hoisted(() => ({
  mockState: {
    session: { user: { id: 'u1' } },
    handlers: [],
    queries: [],
  },
}))

vi.mock('../lib/supabase', () => {
  function makeQuery() {
    let resolveQuery
    let rejectQuery
    const promise = new Promise((resolve, reject) => {
      resolveQuery = resolve
      rejectQuery = reject
    })
    const q = { promise, resolve: resolveQuery, reject: rejectQuery }
    mockState.queries.push(q)
    const builder = {
      select() { return builder },
      eq() { return builder },
      single() { return promise },
    }
    return builder
  }
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: mockState.session }, error: null }),
        onAuthStateChange: (cb) => {
          mockState.handlers.push(cb)
          return { data: { subscription: { unsubscribe: () => {} } } }
        },
      },
      from: () => makeQuery(),
    },
    isLockError: () => false,
    handleLockPoison: () => false,
  }
})

vi.mock('../lib/toast', () => ({ showError: vi.fn() }))

// RequireAdmin lives in App.jsx; import it after stubbing env like
// App925slow.test.jsx does (its import chain reads VITE_* at top level).
let RequireAdmin
beforeAll(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://fake.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-anon-key')
  ;({ RequireAdmin } = await import('../App'))
})

const adminProfile = (id) => ({ id, role: 'admin', full_name: 'Admin' })
// A profiles query resolves like Supabase: { data, error } — resolving
// with the bare row would make fetchProfileOnce throw 'Profile row not
// found' and burn its one quiet retry on a second (pending) query.
const resolveProfile = (q, profile) => q.resolve({ data: profile, error: null })

// Probe: captures the live useAuth() value on every render.
let latestAuth = null
function Probe() {
  latestAuth = useAuth()
  return null
}

function renderGate() {
  return render(
    <AuthProvider>
      <Probe />
      <RequireAdmin><div>IMPORT PAGE</div></RequireAdmin>
    </AuthProvider>
  )
}

beforeEach(() => {
  mockState.session = { user: { id: 'u1' } }
  mockState.handlers.length = 0
  mockState.queries.length = 0
  latestAuth = null
  window.localStorage.clear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('v9.26: RequireAdmin boot-only gate', () => {
  it('boot: spinner while the first profile load is pending, page once it settles', async () => {
    renderGate()
    await waitFor(() => expect(latestAuth.profileLoading).toBe(true))
    expect(latestAuth.profileBooted).toBe(false)
    expect(latestAuth.profile).toBeNull()
    expect(screen.getByText('Loading...')).toBeTruthy()
    expect(screen.queryByText('IMPORT PAGE')).toBeNull()

    await act(async () => { resolveProfile(mockState.queries[0], adminProfile('u1')) })
    await waitFor(() => expect(screen.getByText('IMPORT PAGE')).toBeTruthy())
    expect(latestAuth.profileBooted).toBe(true)
    expect(latestAuth.profileLoading).toBe(false)
    expect(screen.queryByText('Loading...')).toBeNull()
  })

  it('TOKEN_REFRESHED refetch keeps the admin page mounted (no spinner swap)', async () => {
    renderGate()
    await waitFor(() => expect(latestAuth.profileLoading).toBe(true))
    await act(async () => { resolveProfile(mockState.queries[0], adminProfile('u1')) })
    await waitFor(() => expect(screen.getByText('IMPORT PAGE')).toBeTruthy())
    expect(latestAuth.profileBooted).toBe(true)

    // Hourly token refresh, mid-import: a background refetch starts.
    await act(async () => { mockState.handlers[0]('TOKEN_REFRESHED', { user: { id: 'u1' } }) })
    await waitFor(() => expect(latestAuth.profileLoading).toBe(true))
    expect(mockState.queries.length).toBe(2) // a refetch really started
    expect(latestAuth.profileBooted).toBe(true)
    expect(latestAuth.profile?.role).toBe('admin') // last good profile kept
    expect(screen.getByText('IMPORT PAGE')).toBeTruthy()
    expect(screen.queryByText('Loading...')).toBeNull()

    // Refetch settles — page still mounted, no remount.
    await act(async () => { resolveProfile(mockState.queries[1], adminProfile('u1')) })
    await waitFor(() => expect(latestAuth.profileLoading).toBe(false))
    expect(screen.getByText('IMPORT PAGE')).toBeTruthy()
    expect(screen.queryByText('Loading...')).toBeNull()
  })

  it('a different user signing in resets the gate (no stale-admin flash)', async () => {
    renderGate()
    await waitFor(() => expect(latestAuth.profileLoading).toBe(true))
    await act(async () => { resolveProfile(mockState.queries[0], adminProfile('u1')) })
    await waitFor(() => expect(screen.getByText('IMPORT PAGE')).toBeTruthy())

    await act(async () => { mockState.handlers[0]('SIGNED_IN', { user: { id: 'u2' } }) })
    await waitFor(() => expect(latestAuth.profileLoading).toBe(true))
    expect(mockState.queries.length).toBe(2)
    expect(latestAuth.profile).toBeNull()
    expect(latestAuth.profileBooted).toBe(false)
    expect(screen.getByText('Loading...')).toBeTruthy()
    expect(screen.queryByText('IMPORT PAGE')).toBeNull()

    await act(async () => { resolveProfile(mockState.queries[1], { id: 'u2', role: 'member', full_name: 'Member' }) })
    await waitFor(() => expect(latestAuth.profileLoading).toBe(false))
    expect(screen.queryByText('IMPORT PAGE')).toBeNull()
    expect(screen.getByText('🔒 Admin / Moderator သာ ကြည့်နိုင်သည်')).toBeTruthy()
  })
})

describe('v9.26 wiring (static pin)', () => {
  it('RequireAdmin gates on profileLoading only before boot', () => {
    const app = read('App.jsx')
    expect(app).toContain('if (loading || (profileLoading && !profileBooted)) return <LoadingSpinner />')
    expect(app).toContain('profileBooted')
    const auth = read('contexts/AuthContext.jsx')
    expect(auth).toContain('profileBooted')
    expect(auth).toContain('setProfileBooted(true)')
    expect(auth).toContain('profileBooted,')
  })
})
