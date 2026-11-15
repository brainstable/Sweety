import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { docsPreview } from './scripts/docs-preview.mjs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Пакеты в packages/ импортируют ядро как `sweety-map`. Корневой dev-сервер
// обслуживает их demo-страницы (http://localhost:5173/packages/<pkg>/demo/),
// поэтому имя должно разрешаться в исходники ядра, а не в собранный dist.
// Точные регулярки: подпути вроде `sweety-map/style.css` не переписываются.
const packagesAlias = [
  {
    find: /^sweety-map$/,
    replacement: fileURLToPath(new URL('./src/index.js', import.meta.url)),
  },
  {
    find: /^sweety-map-edit-plugin$/,
    replacement: fileURLToPath(new URL('./packages/map-edit-plugin/src/index.js', import.meta.url)),
  },
  {
    find: /^sweety-map-basemaps$/,
    replacement: fileURLToPath(new URL('./packages/map-basemaps/src/index.js', import.meta.url)),
  },
];

export default defineConfig({
  plugins: [docsPreview({ version: pkg.version })],
  resolve: {
    alias: packagesAlias,
  },
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
