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
