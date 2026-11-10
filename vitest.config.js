import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // The react plugin gives component tests the same automatic JSX
  // runtime the app build uses — without it, .jsx sources fail with
  // "React is not defined" (v9.22: first component test, SearchPage).
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    // Slow Windows machine: hooks timed out at the 10s default
    // (App925slow + AuthContext926). Timeout only — no assertion weakened.
    hookTimeout: 30000,
  },
})
