import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// v9.22 FIX 5 (service-worker update flow): detection was coupled to
// sw.js bytes — CACHE_VERSION went v11 → v12 in 9.18 and never changed
// again, so 9.19–9.21 shipped a byte-identical sw.js and the update
// prompt could never fire. Now the app asks the server for its version
// (/version.json, emitted at build time, SW-bypassed) and the prompt
// means "the server has a newer version"; the 10 s auto-hide is gone.
// Source-scan tests (no live browser on this VM): the prompt flow
// itself is verified by headless-Chrome probes in the diagnosis report,
// not faked here.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

describe('FIX 5: sw.js — new cache version + version.json bypass', () => {
  it('CACHE_VERSION is v13 (one-time purge of the v12 caches)', () => {
    const sw = read('public/sw.js')
    expect(sw).toContain("const CACHE_VERSION = 'v13'")
    expect(sw).not.toContain("CACHE_VERSION = 'v12'")
  })

  it('/version.json bypasses the SW before the static (SWR) branch', () => {
    const sw = read('public/sw.js')
    expect(sw).toContain("if (url.pathname === '/version.json') return")
    const bypass = sw.indexOf("'/version.json'")
    const swr = sw.indexOf('Stale-while-revalidate')
    expect(bypass).toBeGreaterThan(-1)
    expect(swr).toBeGreaterThan(-1)
    expect(bypass).toBeLessThan(swr)
  })

  it('SKIP_WAITING handling is unchanged', () => {
    const sw = read('public/sw.js')
    expect(sw).toContain("if (event.data === 'SKIP_WAITING') self.skipWaiting()")
  })
})

describe('FIX 5: vite.config.js emits dist/version.json from package.json', () => {
  it('has a writeBundle hook writing version.json, version read from package.json (not hardcoded)', () => {
    const cfg = read('vite.config.js')
    expect(cfg).toContain('writeBundle')
    expect(cfg).toContain('version.json')
    expect(cfg).toContain('package.json')
    expect(cfg).not.toContain('"9.22"')
    expect(cfg).not.toContain("'9.22'")
  })
})

describe('FIX 5: useServiceWorker — server-version detection + reloadForUpdate', () => {
  it('checkServerVersion fetches /version.json no-store and prompts even with no waiting worker', () => {
    const hook = read('src/hooks/useServiceWorker.js')
    expect(hook).toContain('checkServerVersion')
    expect(hook).toContain("fetch('/version.json', { cache: 'no-store' })")
    expect(hook).toContain('APP_VERSION')
    expect(hook).toContain('VERSION_WAIT_MS')
    expect(hook).toContain('setUpdateAvailable(true)')
  })

  it('reloadForUpdate waits for controllerchange after SKIP_WAITING, reloads with no waiting worker (once per session)', () => {
    const hook = read('src/hooks/useServiceWorker.js')
    expect(hook).toContain('reloadForUpdate')
    expect(hook).toContain('applyUpdate: reloadForUpdate')
    expect(hook).toContain('controllerchange')
    expect(hook).toContain("postMessage('SKIP_WAITING')")
    expect(hook).toContain('NO_WAITING_RELOAD_KEY')
    expect(hook).toContain('REG_UPDATE_TIMEOUT_MS')
  })

  it('checkWaiting / onupdatefound remain as a second detection path', () => {
    const hook = read('src/hooks/useServiceWorker.js')
    expect(hook).toContain('checkWaiting')
    expect(hook).toContain('onupdatefound')
  })
})

describe('FIX 5: UpdatePrompt no longer auto-hides', () => {
  it('AUTO_HIDE_MS and the auto-hide state/effect are gone; per-version dismiss stays', () => {
    const prompt = read('src/components/UpdatePrompt.jsx')
    expect(prompt).not.toContain('AUTO_HIDE_MS')
    expect(prompt).not.toContain('autoHidden')
    expect(prompt).not.toContain('setAutoHidden')
    expect(prompt).toContain('DISMISSED_KEY')
    expect(prompt).toContain('အပ်ဒိတ်လုပ်နေသည်…')
  })
})

describe('FIX 5 + FIX 4: 9.22 Change Log entry extended, still zero Admin', () => {
  it('the single 9.22 entry now also covers the crash + update fixes', () => {
    const header = read('src/components/Header.jsx')
    expect(header.match(/v: '9\.22'/g).length).toBe(1)
    const start = header.indexOf("{ v: '9.22'")
    const end = header.indexOf("{ v: '9.21'", start)
    const entry = header.slice(start, end)
    expect(entry).not.toContain('Admin')
    expect(entry).toContain('Profile ဖွင့်ရင် ပျက်နေတာ ပြင်ပြီး')
    expect(entry).toContain('Version အသစ် ရရင် အသိပေးချက် ပေါ်မည်')
    // The worker-1 items are still there.
    expect(entry).toContain('Tab နှစ်ခု')
    expect(entry).toContain('"၀ ရလဒ်"')
  })
})
