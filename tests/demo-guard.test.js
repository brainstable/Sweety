import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DEMOS = [
  {
    path: 'packages/map-edit-plugin/demo/index.html',
    url: 'http://localhost:5173/packages/map-edit-plugin/demo/',
  },
  {
    path: 'packages/map-basemaps/demo/index.html',
    url: 'http://localhost:5173/packages/map-basemaps/demo/',
  },
];

describe('demo pages: file:// fallback', () => {
  for (const demo of DEMOS) {
    it(`${demo.path} объясняет запуск через Vite вместо пустой карты`, () => {
      const html = readFileSync(demo.path, 'utf8');
      expect(html).toContain('data-demo-guard');
      expect(html).toContain(`data-demo-url="${demo.url}"`);
      expect(html).toContain('Демо запускается через Vite');
      expect(html).toContain("location.protocol !== 'file:'");
    });
  }
});
