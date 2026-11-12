import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// The app version lives in package.json only (see src/lib/appVersion.js).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// v9.22: emit dist/version.json at build time so the running app can ask
// the server which version is live (useServiceWorker.checkServerVersion).
// The SW lets /version.json through uncached, so the check can never be
// answered from the old cache. Do NOT put a hardcoded version.json in
// public/ — it would rot.
// v9.39: version.json also carries the current version's full change
// log (changesMy/changesEn) so the UpdatePrompt and the post-update
// "What's New" modal can show the new version's changes ALL AT ONCE
// instead of one generic line (cross-app rule, NgweSarYin v7.5.76
// pattern). The log lives in version-changes.json at the repo root
// (git-tracked; each version updates its own entry) — the plugin reads
// it with readFileSync and fails soft (version only) when the file or
// the entry is missing, so a missing entry can never break the build.
function versionJsonPlugin() {
  return {
    name: 'version-json',
    writeBundle({ dir }) {
      let changes = {}
      try {
        const all = JSON.parse(readFileSync(new URL('./version-changes.json', import.meta.url), 'utf8'))
        const entry = all?.[pkg.version]
        if (entry?.changesMy?.length) changes.changesMy = entry.changesMy
        if (entry?.changesEn?.length) changes.changesEn = entry.changesEn
      } catch {
        // Missing/unparseable version-changes.json: emit version only.
      }
      writeFileSync(join(dir, 'version.json'), JSON.stringify({ version: pkg.version, ...changes }))
    },
  }
}

export default defineConfig({
  plugins: [react(), versionJsonPlugin()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react:    ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          query:    [
            '@tanstack/react-query',
            '@tanstack/react-query-persist-client',
            '@tanstack/query-sync-storage-persister',
          ],
          leaflet:  ['leaflet', 'react-leaflet'],
          sentry:   ['@sentry/react'],
          lightbox: ['yet-another-react-lightbox'],
          ui:       ['lucide-react', 'react-toastify', 'qrcode.react'],
        },
      },
    },
  },
})
