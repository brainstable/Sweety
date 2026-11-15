import { describe, expect, it } from 'vitest';
import { SITE_PAGES, siteHref, sitePath } from '../scripts/site-routes.mjs';

describe('site routes', () => {
  it('превращает markdown-файлы в страницы сайта', () => {
    expect(sitePath('/docs/API.md').url).toBe('/docs/api/');
    expect(sitePath('/README.md').url).toBe('/docs/');
    expect(sitePath('/CHANGELOG.md').url).toBe('/changelog/');
    expect(sitePath('/packages/map-edit-plugin/README.md').url).toBe('/packages/map-edit-plugin/');
    expect(sitePath('/packages/map-basemaps/README.md').url).toBe('/packages/map-basemaps/');
  });

  it('пропускает demo-страницы и скопированные файлы', () => {
    for (const route of [
      '/examples/',
      '/packages/map-edit-plugin/demo/',
      '/packages/map-basemaps/demo/',
      '/docs/demo.webp',
      '/assets/logo/sweety-logo.svg',
      '/assets/logo/favicon.ico',
    ]) {
      expect(sitePath(route)).toEqual({ url: route, suffix: '', external: false });
    }
  });

  it('неизвестные файлы ведёт на GitHub, чтобы не было битых ссылок', () => {
    const license = sitePath('/LICENSE');

    expect(license.external).toBe(true);
    expect(license.url).toBe('https://github.com/brainstable/Sweety/blob/main/LICENSE');
  });

  it('добавляет базовый путь публикации и сохраняет якорь', () => {
    expect(siteHref('/docs/API.md', '/Sweety/')).toBe('/Sweety/docs/api/');
    expect(siteHref('/README.md', '/')).toBe('/docs/');
    expect(siteHref('/docs/API.md#map', '/Sweety/')).toBe('/Sweety/docs/api/#map');
    expect(siteHref('/LICENSE', '/Sweety/')).toBe(
      'https://github.com/brainstable/Sweety/blob/main/LICENSE',
    );
  });

  it('держит маршруты страниц уникальными и с завершающим слэшем', () => {
    const routes = SITE_PAGES.map((page) => page.route);

    expect(new Set(routes).size).toBe(routes.length);
    for (const route of routes) expect(route.endsWith('/')).toBe(true);
  });
});
