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

describe('demo pages: diagnostics instead of a blank page', () => {
  for (const demo of DEMOS) {
    it(`${demo.path} показывает причину, если модуль не запустился`, () => {
      const html = readFileSync(demo.path, 'utf8');

      // Подсказка при открытии с диска.
      expect(html).toContain('data-demo-guard');
      expect(html).toContain(`data-demo-url="${demo.url}"`);
      expect(html).toContain('Демо открыто с диска');
      expect(html).toContain("location.protocol === 'file:'");

      // Модуль отмечает успешный старт; сторожевой таймер ловит ошибку загрузки.
      expect(html).toContain('window.__sweetyDemoReady');
      expect(html).toContain('window.__sweetyDemoReady();');
      expect(html).toContain("id = 'demo-failure'");
      expect(html).toContain('Модуль демо не загрузился');
      expect(html).toContain('npm run dev');
    });

    it(`${demo.path} открывает демо по корневому dev-серверу`, () => {
      const html = readFileSync(demo.path, 'utf8');
      // Корневой `npm run dev` обслуживает demo-страницы пакетов; адрес в
      // подсказке должен совпадать с тем, что документирует README.
      expect(demo.url.startsWith('http://localhost:5173/packages/')).toBe(true);
      expect(html).toContain(demo.url);
    });
  }
});
