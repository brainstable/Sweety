import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  define: {
    __SWEETY_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    lib: {
      entry: 'src/index.js',
      name: 'Sweety',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'sweety.es.js' : 'sweety.umd.cjs'),
      cssFileName: 'sweety',
    },
    sourcemap: true,
    minify: 'oxc',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.js'],
      exclude: ['src/index.js', 'src/styles/**'],
      thresholds: {
        lines: 60,
        functions: 60,
        statements: 60,
        branches: 50,
      },
    },
  },
});
