import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../scripts/docs-preview.mjs';

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
});
