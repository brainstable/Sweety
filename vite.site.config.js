import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { normalizeBase } from './scripts/docs-preview.mjs';
import { packagesAlias } from './scripts/packages-alias.mjs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Статический сайт для GitHub Pages: документация (её дописывает
// scripts/build-site.mjs) и demo-страницы. Страница проекта живёт по адресу
// https://brainstable.github.io/Sweety/, поэтому базовый путь приходит из
// actions/configure-pages через SITE_BASE. Локально это корень сайта.
export default defineConfig({
  base: normalizeBase(process.env.SITE_BASE ?? '/'),
  resolve: {
    alias: packagesAlias,
  },
  define: {
    __SWEETY_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: process.env.SITE_OUT_DIR ?? 'dist-site',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        examples: 'examples/index.html',
        'map-edit-plugin': 'packages/map-edit-plugin/demo/index.html',
        basemaps: 'packages/map-basemaps/demo/index.html',
      },
    },
  },
});
