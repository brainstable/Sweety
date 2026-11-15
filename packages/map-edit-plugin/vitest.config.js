import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  define: {
    __SWEETY_VERSION__: JSON.stringify('0.1.0'),
  },
  resolve: {
    alias: {
      'sweety-map': fileURLToPath(new URL('../../src/index.js', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.js'],
    restoreMocks: true,
  },
});
