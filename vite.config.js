import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
