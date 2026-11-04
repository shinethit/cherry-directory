import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadPartial, createAutoRetryGuard } from './loadPartial'

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('loadPartial', () => {
  it('resolves with all results and timedOut false when everything settles in time', async () => {
    const { results, timedOut } = await loadPartial(
      [Promise.resolve(1), Promise.resolve(2)],
      1000,
    )
    expect(timedOut).toBe(false)
    expect(results).toEqual([
      { status: 'fulfilled', value: 1 },
      { status: 'fulfilled', value: 2 },
    ])
  })

  it('slow promise does not blank the page: partial results are kept and timedOut is reported', async () => {
    const fast = Promise.resolve('posts')
    const hung = new Promise(() => {})
    const failing = Promise.reject(new Error('categories failed'))
    const { results, timedOut } = await loadPartial([fast, hung, failing], 30)
    expect(timedOut).toBe(true)
    expect(results[0]).toEqual({ status: 'fulfilled', value: 'posts' })
    // Still pending at the timeout — the caller marks this section failed,
    // but the fast section above stays rendered.
    expect(results[1]).toEqual({ status: 'pending' })
    expect(results[2].status).toBe('rejected')
    expect(results[2].reason.message).toBe('categories failed')
  })

  it('never rejects on timeout', async () => {
    const hung = new Promise(() => {})
    await expect(loadPartial([hung], 20)).resolves.toMatchObject({ timedOut: true })
  })

  it('streams results as they arrive via onSettled, including late arrivals after the timeout', async () => {
    const seen = []
    const late = deferred()
    const { results, timedOut } = await loadPartial(
      [Promise.resolve('fast'), late.promise],
      30,
      (i, outcome) => seen.push([i, outcome]),
    )
    expect(timedOut).toBe(true)
    expect(results[1]).toEqual({ status: 'pending' })
    expect(seen).toEqual([[0, { status: 'fulfilled', value: 'fast' }]])
    // The slow query finishing after the timeout still streams in, so the
    // section can render instead of staying failed forever.
    late.resolve('slow but arrived')
    await new Promise((r) => setTimeout(r, 10))
    expect(seen).toEqual([
      [0, { status: 'fulfilled', value: 'fast' }],
      [1, { status: 'fulfilled', value: 'slow but arrived' }],
    ])
  })

  it('reports a rejection through onSettled without rejecting itself', async () => {
    const seen = []
    const { results, timedOut } = await loadPartial(
      [Promise.reject(new Error('boom'))],
      1000,
      (i, outcome) => seen.push([i, outcome]),
    )
    expect(timedOut).toBe(false)
    expect(results[0].status).toBe('rejected')
    expect(seen[0][1].status).toBe('rejected')
  })

  it('resolves immediately for an empty list', async () => {
    await expect(loadPartial([], 1000)).resolves.toEqual({ results: [], timedOut: false })
  })
})

describe('createAutoRetryGuard', () => {
  it('auto-retry runs once then stops', () => {
    const guard = createAutoRetryGuard()
    expect(guard.shouldRetry()).toBe(true)
    expect(guard.shouldRetry()).toBe(false)
    expect(guard.shouldRetry()).toBe(false)
  })

  it('manual retry resets the guard so a user retry can auto-retry once again', () => {
    const guard = createAutoRetryGuard()
    expect(guard.shouldRetry()).toBe(true)
    expect(guard.shouldRetry()).toBe(false)
    guard.reset()
    expect(guard.shouldRetry()).toBe(true)
    expect(guard.shouldRetry()).toBe(false)
  })
})

describe('HomePage timeout wiring (v9.7)', () => {
  // No jsdom / testing-library in this repo (vitest runs in node env), so
  // the HomePage component itself cannot be mounted here. The helper is
  // tested thoroughly above; these assertions pin the wiring in the page
  // source instead of pretending a component test ran.
  const homeSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'pages', 'HomePage.jsx'),
    'utf8',
  )

  it('timeout value is 30 s', () => {
    expect(homeSrc).toMatch(/export const LOAD_TIMEOUT_MS = 30000/)
  })

  it('uses loadPartial (never withTimeout) for the main load and community stats', () => {
    expect(homeSrc).toContain("from '../lib/loadPartial'")
    expect(homeSrc).not.toContain('withTimeout')
    expect(homeSrc).not.toContain('TimeoutError')
    expect(homeSrc).toMatch(/loadPartial\(\[/)
  })

  it('schedules exactly one auto-retry after a 2 s delay, guarded', () => {
    expect(homeSrc).toMatch(/setTimeout\(\(\) => \{\s*setAutoRetrying\(false\);\s*loadData\(\);\s*\}, 2000\)/)
    expect(homeSrc).toContain('autoRetryGuardRef.current.shouldRetry()')
  })

  it('never tells an online user to check the internet', () => {
    expect(homeSrc).not.toContain('အင်တာနက် စစ်ပြီး ပြန်ကြိုးစားပါ')
    expect(homeSrc).toContain('Data အချို့ တင်မရသေးပါ — ပြန်ကြိုးစားမည်')
    expect(homeSrc).toContain('Data တင်တာ ကြာနေသည် — ထပ်ကြိုးစားနေသည်')
    // The genuine offline notice stays untouched.
    expect(homeSrc).toContain('အင်တာနက် မရှိပါ — Offline ဖြစ်နေသည်')
  })

  it('manual refresh resets the auto-retry guard', () => {
    expect(homeSrc).toContain('autoRetryGuardRef.current.reset()')
  })
})
