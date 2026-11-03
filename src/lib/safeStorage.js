// Safe localStorage access — v9.3 (H-2).
// localStorage throws SecurityError in private mode / blocked storage, which
// used to crash the app before React even rendered. Every launch-path
// access must go through these helpers: they never throw, they return null
// (get) / false (set/remove) on failure instead.
export function safeGet(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function safeRemove(key) {
  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
