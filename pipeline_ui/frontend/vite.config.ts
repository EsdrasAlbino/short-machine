/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/media': 'http://localhost:8000',
    },
    // FFmpeg.wasm's multi-threaded core requires SharedArrayBuffer, which
    // browsers only expose in a cross-origin-isolated context (found via
    // manual e2e verification, T16: window.crossOriginIsolated was false
    // and FFmpeg.wasm silently fell back to static-frame mode).
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
})
