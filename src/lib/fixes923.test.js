import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// v9.23: error-screen recovery instructions (Android: clear cache;
// iOS: delete the home-screen Shortcut and re-add it), the same hint on
// the Home data-error banner, and SW v14 (install-time skipWaiting so a
// new worker activates at once). Source-scan tests: the platform-aware
// lines themselves are unit-tested in recoverySteps.test.js and the
// crash-screen render in ErrorBoundary923.test.jsx; this file pins the
// version + the Change Log entry (zero Admin).

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(srcDir, rel), 'utf8')

// Slice the changelog entry for version v out of Header.jsx source.
function changelogEntry(header, v, nextV) {
  const start = header.indexOf(`{ v: '${v}'`)
  expect(start).toBeGreaterThan(-1)
  const end = nextV ? header.indexOf(`{ v: '${nextV}'`, start) : header.length
  return header.slice(start, end === -1 ? header.length : end)
}

describe('v9.23: version + Change Log Admin rule', () => {
  it('package.json is 9.28', () => {
    const pkg = JSON.parse(readFileSync(join(srcDir, '..', 'package.json'), 'utf8'))
    expect(pkg.version).toBe('9.31')
  })

  it('the 9.23 entry is new, on top, dated 2026-11-06, with zero Admin mentions', () => {
    const header = read('components/Header.jsx')
    expect(header).toContain("{ v: '9.23', date: '2026-11-06'")
    expect(header.match(/v: '9\.23'/g).length).toBe(1)
    expect(header.indexOf("v: '9.23'")).toBeLessThan(header.indexOf("v: '9.22'"))
    const entry = changelogEntry(header, '9.23', '9.22')
    expect(entry).not.toContain('Admin')
    expect(entry).toContain('Shortcut')
    expect(entry).toContain('Cache')
  })

  it('the 9.22 entry is untouched (still one, still before 9.21, still no Admin)', () => {
    const header = read('components/Header.jsx')
    expect(header.match(/v: '9\.22'/g).length).toBe(1)
    expect(header.indexOf("v: '9.22'")).toBeLessThan(header.indexOf("v: '9.21'"))
    const entry = changelogEntry(header, '9.22', '9.21')
    expect(entry).not.toContain('Admin')
    expect(entry).toContain('Tab နှစ်ခု')
  })
})
