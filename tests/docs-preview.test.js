import { describe, expect, it } from 'vitest';
import { createDocsMiddleware, renderMarkdown } from '../scripts/docs-preview.mjs';

function runMiddleware(url) {
  const middleware = createDocsMiddleware({ root: process.cwd(), version: '0.1.0' });
  return new Promise((resolve, reject) => {
    const headers = {};
    const response = {
      statusCode: 0,
      setHeader(name, value) {
        headers[name.toLowerCase()] = value;
      },
      end(body) {
        resolve({ status: this.statusCode, headers, body });
      },
    };
    middleware({ method: 'GET', url }, response, (error) =>
      error ? reject(error) : resolve({ status: 404, headers, body: '', next: true }),
    );
  });
}

describe('docs preview', () => {
  it('renders русский текст, заголовки и inline-разметку', () => {
    const html = renderMarkdown('# Привет\n\nТекст **жирный** и `код`.', {
      basePath: '/README.md',
    });

    expect(html).toContain('<h1 id="привет">Привет');
    expect(html).toContain('<strong>жирный</strong>');
    expect(html).toContain('<code>код</code>');
  });

  it('рендерит таблицу и сохраняет экранированные вертикальные черты', () => {
    const html = renderMarkdown(
      '| Тип | Описание |\n| --- | --- |\n| `LatLng \\| number[]` | Координаты |',
      { basePath: '/docs/API.md' },
    );

    expect(html).toContain('<table>');
    expect(html).toContain('<code>LatLng | number[]</code>');
    expect(html).toContain('<td>Координаты</td>');
  });

  it('строит вложенные списки', () => {
    const html = renderMarkdown('1. Первый\n   - Вложенный\n2. Второй', {
      basePath: '/docs/ARCHITECTURE.md',
    });

    expect(html).toContain('<ol><li>Первый<ul><li>Вложенный</li></ul></li><li>Второй</li></ol>');
  });

  it('разрешает относительные ссылки от корня репозитория', () => {
    const html = renderMarkdown('[API](docs/API.md) ![Карта](docs/demo.webp)', {
      basePath: '/README.md',
    });

    expect(html).toContain('href="/docs/API.md"');
    expect(html).toContain('src="/docs/demo.webp"');
  });

  it('не пропускает javascript-ссылки', () => {
    const html = renderMarkdown('[Опасная](javascript:alert(1))', {
      basePath: '/README.md',
    });

    expect(html).toContain('href="#"');
    expect(html).not.toContain('javascript:');
  });

  it('отдаёт README пакета как HTML с UTF-8, а не сырой markdown', async () => {
    const result = await runMiddleware('/packages/map-edit-plugin/README.md');
    expect(result.status).toBe(200);
    expect(result.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(result.body).toContain('Sweety map-edit-plugin');
    expect(result.body).toContain('Редактирование');
    expect(result.body).not.toContain('РџСЂ');
  });

  it('сохраняет специальные страницы документации', async () => {
    const result = await runMiddleware('/docs/API.md');
    expect(result.status).toBe(200);
    expect(result.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(result.body).toContain('<article class="markdown">');
  });

  it('перечисляет все демо в сайдбаре документации', async () => {
    const result = await runMiddleware('/docs/');
    expect(result.status).toBe(200);

    const nav = result.body.match(/<nav class="nav nav-demos"[\s\S]*?<\/nav>/);
    expect(nav).not.toBeNull();
    expect(nav[0]).toContain('aria-label="Демо"');

    const demos = [
      ['/examples/', 'Обзор карты'],
      ['/packages/map-edit-plugin/demo/', 'Редактор геометрии'],
      ['/packages/map-basemaps/demo/', 'Каталог подложек'],
    ];
    for (const [href, title] of demos) {
      expect(nav[0]).toContain(`href="${href}"`);
      expect(nav[0]).toContain(title);
    }
    expect(nav[0].match(/target="_blank" rel="noreferrer"/g)).toHaveLength(demos.length);
  });

  it('не перехватывает несуществующий markdown', async () => {
    const result = await runMiddleware('/packages/map-edit-plugin/missing.md');
    expect(result.next).toBe(true);
  });

  it('пропускает HTML-блоки README и чистит опасные теги', () => {
    const html = renderMarkdown(
      [
        '<p align="center">',
        '  <img src="assets/brand/sweety-logo.svg" alt="Sweety" width="300">',
        '</p>',
        '',
        '<p align="center" onclick="alert(1)"><a href="javascript:alert(2)">x</a></p>',
        '',
        '<p align="center"><script>alert(3)</script>ok</p>',
      ].join('\n'),
      { basePath: '/README.md' },
    );

    expect(html).toContain('<p align="center">');
    expect(html).toContain('src="/assets/brand/sweety-logo.svg"');
    expect(html).not.toContain('onclick=');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<script>');
  });
});
