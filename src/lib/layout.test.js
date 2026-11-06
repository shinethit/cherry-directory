import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Layout guards (v9.20): top/bottom bars must never cover the body.
// User report 2026-11-05 — drawer first item half-clipped under the
// purple category header; FABs sat on top of the bottom nav. These are
// static source assertions in the wording.test.js pattern: they pin the
// coupling (one --nav-h source of truth, drawer above all page chrome)
// so a later edit cannot silently reintroduce a hard-coded offset.

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(srcDir, rel), 'utf8')

describe('layout v9.20: drawer is a full-screen sheet above all chrome', () => {
  it('drawer z-index is z-[60] (above app header z-50, FABs z-50, AdminPage sticky z-50)', () => {
    const header = read('components/Header.jsx')
    expect(header).toContain('fixed inset-0 z-[60]')
    expect(header).not.toContain("fixed inset-0 z-40 bg-black/80")
  })

  it('drawer top padding is safe-area only (no 4rem offset — the sheet covers the app header too)', () => {
    const header = read('components/Header.jsx')
    expect(header).toContain("paddingTop: 'env(safe-area-inset-top)'")
    expect(header).not.toContain("paddingTop: 'calc(4rem + env(safe-area-inset-top))'")
  })

  it('drawer has its own close button (the header X sits underneath the sheet)', () => {
    const header = read('components/Header.jsx')
    expect(header).toContain('aria-label="မီနူး ပိတ်မည်"')
  })

  it('drawer bottom padding clears the viewport bottom + home indicator', () => {
    const header = read('components/Header.jsx')
    expect(header).toContain("paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))'")
  })

  it('body scroll locks while the drawer is open', () => {
    const header = read('components/Header.jsx')
    expect(header).toContain('document.body.style.overflow')
  })
})

describe('layout v9.20: FABs and nav share one --nav-h source of truth', () => {
  it('--nav-h is defined in index.css', () => {
    expect(read('index.css')).toContain('--nav-h: 5rem')
  })

  it('nav has a fixed height derived from --nav-h', () => {
    const nav = read('components/BottomNav.jsx')
    expect(nav).toContain("height: 'calc(var(--nav-h) + env(safe-area-inset-bottom))'")
  })

  it('both FAB bottoms derive from --nav-h (no hard-coded 5rem bottom)', () => {
    const nav = read('components/BottomNav.jsx')
    const matches = nav.match(/bottom: 'calc\(var\(--nav-h\) \+ env\(safe-area-inset-bottom\) \+ 12px\)'/g) || []
    expect(matches.length).toBe(2)
    expect(nav).not.toContain("bottom: 'calc(5rem + env(safe-area-inset-bottom))'")
  })

  it('nav labels cannot wrap (wrapping grew the nav and ate the FAB clearance)', () => {
    const nav = read('components/BottomNav.jsx')
    const matches = nav.match(/whitespace-nowrap/g) || []
    expect(matches.length).toBeGreaterThanOrEqual(2)
    expect(nav).toContain('shrink-0')
  })
})

describe('layout v9.20: chat composer + banners derive from --nav-h', () => {
  it('chat container reserves the real nav height, not 5rem', () => {
    const chat = read('pages/ChatPage.jsx')
    expect(chat).toContain('h-[calc(100dvh-var(--header-h)-var(--nav-h)-env(safe-area-inset-bottom))]')
    expect(chat).not.toContain('h-[calc(100dvh-var(--header-h)-5rem)]')
  })

  it('chat composer sticks above the real nav top', () => {
    const chat = read('pages/ChatPage.jsx')
    expect(chat).toContain("bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom))'")
    expect(chat).not.toContain('sticky bottom-[5rem]')
  })

  it('update prompt, PWA banner and market-price toast clear the FABs with safe-area', () => {
    for (const rel of ['components/UpdatePrompt.jsx', 'components/PWAInstallBanner.jsx', 'pages/MarketPricePage.jsx']) {
      const src = read(rel)
      expect(src).toContain('calc(var(--nav-h) + env(safe-area-inset-bottom) + 5rem)')
    }
    expect(read('components/UpdatePrompt.jsx')).not.toContain('bottom-[132px]')
    expect(read('components/PWAInstallBanner.jsx')).not.toContain('bottom-[164px]')
    expect(read('pages/MarketPricePage.jsx')).not.toContain('fixed bottom-28')
  })
})

describe('layout v9.20: chat optimistic send (D1)', () => {
  it('sendMessage appends locally after a successful insert, never before', () => {
    const chat = read('pages/ChatPage.jsx')
    expect(chat).toContain("import { buildOptimisticMessage, appendMessageDedup } from '../lib/chatMessages'")
    // The append sits after the `if (error) throw error` guard, inside
    // the same try block — a failed insert cannot show a phantom message.
    const sendIdx = chat.indexOf('const sendMessage = async ()')
    const appendIdx = chat.indexOf('buildOptimisticMessage({', sendIdx)
    const throwIdx = chat.indexOf("if (error) throw error", sendIdx)
    expect(appendIdx).toBeGreaterThan(throwIdx)
    expect(chat).toContain('setMessages(prev => appendMessageDedup(prev, buildOptimisticMessage({')
  })

  it('realtime INSERT handler dedupes by id so the echo cannot duplicate the optimistic row', () => {
    const chat = read('pages/ChatPage.jsx')
    expect(chat).toContain('setMessages(prev => appendMessageDedup(prev, newMsg))')
    expect(chat).not.toContain('setMessages(prev => [...prev, newMsg])')
  })
})
