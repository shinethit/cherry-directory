// Partial-load helper — v9.7 (Track A).
// withTimeout rejects on timeout, which discarded results that had already
// arrived (Home showed nothing on slow mobile data even when most queries
// had resolved in a few seconds). loadPartial never rejects on timeout:
// it resolves with whatever settled inside the window, marks the rest
// 'pending', and keeps calling onSettled for late arrivals so a slow query
// can still render after the loading flag clears.

export function loadPartial(promises, timeoutMs, onSettled) {
  const list = Array.from(promises)
  const results = list.map(() => ({ status: 'pending' }))
  if (list.length === 0) {
    return Promise.resolve({ results: [], timedOut: false })
  }
  let settledCount = 0
  let done = false
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (done) return
      done = true
      resolve({ results: [...results], timedOut: true })
    }, timeoutMs)
    const finishIfAllSettled = () => {
      if (settledCount === list.length && !done) {
        done = true
        clearTimeout(timer)
        resolve({ results: [...results], timedOut: false })
      }
    }
    list.forEach((p, i) => {
      // The rejection handler below swallows every rejection, so the
      // wrapped promise never rejects and no unhandled rejection can leak.
      Promise.resolve(p).then(
        (value) => {
          const outcome = { status: 'fulfilled', value }
          results[i] = outcome
          settledCount += 1
          if (onSettled) onSettled(i, outcome)
          finishIfAllSettled()
          return outcome
        },
        (reason) => {
          const outcome = { status: 'rejected', reason }
          results[i] = outcome
          settledCount += 1
          if (onSettled) onSettled(i, outcome)
          finishIfAllSettled()
          return outcome
        },
      )
    })
  })
}

// Auto-retry guard — v9.7 (Track A). One retry per load cycle, then stop.
// HomePage resets the guard on a manual retry so a user retry can
// auto-retry once again.
export function createAutoRetryGuard() {
  let used = false
  return {
    shouldRetry() {
      if (used) return false
      used = true
      return true
    },
    reset() {
      used = false
    },
    get used() {
      return used
    },
  }
}
