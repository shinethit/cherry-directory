import { describe, it, expect } from 'vitest'
import { withTimeout, TimeoutError } from './withTimeout'

describe('withTimeout', () => {
  it('resolves with the promise value when it settles in time', async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, 'fast')
    expect(result).toBe(42)
  })

  it('rejects with TimeoutError after the timeout', async () => {
    const never = new Promise(() => {})
    await expect(withTimeout(never, 20, 'hung query')).rejects.toBeInstanceOf(TimeoutError)
  })

  it('TimeoutError carries the label and ms', async () => {
    const never = new Promise(() => {})
    try {
      await withTimeout(never, 25, 'Home data')
      expect.unreachable('should have timed out')
    } catch (e) {
      expect(e).toBeInstanceOf(TimeoutError)
      expect(e.label).toBe('Home data')
      expect(e.ms).toBe(25)
      expect(e.message).toContain('Home data')
    }
  })

  it('passes through a rejection that happens before the timeout', async () => {
    const boom = Promise.reject(new Error('query failed'))
    await expect(withTimeout(boom, 1000, 'failing')).rejects.toThrow('query failed')
  })

  it('does not reject after the promise already resolved', async () => {
    const result = await withTimeout(
      new Promise((resolve) => setTimeout(() => resolve('ok'), 10)),
      500,
      'slow but fine',
    )
    expect(result).toBe('ok')
  })
})
