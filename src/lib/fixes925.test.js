import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// v9.25: horizontal-scroll sweep — every inner sideways scroller converted
// to wrap/grid (tab / chip / filter rows wrap; only genuine data tables may
// keep an overflow-x-auto wrapper), plus the /fuel 360px filter overflow
// found by the real-render worker. The 9.24 Home-crash fix is carried in
// the same version (its entry merged into the 9.25 Change Log entry).

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(srcDir, rel), 'utf8')

// Slice the changelog entry for version v out of Header.jsx source.
function changelogEntry(header, v, nextV) {
  const start = header.indexOf(`{ v: '${v}'`)
  expect(start).toBeGreaterThan(-1)
  const end = nextV ? header.indexOf(`{ v: '${nextV}'`, start) : header.length
  return header.slice(start, end === -1 ? header.length : end)
}

// All non-test source files under src/ that contain `needle` (relative paths).
// Test files are excluded: they mention the strings in their assertions.
// .bak files are excluded too: they are the fix script's own backups of
// PRE-fix content, so on any tree the script just patched they still hold
// the old scroller classes — scanning them would fail the test on every
// real script run (SIM1 caught this: 2 failures, both .bak hits).
// Separator-agnostic path normalization (v9.25 correction): on Windows
// path.join produces backslash paths (D:\...\src\pages\BulkImportPage.jsx),
// so a relative path built by slicing a joined path NEVER equals a
// forward-slash literal — the overflow-x-auto test failed exactly this
// way on the user's Windows machine (1 failed | 442 passed). Always
// normalize backslashes to forward slashes before comparing.
export function toPosixPath(filePath) {
  return filePath.replace(/\\/g, '/')
}

function filesContaining(needle) {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (!/\.bak$/.test(name) && !/\.test\.(js|jsx)$/.test(name) && /\.(js|jsx|css)$/.test(name) && readFileSync(p, 'utf8').includes(needle)) out.push(toPosixPath(p.slice(srcDir.length + 1)))
    }
  }
  walk(srcDir)
  return out.sort()
}

describe('v9.25: version + Change Log Admin rule', () => {
  it('package.json is 9.28', () => {
    const pkg = JSON.parse(readFileSync(join(srcDir, '..', 'package.json'), 'utf8'))
    expect(pkg.version).toBe('9.33')
  })

  it('the 9.25 entry is new, on top, dated 2026-11-06, with zero Admin mentions', () => {
    const header = read('components/Header.jsx')
    expect(header).toContain("{ v: '9.25', date: '2026-11-06'")
    expect(header.match(/v: '9\.25'/g).length).toBe(1)
    expect(header.indexOf("v: '9.25'")).toBeLessThan(header.indexOf("v: '9.23'"))
    expect(header).not.toContain("{ v: '9.24'")
    const entry = changelogEntry(header, '9.25', '9.23')
    expect(entry).not.toContain('Admin')
    // Covers BOTH the carried Home-crash fix and the scroll sweep.
    expect(entry).toContain('Home')
    expect(entry).toContain('scroll')
  })

  it('the 9.26 entry is on top, dated 2026-11-07, with zero Admin mentions', () => {
    const header = read('components/Header.jsx')
    expect(header).toContain("{ v: '9.26', date: '2026-11-07'")
    expect(header.match(/v: '9\.26'/g).length).toBe(1)
    expect(header.indexOf("v: '9.26'")).toBeLessThan(header.indexOf("v: '9.25'"))
    const entry = changelogEntry(header, '9.26', '9.25')
    expect(entry).not.toMatch(/admin/i)
    expect(entry).toContain('အမှတ်')
    expect(entry).toContain('ရပ်သွားတဲ့ နေရာကနေ ဆက်လုပ်မည်')
    expect(entry).toContain('Import ပြီးမှ အပ်ဒိတ်လုပ်မည်')
    expect(entry).toContain('ဗလာ ဖြစ်မသွားတော့ပါ')
    expect(entry).toContain('ဆိုင်အမျိုးအစား အသစ်တွေ')
  })

  it('the 9.27 entry is on top, dated 2026-11-07, with zero Admin mentions', () => {
    const header = read('components/Header.jsx')
    expect(header).toContain("{ v: '9.27', date: '2026-11-07'")
    expect(header.match(/v: '9\.27'/g).length).toBe(1)
    expect(header.indexOf("v: '9.27'")).toBeLessThan(header.indexOf("v: '9.26'"))
    const entry = changelogEntry(header, '9.27', '9.26')
    expect(entry).not.toMatch(/admin/i)
    expect(entry).toContain('၂၂၅ ဆိုင်')
    expect(entry).toContain('အလိုလို ပြန်ကြိုးစားပေးမယ်')
    expect(entry).toContain('ဘာကြောင့် မရလဲ')
    expect(entry).toContain('ထပ်မထည့်တော့ဘူး')
    expect(entry).toContain('Cancel နှိပ်ပြီးရင် ထပ်မပေါ်တော့ဘူး')
    expect(entry).toContain('အင်္ဂလိပ်/မြန်မာ မှန်အောင်')
    expect(entry).toContain('category အသစ် ၁၃ ခု')
  })
})

describe('v9.25: no inner horizontal scrollers left (tables only)', () => {
  it('overflow-x-auto in src/ appears ONLY in the two genuine tables', () => {
    const holders = filesContaining('overflow-x-auto')
    expect(holders).toEqual([
      'pages/BulkImportPage.jsx',
      'pages/MarketPricePage.jsx',
    ])
  })

  it('no scrollbar-hide usage left outside the index.css definition', () => {
    const holders = filesContaining('scrollbar-hide').filter(f => f !== 'index.css')
    expect(holders).toEqual([])
  })
})

describe('v9.25: Windows path separators', () => {
  it('toPosixPath normalizes backslash paths so comparisons hold on Windows', () => {
    // The 9.25 script's first run failed on Windows because
    // filesContaining() returned backslash relative paths. This test feeds
    // the normalizer Windows-style paths directly, so the fix is covered
    // on any OS — a Linux-only run can never let it regress.
    expect(toPosixPath('pages\\BulkImportPage.jsx')).toBe('pages/BulkImportPage.jsx')
    expect(toPosixPath('pages\\sub\\File.jsx')).toBe('pages/sub/File.jsx')
    expect(toPosixPath('pages/BulkImportPage.jsx')).toBe('pages/BulkImportPage.jsx')
    expect(toPosixPath('index.css')).toBe('index.css')
  })
})

describe('v9.25: Admin tab row wraps', () => {
  it('AdminPage tab row contains flex-wrap and no overflow-x-auto', () => {
    const admin = read('pages/AdminPage.jsx')
    expect(admin).not.toContain('overflow-x-auto')
    expect(admin).toContain('className="flex flex-wrap gap-2 pb-2"')
    expect(admin).toContain('className="grid grid-cols-3 gap-2 pb-2"')
  })
})

describe('v9.25: Fuel filter row wraps (render finding)', () => {
  it('FuelPage filter row contains flex-wrap and both selects have min-w-0', () => {
    const fuel = read('pages/FuelPage.jsx')
    expect(fuel).toContain('<div className="flex flex-wrap gap-2">')
    const selects = fuel.match(/className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white\/5 border border-white\/10 text-sm text-white outline-none"/g)
    expect(selects).not.toBeNull()
    expect(selects.length).toBe(2)
  })
})

describe('v9.25: Directory search bar stays pinned (no B8 collapse)', () => {
  it('no collapse-on-scroll logic left in DirectoryPage.jsx', () => {
    const dir = read('pages/DirectoryPage.jsx')
    expect(dir).not.toContain('headerCollapsed')
    expect(dir).not.toContain('scrollY')
    expect(dir).not.toContain('grid-rows-[0fr]')
    expect(dir).not.toContain("addEventListener('scroll'")
    // The search bar + filters are still there, inside the sticky header.
    expect(dir).toContain('လုပ်ငန်းအမည် ရှာရန်...')
    expect(dir).toContain('className="sticky top-[var(--header-h)] z-40 bg-[#140020] border-b border-white/10 px-4 py-3 space-y-3"')
  })
})

describe('v9.25: overflow-x clip safety net untouched', () => {
  it('index.css still has exactly one overflow-x: clip and no new overflow-x-hidden', () => {
    const css = read('index.css')
    expect(css.match(/overflow-x: clip;/g).length).toBe(1)
    expect(css).not.toContain('overflow-x-hidden')
    expect(css).toContain('.text-nav')
    expect(css).toContain('.Toastify__toast-container { max-width: calc(100vw - 2rem) !important; }')
  })
})
