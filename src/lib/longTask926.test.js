// @vitest-environment jsdom
// v9.26 — long-task reload guard (worker C).
// longTask.js is the shared signal: begin/end/isRunning. The update
// reload (useServiceWorker) and the auth-lock-poison reload
// (supabase.js handleLockPoison) must never fire while a long task
// (e.g. a CSV import) runs — a reload would wipe its in-progress
// state. handleLockPoison skips WITHOUT consuming one of its 3
// reloads/session, so the recovery is deferred, not lost.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { beginLongTask, endLongTask, isLongTaskRunning } from './longTask'

let supa
let reloadSpy
// jsdom's window.location is an own (configurable) property of the
// window instance — `delete` would remove it for good, so save it once
// and restore it with defineProperty in afterEach.
const realLocation = window.location

beforeAll(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://fake.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-anon-key')
  supa = await import('./supabase')
})

afterAll(() => {
  vi.unstubAllEnvs()
})

beforeEach(() => {
  vi.useFakeTimers()
  window.sessionStorage.clear()
  // jsdom's location.reload is not spying-friendly (non-configurable
  // instance method, absent from Location.prototype) — shadow the
  // window.location accessor with a plain object carrying a mock reload.
  // Restored in afterEach (see realLocation above).
  reloadSpy = vi.fn()
  const loc = window.location
  Object.defineProperty(window, 'location', {
    value: { href: loc.href, hostname: loc.hostname, origin: loc.origin, reload: reloadSpy },
    configurable: true,
  })
})

afterEach(() => {
  Object.defineProperty(window, 'location', { value: realLocation, configurable: true })
  // Drain any counter leaked by a test so tests stay independent.
  for (let i = 0; i < 10 && isLongTaskRunning(); i++) endLongTask()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('longTask counter', () => {
  it('starts not running', () => {
    expect(isLongTaskRunning()).toBe(false)
  })

  it('begin → running, end → not running', () => {
    beginLongTask()
    expect(isLongTaskRunning()).toBe(true)
    endLongTask()
    expect(isLongTaskRunning()).toBe(false)
  })

  it('nests: clears only when the last task ends', () => {
    beginLongTask()
    beginLongTask()
    endLongTask()
    expect(isLongTaskRunning()).toBe(true)
    endLongTask()
    expect(isLongTaskRunning()).toBe(false)
  })

  it('end without begin floors at 0 — never stuck running', () => {
    endLongTask()
    endLongTask()
    expect(isLongTaskRunning()).toBe(false)
    beginLongTask()
    endLongTask()
    expect(isLongTaskRunning()).toBe(false)
  })
})

describe('handleLockPoison while a long task runs (v9.26)', () => {
  it('skips the reload and consumes NO attempt', () => {
    beginLongTask()
    expect(supa.handleLockPoison()).toBe(false)
    expect(window.sessionStorage.getItem('cherry-auth-lock-reloaded')).toBeNull()
    expect(reloadSpy).not.toHaveBeenCalled()
    endLongTask()
    // Same session, no attempt spent: the very next call may reload.
    expect(supa.handleLockPoison()).toBe(true)
    const stored = JSON.parse(window.sessionStorage.getItem('cherry-auth-lock-reloaded'))
    expect(stored.count).toBe(1)
  })

  it('busy calls do not count toward the 3× budget', () => {
    beginLongTask()
    expect(supa.handleLockPoison()).toBe(false)
    expect(supa.handleLockPoison()).toBe(false)
    endLongTask()
    // Still a full budget of 3: the two busy calls spent nothing.
    expect(supa.handleLockPoison()).toBe(true)
    // 10 s gap rule: the next immediate call is blocked by the gap,
    // not the budget — advance past it and spend the rest.
    vi.advanceTimersByTime(11000)
    expect(supa.handleLockPoison()).toBe(true)
    vi.advanceTimersByTime(11000)
    expect(supa.handleLockPoison()).toBe(true)
    vi.advanceTimersByTime(11000)
    expect(supa.handleLockPoison()).toBe(false) // budget spent (3)
  })

  it('reloads (jittered) once the task ends', () => {
    expect(supa.handleLockPoison()).toBe(true)
    expect(reloadSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2000)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })
})
