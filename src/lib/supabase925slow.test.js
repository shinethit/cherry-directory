// v9.25 slow-network fixes — isLockError narrowing (worker D).
// The old detector matched ANY message containing 'Lock', so the
// unhandledrejection handler in lib/supabase.js fired a page reload for
// non-poison errors (e.g. the 'was not released within 5000ms' warning
// text from a two-tab slow-refresh race). Now only the two lock-steal
// shapes match by message. The name / isAcquireTimeout checks stay:
// they identify the LockAcquireTimeoutError class itself (the class that
// throws the steal message), not a substring — and fixes922 pins them.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

let supa

beforeAll(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://fake.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-anon-key')
  supa = await import('./supabase')
})

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('isLockError narrowing (v9.25)', () => {
  it('matches the two lock-steal shapes', () => {
    expect(
      supa.isLockError(new Error('Lock "lock:cherry-directory-auth" was released because another request stole it')),
    ).toBe(true)
    expect(supa.isLockError(new Error("Lock broken by another request with the 'steal' option."))).toBe(true)
    // The AbortError shape seen in the repro log carries the steal message.
    const abortErr = new Error("Lock broken by another request with the 'steal' option.")
    abortErr.name = 'AbortError'
    expect(supa.isLockError(abortErr)).toBe(true)
  })

  it('does NOT match unrelated messages that merely contain "Lock"', () => {
    // The two-tab slow-refresh race text: a warning, not a poisoned lock.
    expect(supa.isLockError(new Error('Lock "lock:cherry-directory-auth" was not released within 5000ms'))).toBe(false)
    // Immediate-acquire failure (contention, not a steal) as a bare message.
    expect(supa.isLockError(new Error('Acquiring an exclusive Navigator LockManager lock "lock:x" immediately failed'))).toBe(false)
    expect(supa.isLockError(new Error('Failed to lock the database'))).toBe(false)
    expect(supa.isLockError(new Error('Locksmith error'))).toBe(false)
    expect(supa.isLockError(new Error('Could not acquire lock'))).toBe(false)
  })

  it('does not treat ordinary failures as lock errors', () => {
    expect(supa.isLockError(new Error('Failed to fetch'))).toBe(false)
    expect(supa.isLockError(new Error('NetworkError when attempting to fetch resource.'))).toBe(false)
    expect(supa.isLockError(null)).toBe(false)
    expect(supa.isLockError(undefined)).toBe(false)
  })

  it('still recognises the LockAcquireTimeoutError class markers (fixes922 pin)', () => {
    expect(supa.isLockError({ name: 'LockAcquireTimeoutError', message: 'timed out' })).toBe(true)
    expect(supa.isLockError({ isAcquireTimeout: true, message: 'timed out' })).toBe(true)
  })
})
