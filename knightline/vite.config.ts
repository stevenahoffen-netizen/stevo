import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// KL_INLINE=1 builds everything (fonts included) into data URIs so
// scripts/build-artifact.ts can pack a single self-contained HTML file.
const inline = process.env.KL_INLINE === '1'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: inline ? 1024 * 1024 : 4096,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
})
