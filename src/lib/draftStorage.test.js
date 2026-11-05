import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// draftStorage is pure localStorage JSON — no Supabase. Node env has no
// localStorage, so the tests install a small in-memory stub.
function makeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
    clear: () => { map.clear() },
  }
}

import { draftKey, saveDraft, loadDraft, clearDraft, debounce } from './draftStorage'

describe('draftStorage (v9.17 Issue 2)', () => {
  let storage
  beforeEach(() => {
    storage = makeStorage()
    globalThis.localStorage = storage
  })
  afterEach(() => { delete globalThis.localStorage })

  it('keys drafts by kind and listing id', () => {
    expect(draftKey('edit', 'abc')).toBe('cherry-draft-edit-abc')
    expect(draftKey('submit')).toBe('cherry-draft-submit')
  })

  it('round-trips a form through save/load and clears it', () => {
    const key = draftKey('edit', 'abc')
    expect(loadDraft(key)).toBeNull()
    expect(saveDraft(key, { name_mm: 'ဆိုင်', phones: ['09123'] })).toBe(true)
    const loaded = loadDraft(key)
    expect(loaded.form).toEqual({ name_mm: 'ဆိုင်', phones: ['09123'] })
    expect(typeof loaded.savedAt).toBe('number')
    clearDraft(key)
    expect(loadDraft(key)).toBeNull()
  })

  it('loadDraft returns null for missing or corrupt entries', () => {
    storage.setItem('cherry-edit-draft-x', 'not-json{')
    expect(loadDraft('cherry-edit-draft-x')).toBeNull()
    storage.setItem('cherry-edit-draft-y', JSON.stringify({ noForm: true }))
    expect(loadDraft('cherry-edit-draft-y')).toBeNull()
  })

  it('never throws when storage is unavailable', () => {
    globalThis.localStorage = {
      getItem: () => { throw new Error('denied') },
      setItem: () => { throw new Error('denied') },
      removeItem: () => { throw new Error('denied') },
    }
    expect(saveDraft('k', {})).toBe(false)
    expect(loadDraft('k')).toBeNull()
    expect(() => clearDraft('k')).not.toThrow()
  })

  it('debounce fires once with the last args, and .cancel() prevents it', () => {
    vi.useFakeTimers()
    try {
      const fn = vi.fn()
      const d = debounce(fn, 500)
      d('a'); d('b'); d('c')
      vi.advanceTimersByTime(499)
      expect(fn).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith('c')

      const fn2 = vi.fn()
      const d2 = debounce(fn2, 500)
      d2('x')
      d2.cancel()
      vi.advanceTimersByTime(1000)
      expect(fn2).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
