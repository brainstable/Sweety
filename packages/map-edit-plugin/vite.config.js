import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  define: {
    // Ядро подставляет версию при своей сборке; для demo с исходниками нужен define.
    __SWEETY_VERSION__: JSON.stringify('0.1.0'),
  },
  resolve: {
    // Удобно для demo и локальной разработки; в сборке ядро остаётся external.
    alias: {
      'sweety-map': fileURLToPath(new URL('../../src/index.js', import.meta.url)),
    },
  },
  server: {
    open: '/demo/',
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.js', import.meta.url)),
      name: 'SweetyEdit',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'map-edit-plugin.es.js' : 'map-edit-plugin.umd.cjs'),
      cssFileName: 'map-edit-plugin',
    },
    sourcemap: true,
    minify: 'oxc',
    emptyOutDir: true,
    rollupOptions: {
      external: ['sweety-map'],
      output: {
        exports: 'named',
        globals: {
          'sweety-map': 'Sweety',
        },
      },
    },
  },
  root,
});
