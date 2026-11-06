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
function versionJsonPlugin() {
  return {
    name: 'version-json',
    writeBundle({ dir }) {
      writeFileSync(join(dir, 'version.json'), JSON.stringify({ version: pkg.version }))
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
