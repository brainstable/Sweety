/**
 * Собирает статический сайт для GitHub Pages: demo-страницы (Vite) и
 * документация (markdown → HTML теми же функциями, что и dev-превью).
 *
 * Переменные окружения:
 *   SITE_BASE     — префикс публикации, например /Sweety/ (по умолчанию /);
 *   SITE_OUT_DIR  — каталог сборки (по умолчанию dist-site).
 */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { build } from 'vite';
import { normalizeBase, renderMarkdown, renderPage } from './docs-preview.mjs';
import { SITE_FILES, SITE_PAGES, siteHref } from './site-routes.mjs';

const root = resolve(process.cwd());
const outDir = resolve(root, process.env.SITE_OUT_DIR ?? 'dist-site');
const base = normalizeBase(process.env.SITE_BASE ?? '/');
const mapHref = (path) => siteHref(path, base);
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

async function writePage(route, html) {
  const file = join(outDir, route.replace(/^\/+/, ''), 'index.html');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html, 'utf8');
}

// 1. Demo-страницы: Vite собирает HTML, модули и стили в dist-site/.
await build({ configFile: join(root, 'vite.site.config.js'), logLevel: 'warn' });

// 2. Документация: markdown рендерится тем же кодом, что и в dev-превью.
const rendered = new Map();

for (const page of SITE_PAGES) {
  const markdown = await readFile(join(root, page.file), 'utf8');
  const body = renderMarkdown(markdown, { basePath: page.basePath, mapHref });
  const html = renderPage(page, body, version, { base, mapHref });

  rendered.set(page.route, html);
  await writePage(page.route, html);
}

// 3. Корень сайта отдаёт обзор, чтобы /Sweety/ открывался без редиректа.
const overview = rendered.get('/docs/');
if (!overview) throw new Error('build-site: не найдена страница обзора /docs/');
await writeFile(join(outDir, 'index.html'), overview, 'utf8');

// 4. 404.html — страница для GitHub Pages вместо пустого ответа.
const notFound = renderPage(
  { id: 'notfound', title: 'Страница не найдена' },
  [
    '<h1>Страница не найдена</h1>',
    `<p>Возможно, страница переехала. Начните с <a href="${mapHref('/docs/')}">документации</a>`,
    `или откройте <a href="${mapHref('/examples/')}">демо</a>.</p>`,
  ].join(''),
  version,
  { base, mapHref },
);
await writeFile(join(outDir, '404.html'), notFound, 'utf8');

// 5. Файлы, которые сайт отдаёт как есть: картинки документации, иконки.
for (const entry of SITE_FILES) {
  await cp(join(root, entry), join(outDir, entry), { recursive: true });
}

// 6. GitHub Pages не должен прогонять артефакт через Jekyll.
await writeFile(join(outDir, '.nojekyll'), '', 'utf8');

console.log(`[sweety-site] ${base} → ${relative(root, outDir)}`);
for (const page of SITE_PAGES) {
  console.log(`  ${page.route.padEnd(32)} ← ${page.file}`);
}
