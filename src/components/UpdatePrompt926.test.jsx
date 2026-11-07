// @vitest-environment jsdom
// v9.26 — UpdatePrompt must not reload while a long task runs (worker C).
// The "ပြန်ဖွင့်မည်" button is disabled (visually + functionally) while
// busy, with a note that the update applies after the current task
// finishes; the click handler re-checks the flag as well, so a click
// that slips through the 1 s poll still cannot reload.
// v9.27 — Cancel must stick (worker C): dismiss → remount stays hidden;
// a dismissal in one tab hides the prompt in another via the `storage`
// event (+ focus re-read); a dismissal older than 24 h re-shows only
// while the server is still newer; a failed localStorage write still
// hides for the session; a rollback never prompts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { beginLongTask, endLongTask } from '../lib/longTask'
import { APP_VERSION } from '../lib/appVersion'
import { isServerVersionNewer } from '../lib/versionCompare'
import UpdatePrompt from './UpdatePrompt'

const swMock = vi.hoisted(() => ({
  applyUpdate: vi.fn(),
  updateAvailable: true,
  updating: false,
  serverVersion: null,
}))

vi.mock('../hooks/useServiceWorker', () => ({
  useServiceWorker: () => swMock,
}))

const DISMISSED_KEY = `cherry_update_dismissed_${APP_VERSION}`
const HOUR_MS = 60 * 60 * 1000

// v9.27 fix: the "newer"/"older" server versions are derived from the
// running APP_VERSION (minor ± 1) instead of hardcoded literals — the
// 9.26 → 9.27 bump made a literal '9.27' no longer newer than the
// running version, which broke every "newer server" test while the
// production logic was correct. Deriving them keeps these tests green
// across future bumps.
function shiftMinor(v, delta) {
  const m = String(v).match(/^(\d+)\.(\d+)/)
  return m ? `${m[1]}.${Number(m[2]) + delta}` : v
}
const NEWER_VERSION = shiftMinor(APP_VERSION, 1)
const OLDER_VERSION = shiftMinor(APP_VERSION, -1)

function dispatchStorageEvent(key, newValue) {
  let event
  try {
    event = new StorageEvent('storage', { key, newValue })
  } catch {
    event = new window.Event('storage')
    Object.defineProperties(event, {
      key: { value: key },
      newValue: { value: newValue },
    })
  }
  act(() => { window.dispatchEvent(event) })
}

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
  swMock.applyUpdate.mockClear()
  swMock.updateAvailable = true
  swMock.updating = false
  swMock.serverVersion = null
})

afterEach(() => {
  cleanup()
  for (let i = 0; i < 10; i++) endLongTask()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('UpdatePrompt long-task guard (v9.26)', () => {
  it('button disabled + note shown while a long task runs; click does nothing', () => {
    beginLongTask()
    render(<UpdatePrompt />)
    const btn = screen.getByText('စောင့်နေသည်…')
    expect(btn.disabled).toBe(true)
    expect(screen.getByText('လက်ရှိ လုပ်ငန်း ပြီးသွားမှ အပ်ဒိတ် အလိုအလျောက် ပြောင်းသွားမည်')).toBeTruthy()
    fireEvent.click(btn)
    expect(swMock.applyUpdate).not.toHaveBeenCalled()
  })

  it('button enabled and clickable when no long task runs', () => {
    render(<UpdatePrompt />)
    const btn = screen.getByText('ပြန်ဖွင့်မည်')
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    expect(swMock.applyUpdate).toHaveBeenCalledTimes(1)
  })

  it('button re-enables once the task ends (1 s poll)', async () => {
    beginLongTask()
    render(<UpdatePrompt />)
    expect(screen.getByText('စောင့်နေသည်…')).toBeTruthy()
    endLongTask()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    const btn = screen.getByText('ပြန်ဖွင့်မည်')
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    expect(swMock.applyUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('UpdatePrompt dismissal sticks (v9.27)', () => {
  it('dismiss records JSON { version, at }; unmount/remount stays hidden', () => {
    const { unmount } = render(<UpdatePrompt />)
    expect(screen.getByText('ပြန်ဖွင့်မည်')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('ပိတ်မည်'))
    expect(screen.queryByText('အသစ်ထွက်ပြီ')).toBeNull()
    const stored = JSON.parse(window.localStorage.getItem(DISMISSED_KEY))
    expect(stored.version).toBe(APP_VERSION)
    expect(typeof stored.at).toBe('number')
    unmount()
    render(<UpdatePrompt />)
    expect(screen.queryByText('အသစ်ထွက်ပြီ')).toBeNull()
  })

  it('old bare-1 dismissal is still honoured (backward compatible)', () => {
    window.localStorage.setItem(DISMISSED_KEY, '1')
    render(<UpdatePrompt />)
    expect(screen.queryByText('အသစ်ထွက်ပြီ')).toBeNull()
  })

  it('two instances: dismiss in one hides the other via a storage event', () => {
    render(<><UpdatePrompt /><UpdatePrompt /></>)
    expect(screen.getAllByText('ပြန်ဖွင့်မည်')).toHaveLength(2)
    fireEvent.click(screen.getAllByLabelText('ပိတ်မည်')[0])
    // The dismissing instance hides at once; the other keeps its own
    // in-memory state until the cross-tab event arrives.
    expect(screen.getAllByText('ပြန်ဖွင့်မည်')).toHaveLength(1)
    // An event for an unrelated key changes nothing.
    dispatchStorageEvent('cherry_update_dismissed_0.0', '1')
    expect(screen.getAllByText('ပြန်ဖွင့်မည်')).toHaveLength(1)
    dispatchStorageEvent(DISMISSED_KEY, window.localStorage.getItem(DISMISSED_KEY))
    expect(screen.queryByText('အသစ်ထွက်ပြီ')).toBeNull()
  })

  it('focus re-read hides the prompt when another tab dismissed meanwhile', () => {
    render(<UpdatePrompt />)
    expect(screen.getByText('ပြန်ဖွင့်မည်')).toBeTruthy()
    // Another tab wrote the key but no storage event reached this tab.
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify({ version: APP_VERSION, at: Date.now() }))
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(screen.queryByText('အသစ်ထွက်ပြီ')).toBeNull()
  })

  it('dismiss still hides for the session when localStorage.setItem throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // NOTE: spy on Storage.prototype — spying on the window.localStorage
    // instance does not intercept (jsdom hands out a fresh wrapper per
    // access), so the write would silently succeed and no warn would fire.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    render(<UpdatePrompt />)
    fireEvent.click(screen.getByLabelText('ပိတ်မည်'))
    expect(screen.queryByText('အသစ်ထွက်ပြီ')).toBeNull()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('could not be saved'))
  })

  it('24 h backstop: dismissal older than 24 h re-shows only while the server is still newer', () => {
    const oldAt = Date.now() - 25 * HOUR_MS
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify({ version: APP_VERSION, at: oldAt }))
    // Server version unknown: the dismissal stands.
    render(<UpdatePrompt />)
    expect(screen.queryByText('အသစ်ထွက်ပြီ')).toBeNull()
    cleanup()
    // Server still newer: the prompt comes back.
    swMock.serverVersion = NEWER_VERSION
    render(<UpdatePrompt />)
    expect(screen.getByText('ပြန်ဖွင့်မည်')).toBeTruthy()
  })

  it('24 h backstop: a fresh dismissal stays hidden even when the server is newer', () => {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify({ version: APP_VERSION, at: Date.now() - HOUR_MS }))
    swMock.serverVersion = NEWER_VERSION
    render(<UpdatePrompt />)
    expect(screen.queryByText('အသစ်ထွက်ပြီ')).toBeNull()
  })

  it('24 h backstop applies when the server version lands after mount', async () => {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify({ version: APP_VERSION, at: Date.now() - 25 * HOUR_MS }))
    const { rerender } = render(<UpdatePrompt />)
    expect(screen.queryByText('အသစ်ထွက်ပြီ')).toBeNull()
    swMock.serverVersion = NEWER_VERSION
    await act(async () => { rerender(<UpdatePrompt />) })
    expect(screen.getByText('ပြန်ဖွင့်မည်')).toBeTruthy()
  })

  it('rollback never prompts; a newer server does; unparseable falls back to prompt-when-different', () => {
    swMock.serverVersion = OLDER_VERSION
    const { unmount } = render(<UpdatePrompt />)
    expect(screen.queryByText('အသစ်ထွက်ပြီ')).toBeNull()
    unmount()
    cleanup()
    swMock.serverVersion = NEWER_VERSION
    render(<UpdatePrompt />)
    expect(screen.getByText('ပြန်ဖွင့်မည်')).toBeTruthy()
    cleanup()
    swMock.serverVersion = 'banana'
    render(<UpdatePrompt />)
    expect(screen.getByText('ပြန်ဖွင့်မည်')).toBeTruthy()
  })

  it('dismiss → server version advances (new running version) → prompt appears again', async () => {
    const { unmount } = render(<UpdatePrompt />)
    fireEvent.click(screen.getByLabelText('ပိတ်မည်'))
    expect(screen.queryByText('အသစ်ထွက်ပြီ')).toBeNull()
    unmount()
    cleanup()
    // Simulate the user actually updating: the running version is now
    // NEWER_VERSION, so the current dismissal key no longer applies.
    vi.resetModules()
    vi.doMock('../lib/appVersion', () => ({ APP_VERSION: NEWER_VERSION, default: NEWER_VERSION }))
    const { default: FreshPrompt } = await import('./UpdatePrompt.jsx')
    render(<FreshPrompt />)
    expect(screen.getByText('ပြန်ဖွင့်မည်')).toBeTruthy()
    vi.doUnmock('../lib/appVersion')
  })
})

describe('isServerVersionNewer (v9.27)', () => {
  it('compares major/minor numerically, falls back to exact inequality', () => {
    expect(isServerVersionNewer('9.27', '9.26')).toBe(true)
    expect(isServerVersionNewer('9.26', '9.26')).toBe(false)
    expect(isServerVersionNewer('9.25', '9.26')).toBe(false)
    expect(isServerVersionNewer('9.10', '9.9')).toBe(true)
    expect(isServerVersionNewer('9.9', '9.10')).toBe(false)
    expect(isServerVersionNewer('10.0', '9.26')).toBe(true)
    expect(isServerVersionNewer('banana', '9.26')).toBe(true)
    expect(isServerVersionNewer('9.26', 'banana')).toBe(true)
    expect(isServerVersionNewer(null, '9.26')).toBe(true)
  })
})
