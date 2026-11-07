// @vitest-environment jsdom
// v9.26 — UpdatePrompt must not reload while a long task runs (worker C).
// The "ပြန်ဖွင့်မည်" button is disabled (visually + functionally) while
// busy, with a note that the update applies after the current task
// finishes; the click handler re-checks the flag as well, so a click
// that slips through the 1 s poll still cannot reload.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { beginLongTask, endLongTask } from '../lib/longTask'
import UpdatePrompt from './UpdatePrompt'

const swMock = vi.hoisted(() => ({
  applyUpdate: vi.fn(),
  updateAvailable: true,
  updating: false,
}))

vi.mock('../hooks/useServiceWorker', () => ({
  useServiceWorker: () => swMock,
}))

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
  swMock.applyUpdate.mockClear()
  swMock.updateAvailable = true
  swMock.updating = false
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
