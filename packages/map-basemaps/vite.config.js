import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  define: {
    __SWEETY_VERSION__: JSON.stringify('0.1.0'),
  },
  resolve: {
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
      name: 'SweetyBasemaps',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'map-basemaps.es.js' : 'map-basemaps.umd.cjs'),
      cssFileName: 'map-basemaps',
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
