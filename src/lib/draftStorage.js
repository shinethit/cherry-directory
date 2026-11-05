// Draft autosave — v9.17 (Issue 2). Edit/submit form state lives only in
// React state, so an iOS-evicted PWA reload loses every unsaved edit
// ("no recent memory"). Drafts are plain JSON in localStorage, written
// debounced by the caller (~500 ms) and cleared on successful save.
// A draft restores over the server row on mount (the user's latest typing
// wins); a failed server load renders the draft with a banner instead of
// a blank error screen. Never throws — storage may be unavailable.
const PREFIX = 'cherry-draft-'

export function draftKey(kind, id) {
  return PREFIX + kind + (id ? '-' + id : '')
}

export function saveDraft(key, form) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), form }))
    return true
  } catch {
    return false
  }
}

export function loadDraft(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.form) return null
    return parsed
  } catch {
    return null
  }
}

export function clearDraft(key) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

// Small debounce helper for the autosave effect (no extra dependency).
// The returned function carries .cancel() — call it before clearDraft
// on successful save, or a pending debounced write rewrites the draft
// a moment after it was cleared.
export function debounce(fn, ms) {
  let timer = null
  const debounced = (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; fn(...args) }, ms)
  }
  debounced.cancel = () => { if (timer) { clearTimeout(timer); timer = null } }
  return debounced
}
