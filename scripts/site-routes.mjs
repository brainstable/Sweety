/**
 * Маршруты статического сайта на GitHub Pages.
 *
 * Один источник правды о том, какие markdown-файлы становятся страницами,
 * какие файлы копируются как есть и как ссылка из документации превращается в
 * URL. Используется сборкой сайта (scripts/build-site.mjs) и тестами.
 */

const REPOSITORY = 'https://github.com/brainstable/Sweety';
const BRANCH = 'main';

// Страницы документации: `file` — файл в репозитории, `route` — URL на сайте.
export const SITE_PAGES = [
  { id: 'overview', title: 'Обзор', file: 'README.md', basePath: '/README.md', route: '/docs/' },
  {
    id: 'api',
    title: 'API Reference',
    file: 'docs/API.md',
    basePath: '/docs/API.md',
    route: '/docs/api/',
  },
  {
    id: 'architecture',
    title: 'Архитектура',
    file: 'docs/ARCHITECTURE.md',
    basePath: '/docs/ARCHITECTURE.md',
    route: '/docs/architecture/',
  },
  {
    id: 'git',
    title: 'Git-процесс',
    file: 'docs/GIT-WORKFLOW.md',
    basePath: '/docs/GIT-WORKFLOW.md',
    route: '/docs/git/',
  },
  {
    id: 'changelog',
    title: 'CHANGELOG',
    file: 'CHANGELOG.md',
    basePath: '/CHANGELOG.md',
    route: '/changelog/',
  },
  {
    id: 'package',
    title: 'map-edit-plugin',
    file: 'packages/map-edit-plugin/README.md',
    basePath: '/packages/map-edit-plugin/README.md',
    route: '/packages/map-edit-plugin/',
  },
  {
    id: 'package',
    title: 'map-basemaps',
    file: 'packages/map-basemaps/README.md',
    basePath: '/packages/map-basemaps/README.md',
    route: '/packages/map-basemaps/',
  },
];

// Файлы сайта, которые отдаются как есть: картинки документации и иконки.
// Список явный, чтобы в артефакт не попадал генератор assets/brand/build.py.
export const SITE_FILES = [
  'docs/demo.webp',
  'assets/brand/favicon.svg',
  'assets/brand/favicon.ico',
  'assets/brand/sweety-mark.svg',
  'assets/brand/sweety-logo.svg',
];

// Страницы, которые собирает Vite из demo-HTML (см. vite.site.config.js).
const DEMO_ROUTES = new Set([
  '/examples/',
  '/packages/map-edit-plugin/demo/',
  '/packages/map-basemaps/demo/',
]);

// Markdown-файлы репозитория → страницы сайта.
const ROUTE_BY_SOURCE = new Map([
  ['/readme.md', '/docs/'],
  ['/docs/', '/docs/'],
  ['/docs/api.md', '/docs/api/'],
  ['/docs/architecture.md', '/docs/architecture/'],
  ['/docs/git-workflow.md', '/docs/git/'],
  ['/changelog.md', '/changelog/'],
  ['/packages/map-edit-plugin/readme.md', '/packages/map-edit-plugin/'],
  ['/packages/map-basemaps/readme.md', '/packages/map-basemaps/'],
]);

function splitSuffix(target) {
  const index = target.search(/[?#]/);
  return index === -1
    ? { pathname: target, suffix: '' }
    : { pathname: target.slice(0, index), suffix: target.slice(index) };
}

function isCopiedFile(pathname) {
  return (
    pathname === '/docs/demo.webp' ||
    pathname.startsWith('/assets/brand/') ||
    pathname === '/assets/brand'
  );
}

/**
 * Куда ведёт путь внутри репозитория. Неизвестные файлы (LICENSE, исходники)
 * уходят на GitHub, иначе на сайте они стали бы битыми ссылками.
 */
export function sitePath(target) {
  const { pathname, suffix } = splitSuffix(target);
  const route = ROUTE_BY_SOURCE.get(pathname.toLowerCase());

  if (route) return { url: route, suffix, external: false };
  if (DEMO_ROUTES.has(pathname)) return { url: pathname, suffix, external: false };
  if (isCopiedFile(pathname)) return { url: pathname, suffix, external: false };

  const relative = pathname.replace(/^\/+/, '');
  return { url: `${REPOSITORY}/blob/${BRANCH}/${relative}`, suffix, external: true };
}

/**
 * Абсолютная ссылка для страницы сайта: `base` — префикс публикации
 * (`/` локально, `/Sweety/` на GitHub Pages).
 */
export function siteHref(target, base = '/') {
  const { url, suffix, external } = sitePath(target);
  if (external) return `${url}${suffix}`;

  const prefix = base.endsWith('/') ? base : `${base}/`;
  if (prefix === '/') return `/${url.replace(/^\/+/, '')}${suffix}`;
  return `${prefix}${url.replace(/^\/+/, '')}${suffix}`;
}
