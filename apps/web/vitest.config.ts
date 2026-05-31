// vitest.config.ts — intentionally separate from vite.config.ts so that
// running tests does NOT require vite-plugin-pwa to be installed.
// The PWA plugin is a build-only concern (service worker + manifest generation).
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
