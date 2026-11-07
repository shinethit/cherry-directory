import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// v9.24: Home crashed with `ne.has is not a function` — useBookmarkedSet
// stored a Set in the query cache, and the persister serializes the
// cache to localStorage as JSON, so a restored entry was '{}' (no .has).
// The fix stores an array (JSON-safe) and converts to a Set in `select`.
// This file pins the version + the Change Log entry (zero Admin).

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(srcDir, rel), 'utf8')

// Slice the changelog entry for version v out of Header.jsx source.
function changelogEntry(header, v, nextV) {
  const start = header.indexOf(`{ v: '${v}'`)
  expect(start).toBeGreaterThan(-1)
  const end = nextV ? header.indexOf(`{ v: '${nextV}'`, start) : header.length
  return header.slice(start, end === -1 ? header.length : end)
}

describe('v9.25: version + Change Log Admin rule', () => {
  it('package.json is 9.28', () => {
    const pkg = JSON.parse(readFileSync(join(srcDir, '..', 'package.json'), 'utf8'))
    expect(pkg.version).toBe('9.28')
  })

  it('the 9.25 entry is new, on top, dated 2026-11-06, with zero Admin mentions', () => {
    const header = read('components/Header.jsx')
    expect(header).toContain("{ v: '9.25', date: '2026-11-06'")
    expect(header.match(/v: '9\.25'/g).length).toBe(1)
    expect(header.indexOf("v: '9.25'")).toBeLessThan(header.indexOf("v: '9.23'"))
    const entry = changelogEntry(header, '9.25', '9.23')
    expect(entry).not.toContain('Admin')
    expect(entry).toContain('Home')
  })

  it('the 9.23 entry is untouched (still one, still before 9.22, still no Admin)', () => {
    const header = read('components/Header.jsx')
    expect(header.match(/v: '9\.23'/g).length).toBe(1)
    expect(header.indexOf("v: '9.23'")).toBeLessThan(header.indexOf("v: '9.22'"))
    const entry = changelogEntry(header, '9.23', '9.22')
    expect(entry).not.toContain('Admin')
    expect(entry).toContain('Shortcut')
  })
})
