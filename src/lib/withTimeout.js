// Promise timeout wrapper — v9.3 (C-2 / H-4).
// A hung Supabase query used to freeze the page forever (skeletons with no
// error and no retry). Racing the promise against a timer guarantees the
// caller always settles; the underlying promise is left to finish silently.

export class TimeoutError extends Error {
  constructor(label, ms) {
    super(`Timed out after ${ms}ms: ${label}`)
    this.name = 'TimeoutError'
    this.label = label
    this.ms = ms
  }
}

export function withTimeout(promise, ms, label = 'operation') {
  let timer = null
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}
