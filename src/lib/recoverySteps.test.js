// v9.23: recovery steps on the error screens (recoverySteps.js).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getPlatform, getRecoveryLines, RECOVERY_LINES } from './recoverySteps'

const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', platform: 'iPhone', maxTouchPoints: 5 }
const IPAD_OS = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', platform: 'MacIntel', maxTouchPoints: 5 }
const ANDROID = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36', platform: 'Linux armv8l', maxTouchPoints: 5 }
const DESKTOP = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', platform: 'Win32', maxTouchPoints: 0 }

describe('getPlatform', () => {
  it('iPhone UA -> ios', () => { expect(getPlatform(IPHONE)).toBe('ios') })
  it('iPadOS (MacIntel + touch) -> ios', () => { expect(getPlatform(IPAD_OS)).toBe('ios') })
  it('Android UA -> android', () => { expect(getPlatform(ANDROID)).toBe('android') })
  it('desktop UA -> other', () => { expect(getPlatform(DESKTOP)).toBe('other') })
  it('no navigator -> other', () => { expect(getPlatform(null)).toBe('other') })
  it('empty object -> other', () => { expect(getPlatform({})).toBe('other') })
})

describe('getRecoveryLines', () => {
  it('ios shows only the Shortcut line', () => {
    const lines = getRecoveryLines('ios')
    expect(lines).toEqual(RECOVERY_LINES.ios)
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('Shortcut')
    expect(lines[0]).toContain('Add to Home Screen')
  })
  it('android shows only the Clear-cache line', () => {
    const lines = getRecoveryLines('android')
    expect(lines).toEqual(RECOVERY_LINES.android)
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain('Clear cache')
  })
  it('other shows both lines, android first', () => {
    const lines = getRecoveryLines('other')
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain('Clear cache')
    expect(lines[1]).toContain('Shortcut')
  })
  it('no-arg follows the stubbed global navigator', () => {
    vi.stubGlobal('navigator', IPHONE)
    expect(getRecoveryLines()).toEqual(RECOVERY_LINES.ios)
    vi.stubGlobal('navigator', ANDROID)
    expect(getRecoveryLines()).toEqual(RECOVERY_LINES.android)
  })
})

afterEach(() => { vi.unstubAllGlobals() })
