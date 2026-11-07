// @vitest-environment jsdom
// v9.25 slow-network fixes — lazy chunk loading (worker D).
// lazyWithRetry used to retry 3× back-to-back with no delay, then throw
// the last error into the ErrorBoundary (crash screen). Now it backs off
// (1 s, then 3 s) and a chunk that still fails NEVER throws — the factory
// resolves to a component rendering the ErrorScreen-style retry UI
// (variant "chunk"), so the user gets a Retry button, not a crash.
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { Suspense, Component } from 'react'
import { act } from 'react'
import { render, screen, cleanup } from '@testing-library/react'

let loadChunkWithRetry
let lazyWithRetry
let CHUNK_RETRY_DELAYS_MS

beforeAll(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://fake.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-anon-key')
  const app = await import('./App')
  // loadChunkWithRetry / lazyWithRetry are exported for tests; the
  // integration test below exercises the real React.lazy path.
  loadChunkWithRetry = app.loadChunkWithRetry
  lazyWithRetry = app.lazyWithRetry
  CHUNK_RETRY_DELAYS_MS = app.CHUNK_RETRY_DELAYS_MS
})

afterAll(() => {
  vi.unstubAllEnvs()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  window.sessionStorage.clear()
})

// Spy boundary: records a trip instead of rendering the crash screen.
class TripSpy extends Component {
  constructor(props) {
    super(props)
    this.state = { tripped: false }
  }

  static getDerivedStateFromError() {
    return { tripped: true }
  }

  componentDidCatch() {}

  render() {
    if (this.state.tripped) return <div>TRIPPED</div>
    return this.props.children
  }
}

describe('loadChunkWithRetry backoff (v9.25)', () => {
  it('backs off 1 s then 3 s between attempts', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(CHUNK_RETRY_DELAYS_MS).toEqual([1000, 3000])
    let calls = 0
    const importFn = vi.fn(async () => {
      calls += 1
      if (calls < 3) throw new Error('chunk 503')
      return { default: () => null }
    })
    const promise = loadChunkWithRetry(importFn)
    // Still inside the first 1 s backoff — no 2nd attempt yet.
    await vi.advanceTimersByTimeAsync(999)
    expect(importFn).toHaveBeenCalledTimes(1)
    // First backoff elapses → attempt 2 fails → 3 s backoff starts.
    await vi.advanceTimersByTimeAsync(1)
    expect(importFn).toHaveBeenCalledTimes(2)
    // Still inside the 3 s backoff — no 3rd attempt yet.
    await vi.advanceTimersByTimeAsync(2999)
    expect(importFn).toHaveBeenCalledTimes(2)
    // Second backoff elapses → attempt 3 succeeds.
    await vi.advanceTimersByTimeAsync(1)
    const mod = await promise
    expect(mod.default).toBeTypeOf('function')
    expect(importFn).toHaveBeenCalledTimes(3)
  })

  it('final failure resolves (never rejects) to the chunk retry screen', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const promise = loadChunkWithRetry(async () => {
      throw new Error('chunk 503')
    })
    await vi.advanceTimersByTimeAsync(5000)
    const mod = await promise
    expect(mod.default).toBeTypeOf('function')
    // The resolved component is the ErrorScreen-style retry UI.
    render(<mod.default />)
    expect(screen.getByText('App တင်မရပါ')).toBeTruthy()
    expect(screen.getByText('ပြန်ကြိုးစားမည်')).toBeTruthy()
  })
})

describe('lazy chunk failure never reaches the ErrorBoundary (v9.25)', () => {
  it('a permanently failing chunk renders the retry screen, no boundary trip', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const FailingPage = lazyWithRetry(async () => {
      throw new Error('chunk 503')
    })
    render(
      <TripSpy>
        <Suspense fallback={<div>Loading...</div>}>
          <FailingPage />
        </Suspense>
      </TripSpy>,
    )
    expect(screen.getByText('Loading...')).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(screen.getByText('App တင်မရပါ')).toBeTruthy()
    expect(screen.getByText('ပြန်ကြိုးစားမည်')).toBeTruthy()
    expect(screen.queryByText('TRIPPED')).toBeNull()
  })
})
