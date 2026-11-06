import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Wording guard (v9.19): the user asked for "ခပ်သိမ်း" / "အကုန်" to be
// "အားလုံး" everywhere in the UI (house style — LangContext all_types
// already uses 'အားလုံး'). This test reads every UI source file and
// fails if either word comes back. Test files themselves are excluded
// (this file names the words in its assertions). Header.jsx is excluded
// from the blanket scan: its ONLY occurrence is the v9.19 changelog
// entry, which names the old words to say what changed ('ခပ်သိမ်း /
// အကုန် → အားလုံး') — a dated record of the rename, not a live UI
// string — and the dedicated test below pins it to that one line.

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')

// Separator-agnostic Header.jsx exclusion (v9.19 correction): on Windows
// path.join produces backslash paths (D:\...\src\components\Header.jsx),
// so a forward-slash endsWith('components/Header.jsx') NEVER matches and
// the exclusion silently fails — the two blanket tests then fail on the
// v9.19 changelog line itself (the 9.19 script's first run failed exactly
// this way on the user's Windows machine, 2 failed | 158 passed). Always
// normalize backslashes to forward slashes before comparing.
export function isExcludedHeader(filePath) {
  return filePath.replace(/\\/g, '/').endsWith('components/Header.jsx')
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e)
    if (statSync(full).isDirectory()) {
      if (e === 'node_modules') continue
      walk(full, out)
    } else if ((e.endsWith('.js') || e.endsWith('.jsx')) && !e.endsWith('.test.js')) {
      // Header.jsx: see the header comment — its v9.19 changelog entry
      // names the renamed words; covered by the dedicated test below.
      // `continue` (not `return`): skip just this file, keep scanning
      // the rest of the directory — `return` would abort the whole
      // directory walk and silently skip files after Header.jsx.
      if (isExcludedHeader(full)) continue
      out.push(full)
    }
  }
  return out
}

describe('wording: ခပ်သိမ်း / အကုန် must not return to the UI (v9.19)', () => {
  it('no UI source file contains ခပ်သိမ်း', () => {
    const hits = walk(srcDir).filter(f => readFileSync(f, 'utf8').includes('ခပ်သိမ်း'))
    expect(hits).toEqual([])
  })

  it('no UI source file contains အကုန်', () => {
    const hits = walk(srcDir).filter(f => readFileSync(f, 'utf8').includes('အကုန်'))
    expect(hits).toEqual([])
  })

  it('the Header.jsx exclusion works on Windows-style paths', () => {
    // The 9.19 first run failed on Windows because walk() compared a
    // forward-slash suffix against backslash paths. This test feeds the
    // exclusion predicate Windows-style paths directly, so the fix is
    // covered on any OS — a Linux-only run can never let it regress.
    expect(isExcludedHeader('D:\\cherry-directory-main\\src\\components\\Header.jsx')).toBe(true)
    expect(isExcludedHeader('D:/cherry-directory-main/src/components/Header.jsx')).toBe(true)
    expect(isExcludedHeader('/home/user/cherry-directory/src/components/Header.jsx')).toBe(true)
    expect(isExcludedHeader('D:\\cherry-directory-main\\src\\pages\\HomePage.jsx')).toBe(false)
    expect(isExcludedHeader('D:\\cherry-directory-main\\src\\components\\UI.jsx')).toBe(false)
    expect(isExcludedHeader('D:\\cherry-directory-main\\src\\components\\Header.jsx.bak')).toBe(false)
  })

  it('the six normalized strings use အားလုံး', () => {
    const lang = readFileSync(join(srcDir, 'contexts', 'LangContext.jsx'), 'utf8')
    expect(lang).toContain("all_cities: { mm: 'အားလုံး'")
    const dir = readFileSync(join(srcDir, 'pages', 'DirectoryPage.jsx'), 'utf8')
    expect(dir).toContain("'📍 အားလုံး'")
    const home = readFileSync(join(srcDir, 'pages', 'HomePage.jsx'), 'utf8')
    expect(home).toContain('အပေါ်က အားလုံး +')
    const info = readFileSync(join(srcDir, 'pages', 'InfoPages.jsx'), 'utf8')
    expect(info).toContain('(အပေါ်က အားလုံး +)')
    const board = readFileSync(join(srcDir, 'pages', 'LeaderboardPage.jsx'), 'utf8')
    expect(board).toContain("labelMm: 'အားလုံး'")
    expect(board).toContain('အချိန်ကာလ အားလုံး')
  })

  it('Header.jsx names the old words ONLY in the v9.19 changelog entry', () => {
    const header = readFileSync(join(srcDir, 'components', 'Header.jsx'), 'utf8')
    const hits = header.split('\n').filter(l => l.includes('ခပ်သိမ်း') || l.includes('အကုန်'))
    expect(hits.length).toBe(1)
    expect(hits[0]).toContain("v: '9.19'")
    expect(hits[0]).toContain('အားလုံး')
  })
})
