// @vitest-environment jsdom
// v9.26 — reloadForUpdate defers while a long task runs (worker C).
// Behavioural tests with a mocked service-worker registration (no real
// SW): while a task runs, applyUpdate reloads nothing and posts no
// SKIP_WAITING; once the task ends, the deferred reload runs exactly
// once. Detection is untouched — only the reload is deferred.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useServiceWorker } from './useServiceWorker'
import { beginLongTask, endLongTask } from '../lib/longTask'
import { APP_VERSION } from '../lib/appVersion'

// v9.27 fix: the "newer"/"older" server versions are derived from the
// running APP_VERSION (minor ± 1) instead of hardcoded literals — the
// 9.26 → 9.27 bump made a literal '9.27' no longer newer than the
// running version, which broke the "newer server" test while the
// production logic was correct. Deriving them keeps these tests green
// across future bumps.
function shiftMinor(v, delta) {
  const m = String(v).match(/^(\d+)\.(\d+)/)
  return m ? `${m[1]}.${Number(m[2]) + delta}` : v
}
const NEWER_VERSION = shiftMinor(APP_VERSION, 1)
const OLDER_VERSION = shiftMinor(APP_VERSION, -1)

function fakeReg(waiting) {
  return {
    scope: '/',
    waiting: waiting || null,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
    onupdatefound: null,
  }
}

let reg
let reloadSpy
// jsdom's window.location is an own (configurable) property of the
// window instance — `delete` would remove it for good, so save it once
// and restore it with defineProperty in afterEach.
const realLocation = window.location

beforeEach(() => {
  vi.useFakeTimers()
  window.sessionStorage.clear()
  window.localStorage.clear()
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
  reg = fakeReg(null)
  Object.defineProperty(window.navigator, 'serviceWorker', {
    value: {
      register: vi.fn().mockResolvedValue(reg),
      getRegistration: vi.fn().mockResolvedValue(reg),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    configurable: true,
  })
  // Server version == running version: detection stays quiet so the
  // tests exercise only the reload path.
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ({
    ok: true,
    json: async () => ({ version: APP_VERSION }),
  }))
})

afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'location', { value: realLocation, configurable: true })
  for (let i = 0; i < 10; i++) endLongTask()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

async function renderReady() {
  const utils = renderHook(() => useServiceWorker())
  await flush()
  return utils
}

describe('reloadForUpdate long-task deferral (v9.26)', () => {
  it('reloads immediately when no long task is running (no-waiting path)', async () => {
    const { result } = await renderReady()
    await act(async () => { await result.current.applyUpdate() })
    await flush()
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('defers while a long task runs, then reloads once it ends', async () => {
    const { result } = await renderReady()
    beginLongTask()
    await act(async () => { await result.current.applyUpdate() })
    await flush()
    expect(reloadSpy).not.toHaveBeenCalled()
    // The button must not spin "updating…" for the whole import.
    expect(result.current.updating).toBe(false)
    // Still deferred after time passes while the task runs.
    await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
    expect(reloadSpy).not.toHaveBeenCalled()
    endLongTask()
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    await flush()
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('waiting-worker path also defers (no SKIP_WAITING while busy)', async () => {
    const waiting = { postMessage: vi.fn() }
    reg.waiting = waiting
    const { result } = await renderReady()
    beginLongTask()
    await act(async () => { await result.current.applyUpdate() })
    await flush()
    expect(waiting.postMessage).not.toHaveBeenCalled()
    expect(reloadSpy).not.toHaveBeenCalled()
    endLongTask()
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    await flush()
    expect(waiting.postMessage).toHaveBeenCalledTimes(1)
    expect(waiting.postMessage).toHaveBeenCalledWith('SKIP_WAITING')
    // No controllerchange fires in jsdom — the 4 s fallback reloads.
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    await flush()
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('a second applyUpdate while deferred does not duplicate the deferral', async () => {
    const { result } = await renderReady()
    beginLongTask()
    await act(async () => { await result.current.applyUpdate() })
    await act(async () => { await result.current.applyUpdate() })
    await flush()
    endLongTask()
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    await flush()
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })
})

describe('server-version detection: newer only + focus throttle (v9.27)', () => {
  it('a rollback (server older than running) never prompts', async () => {
    globalThis.fetch.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ version: OLDER_VERSION }),
    }))
    const { result } = await renderReady()
    await flush()
    expect(result.current.updateAvailable).toBe(false)
    expect(result.current.serverVersion).toBe(OLDER_VERSION)
  })

  it('a newer server version prompts (after the ~20 s wait for a waiting worker)', async () => {
    globalThis.fetch.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ version: NEWER_VERSION }),
    }))
    const { result } = await renderReady()
    await act(async () => { await vi.advanceTimersByTimeAsync(20000) })
    await flush()
    expect(result.current.updateAvailable).toBe(true)
    expect(result.current.serverVersion).toBe(NEWER_VERSION)
  })

  it('focus-triggered checks run at most once per 5 min', async () => {
    await renderReady()
    await flush()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    // A second app-switch moments later fires no fetch.
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    // After 5 min, the next focus checks again.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000)
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(globalThis.fetch).toHaveBeenCalledTimes(3)
  })
})
