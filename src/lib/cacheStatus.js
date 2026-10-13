/**
 * Cache status store — simple event-driven state
 * Components can subscribe to know when prefetch is done
 */

let state = {
  running: false,
  lastRunAt: null,
  totalTasks: 0,
  succeeded: 0,
  failed: 0,
  items: [],       // [{ key, label, count, status }]
  error: null,
}

const listeners = new Set()

function notify() {
  const snapshot = { ...state }
  listeners.forEach(fn => {
    try { fn(snapshot) } catch {}
  })
}

export function subscribe(fn) {
  listeners.add(fn)
  fn({ ...state })  // immediate
  return () => listeners.delete(fn)
}

export function getState() {
  return { ...state }
}

export function startRun(totalTasks) {
  state = {
    ...state,
    running: true,
    lastRunAt: null,
    totalTasks,
    succeeded: 0,
    failed: 0,
    items: [],
    error: null,
  }
  notify()
}

export function recordItem(item) {
  state = {
    ...state,
    items: [...state.items, item],
    succeeded: state.succeeded + (item.status === 'ok' ? 1 : 0),
    failed: state.failed + (item.status === 'error' ? 1 : 0),
  }
  notify()
}

export function finishRun() {
  state = {
    ...state,
    running: false,
    lastRunAt: new Date().toISOString(),
  }
  notify()
}

export function failRun(err) {
  state = {
    ...state,
    running: false,
    error: err?.message || String(err),
    lastRunAt: new Date().toISOString(),
  }
  notify()
}

// ── localStorage inspection helpers ─────────────────────
const PERSIST_KEY = 'cherry-directory-cache'

export function inspectLocalStorage() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) {
      return { exists: false, size: 0, queryCount: 0, keys: [] }
    }
    const parsed = JSON.parse(raw)
    const queries = parsed?.clientState?.queries || []
    const keys = queries.map(q => ({
      key: Array.isArray(q.queryKey) ? q.queryKey.join('/') : String(q.queryKey),
      hasData: q.state?.data != null,
      dataUpdatedAt: q.state?.dataUpdatedAt,
    }))
    return {
      exists: true,
      size: raw.length,
      sizeKB: Math.round(raw.length / 1024),
      queryCount: queries.length,
      keys,
    }
  } catch (e) {
    return { exists: false, size: 0, queryCount: 0, keys: [], error: e.message }
  }
}

export function clearCache() {
  try {
    localStorage.removeItem(PERSIST_KEY)
    return true
  } catch { return false }
}
