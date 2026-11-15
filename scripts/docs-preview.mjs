import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const FENCE_RE = /^\s*```(.*)$/;
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE_RE = /^\s{0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/;
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const DOC_NAV = [
  { id: 'overview', title: 'Обзор', href: '/docs/' },
  { id: 'api', title: 'API Reference', href: '/docs/API.md' },
  { id: 'architecture', title: 'Архитектура', href: '/docs/ARCHITECTURE.md' },
  { id: 'git', title: 'Git-процесс', href: '/docs/GIT-WORKFLOW.md' },
  { id: 'brand', title: 'Бренд', href: '/docs/BRAND.md' },
  { id: 'changelog', title: 'CHANGELOG', href: '/CHANGELOG.md' },
];

// Все интерактивные демо репозитория. Список показывается в сайдбаре на каждой
// странице документации, чтобы демо не приходилось искать по README.
const DEMO_NAV = [
  {
    title: 'Обзор карты',
    note: 'маркеры, полигоны, GeoJSON',
    href: '/examples/',
  },
  {
    title: 'Редактор геометрии',
    note: 'рисование и правка вершин',
    href: '/packages/map-edit-plugin/demo/',
  },
  {
    title: 'Каталог подложек',
    note: 'переключение и превью',
    href: '/packages/map-basemaps/demo/',
  },
];

const DOC_PAGES = new Map([
  ['/docs/', { id: 'overview', title: 'Обзор', file: 'README.md', basePath: '/README.md' }],
  ['/readme.md', { id: 'overview', title: 'Обзор', file: 'README.md', basePath: '/README.md' }],
  [
    '/changelog.md',
    { id: 'changelog', title: 'CHANGELOG', file: 'CHANGELOG.md', basePath: '/CHANGELOG.md' },
  ],
  [
    '/docs/api.md',
    { id: 'api', title: 'API Reference', file: 'docs/API.md', basePath: '/docs/API.md' },
  ],
  [
    '/docs/architecture.md',
    {
      id: 'architecture',
      title: 'Архитектура',
      file: 'docs/ARCHITECTURE.md',
      basePath: '/docs/ARCHITECTURE.md',
    },
  ],
  [
    '/docs/git-workflow.md',
    {
      id: 'git',
      title: 'Git-процесс',
      file: 'docs/GIT-WORKFLOW.md',
      basePath: '/docs/GIT-WORKFLOW.md',
    },
  ],
  [
    '/docs/brand.md',
    {
      id: 'brand',
      title: 'Бренд',
      file: 'docs/BRAND.md',
      basePath: '/docs/BRAND.md',
    },
  ],
]);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

// README-блоки вроде <p align="center"><img …></p> приходят из GitHub-разметки.
// Пропускаем только безопасный набор тегов, вычищая скрипты и обработчики.
const HTML_BLOCK_RE = /^<(?:p|div|center|h[1-6]|figure|picture)\b[^>]*>/i;
const HTML_UNSAFE_TAGS_RE =
  /<(script|style|iframe|object|embed|form|link|meta)\b[\s\S]*?<\/\1\s*>/gi;
const HTML_EVENT_ATTRIBUTE_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const HTML_JS_URL_RE = /\s(href|src)\s*=\s*(?:"|')?\s*javascript:[^"'>\s]*/gi;
const HTML_URL_RE = /\s(src|href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

function renderHtmlBlock(block, basePath) {
  const cleaned = block
    .replace(HTML_UNSAFE_TAGS_RE, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(HTML_EVENT_ATTRIBUTE_RE, '')
    .replace(HTML_JS_URL_RE, '');

  return cleaned.replace(HTML_URL_RE, (match, attribute, doubleQuoted, singleQuoted) => {
    const value = doubleQuoted ?? singleQuoted ?? '';
    const quote = doubleQuoted === undefined ? "'" : '"';
    return ` ${attribute}=${quote}${resolveHref(value, basePath)}${quote}`;
  });
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  return slug || 'section';
}

function uniqueSlug(value, state) {
  const base = slugify(value);
  const count = state.headingIds.get(base) ?? 0;
  state.headingIds.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function resolveHref(href, basePath) {
  if (!href || href.startsWith('#')) return href;
  if (/^\s*(?:javascript|data|vbscript):/i.test(href)) return '#';
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return href;

  try {
    const base = new URL(basePath, 'http://sweety.local');
    const target = new URL(href, base);
    if (target.origin !== base.origin) return href;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return href;
  }
}

function stripInline(value) {
  return value
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]/g, '')
    .trim();
}

function renderInline(value, basePath, _state) {
  const codeSpans = [];
  let output = value.replace(/`([^`]+)`/g, (_, code) => {
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return `\uE000code${codeSpans.length - 1}\uE000`;
  });

  output = escapeHtml(output);

  output = output.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => {
    const url = resolveHref(src, basePath);
    return `<img src="${url}" alt="${alt}" loading="lazy" decoding="async">`;
  });

  output = output.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const url = resolveHref(href, basePath);
    const external = /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//');
    const attributes = external ? ' target="_blank" rel="noreferrer"' : '';
    return `<a href="${url}"${attributes}>${label}</a>`;
  });

  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  output = output.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  output = output.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  output = output.replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, '$1<em>$2</em>');

  return output.replace(/\uE000code(\d+)\uE000/g, (_, index) => codeSpans[Number(index)]);
}

function splitTableRow(line) {
  let source = line.trim();
  if (source.startsWith('|')) source = source.slice(1);
  if (source.endsWith('|')) source = source.slice(0, -1);

  const cells = [];
  let current = '';
  let inCode = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (character === '\\' && source[index + 1] === '|') {
      current += '|';
      index += 1;
      continue;
    }

    if (character === '`') inCode = !inCode;

    if (character === '|' && !inCode) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
}

function alignmentAttribute(alignment) {
  return alignment === 'left' ? '' : ` style="text-align:${alignment}"`;
}

function isTableSeparator(line) {
  return Boolean(line) && TABLE_SEPARATOR_RE.test(line);
}

function isBlockStart(line, lines, index) {
  if (FENCE_RE.test(line) || HEADING_RE.test(line) || RULE_RE.test(line)) return true;
  if (/^\s{0,3}>/.test(line) || LIST_RE.test(line)) return true;

  const next = lines[index + 1];
  return line.includes('|') && isTableSeparator(next);
}

function parseList(lines, start, basePath, state) {
  const first = lines[start].match(LIST_RE);
  const baseIndent = first[1].length;
  const ordered = /^\d/.test(first[2]);
  const startNumber = ordered ? Number.parseInt(first[2], 10) : 1;
  const items = [];
  let index = start;

  while (index < lines.length) {
    const match = lines[index].match(LIST_RE);
    if (!match || match[1].length !== baseIndent || /^\d/.test(match[2]) !== ordered) {
      break;
    }

    const contentOffset = match[1].length + match[2].length + 1;
    const content = [match[3]];
    index += 1;

    while (index < lines.length) {
      const line = lines[index];

      if (/^\s*$/.test(line)) {
        let nextIndex = index + 1;
        while (nextIndex < lines.length && /^\s*$/.test(lines[nextIndex])) nextIndex += 1;

        if (nextIndex >= lines.length) {
          index = nextIndex;
          break;
        }

        const nextIndent = lines[nextIndex].match(/^\s*/)[0].length;
        const nextMatch = lines[nextIndex].match(LIST_RE);

        if (nextIndent <= baseIndent || (nextMatch && nextMatch[1].length <= baseIndent)) {
          index = nextIndex;
          break;
        }

        content.push('');
        index = nextIndex;
        continue;
      }

      const nextMatch = line.match(LIST_RE);
      if (nextMatch && nextMatch[1].length <= baseIndent) break;

      const indent = line.match(/^\s*/)[0].length;
      if (!nextMatch && indent <= baseIndent && isBlockStart(line, lines, index)) break;

      content.push(line.slice(Math.min(indent, contentOffset)));
      index += 1;
    }

    while (content.length > 1 && content[content.length - 1] === '') content.pop();
    items.push(content);
  }

  const tag = ordered ? 'ol' : 'ul';
  const startAttribute = ordered && startNumber !== 1 ? ` start="${startNumber}"` : '';
  const itemsHtml = items
    .map((itemLines) => {
      let inner = renderBlocks(itemLines, basePath, state);
      const firstParagraph = inner.match(/^<p>([\s\S]*?)<\/p>/);

      if (firstParagraph) {
        inner = firstParagraph[1] + inner.slice(firstParagraph[0].length);
      }

      return `<li>${inner}</li>`;
    })
    .join('');

  return {
    html: `<${tag}${startAttribute}>${itemsHtml}</${tag}>`,
    next: index,
  };
}

function renderBlocks(lines, basePath, state) {
  let html = '';
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (/^\s*$/.test(line)) {
      index += 1;
      continue;
    }

    const fence = line.match(FENCE_RE);
    if (fence) {
      const language = fence[1].trim().split(/\s+/)[0];
      const code = [];
      index += 1;

      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }

      index += 1;
      const languageAttribute = language ? ` data-lang="${escapeAttribute(language)}"` : '';
      html += `<pre${languageAttribute}><code>${escapeHtml(code.join('\n'))}</code></pre>`;
      continue;
    }

    if (HTML_BLOCK_RE.test(line)) {
      const block = [];

      while (index < lines.length && !/^\s*$/.test(lines[index])) {
        block.push(lines[index]);
        index += 1;
      }

      html += renderHtmlBlock(block.join('\n'), basePath);
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].replace(/\s+#+\s*$/, '');
      const id = uniqueSlug(stripInline(text), state);
      html += `<h${level} id="${id}">${renderInline(text, basePath, state)}<a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a></h${level}>`;
      index += 1;
      continue;
    }

    if (RULE_RE.test(line)) {
      html += '<hr>';
      index += 1;
      continue;
    }

    if (line.includes('|') && isTableSeparator(lines[index + 1])) {
      const header = splitTableRow(line);
      const alignments = splitTableRow(lines[index + 1]).map((cell) => {
        const left = cell.startsWith(':');
        const right = cell.endsWith(':');
        if (left && right) return 'center';
        return right ? 'right' : 'left';
      });

      index += 2;
      const rows = [];

      while (index < lines.length && lines[index].includes('|') && !/^\s*$/.test(lines[index])) {
        if (isBlockStart(lines[index], lines, index)) break;
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }

      const head = header
        .map(
          (cell, cellIndex) =>
            `<th${alignmentAttribute(alignments[cellIndex])}>${renderInline(cell, basePath, state)}</th>`,
        )
        .join('');
      const body = rows
        .map(
          (row) =>
            `<tr>${header
              .map(
                (_, cellIndex) =>
                  `<td${alignmentAttribute(alignments[cellIndex])}>${renderInline(
                    row[cellIndex] ?? '',
                    basePath,
                    state,
                  )}</td>`,
              )
              .join('')}</tr>`,
        )
        .join('');

      html += `<div class="table-wrap"><table><thead><tr>${head}</tr></thead>${
        body ? `<tbody>${body}</tbody>` : ''
      }</table></div>`;
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      const quoteLines = [];

      while (index < lines.length && /^\s{0,3}>/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s{0,3}>\s?/, ''));
        index += 1;
      }

      html += `<blockquote>${renderBlocks(quoteLines, basePath, state)}</blockquote>`;
      continue;
    }

    if (LIST_RE.test(line)) {
      const list = parseList(lines, index, basePath, state);
      html += list.html;
      index = list.next;
      continue;
    }

    const paragraph = [];

    while (index < lines.length) {
      const current = lines[index];
      if (/^\s*$/.test(current)) break;
      if (paragraph.length > 0 && isBlockStart(current, lines, index)) break;
      paragraph.push(current.trim());
      index += 1;
    }

    html += `<p>${renderInline(paragraph.join(' '), basePath, state)}</p>`;
  }

  return html;
}

export function renderMarkdown(markdown, { basePath = '/README.md' } = {}) {
  const state = { headingIds: new Map() };
  return renderBlocks(markdown.replace(/\r\n?/g, '\n').split('\n'), basePath, state);
}

function renderPage(doc, body, version) {
  const pageTitle =
    doc.id === 'overview' ? 'Документация Sweety' : `${doc.title} — документация Sweety`;
  const navigation = DOC_NAV.map((item) => {
    const active = item.id === doc.id ? ' class="active" aria-current="page"' : '';
    return `<a href="${item.href}"${active}>${item.title}</a>`;
  }).join('');
  const demoNavigation = DEMO_NAV.map(
    (item) =>
      `<a href="${item.href}" target="_blank" rel="noreferrer"><span>${escapeHtml(
        item.title,
      )}</span><small>${escapeHtml(item.note)}</small></a>`,
  ).join('');

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <link rel="icon" href="/assets/brand/favicon.svg" type="image/svg+xml">
    <link rel="alternate icon" href="/assets/brand/favicon.ico" sizes="16x16 32x32">
    <title>${escapeHtml(pageTitle)}</title>
    <style>${PAGE_STYLES}</style>
  </head>
  <body>
    <div class="layout">
      <aside class="sidebar">
        <a class="brand" href="/docs/">
          <img class="brand-mark" src="/assets/brand/sweety-mark.svg" alt="" width="44" height="44" aria-hidden="true">
          <span class="brand-text"><strong>Sweety</strong><small>интерактивные карты</small></span>
        </a>
        <nav class="nav" aria-label="Документация">${navigation}</nav>
        <nav class="nav nav-demos" aria-label="Демо">
          <span class="nav-title">Демо</span>${demoNavigation}
        </nav>
        <div class="sidebar-footer">
          <span>v${escapeHtml(version)}</span>
        </div>
      </aside>
      <main class="content">
        <div class="content-inner">
          <article class="markdown">${body}</article>
          <footer class="doc-footer">
            <span>Sweety v${escapeHtml(version)} · MIT</span>
            <a href="/examples/">Открыть демо →</a>
          </footer>
        </div>
      </main>
    </div>
    <script>
      for (const image of document.querySelectorAll('.markdown img')) {
        const hide = () => (image.closest('a') || image).remove();
        if (image.complete && image.naturalWidth === 0) hide();
        else image.addEventListener('error', hide, { once: true });
      }
    </script>
  </body>
</html>`;
}

const PAGE_STYLES = `
:root {
  color-scheme: light;
  --ink: #1e293b;
  --muted: #64748b;
  --line: #e2e8f0;
  --accent: #0369a1;
  --accent-soft: #e0f2fe;
  --code-bg: #0b1220;
  --code-ink: #e2e8f0;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: #f6f8fc;
  color: var(--ink);
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 16px;
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

a {
  color: var(--accent);
}

.layout {
  min-height: 100vh;
}

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  display: flex;
  width: 284px;
  flex-direction: column;
  overflow-y: auto;
  padding: 30px 22px;
  border-right: 1px solid #1e293b;
  background:
    radial-gradient(120% 80% at 15% 0%, #16294a 0%, #0b1220 58%),
    #0b1220;
  color: #cbd5e1;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 34px;
  color: #fff;
  text-decoration: none;
}

.brand-mark {
  display: block;
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 12px;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.brand-text strong {
  font-size: 18px;
  letter-spacing: -0.01em;
}

.brand-text small {
  color: #7f93ad;
  font-size: 11.5px;
  letter-spacing: 0.02em;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav a {
  padding: 9px 12px;
  border-radius: 9px;
  color: #94a3b8;
  font-size: 14.5px;
  text-decoration: none;
  transition:
    background 120ms ease,
    color 120ms ease;
}

.nav a:hover {
  background: rgba(148, 163, 184, 0.1);
  color: #e2e8f0;
}

.nav a.active {
  background: rgba(56, 189, 248, 0.14);
  color: #7dd3fc;
  font-weight: 600;
}

.nav-demos {
  gap: 2px;
  margin-top: 26px;
  padding-top: 20px;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
}

.nav-title {
  padding: 0 12px 6px;
  color: #64748b;
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.nav-demos a {
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1.35;
}

.nav-demos a > span::after {
  margin-left: 4px;
  color: #475569;
  content: "↗";
  font-size: 11px;
}

.nav-demos a small {
  color: #64748b;
  font-size: 11.5px;
  font-weight: 400;
}

.nav-demos a:hover small {
  color: #94a3b8;
}

.sidebar-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 28px;
  color: #64748b;
  font-size: 12.5px;
}

.sidebar-footer a {
  color: #7dd3fc;
  text-decoration: none;
}

.sidebar-footer a:hover {
  text-decoration: underline;
}

.content {
  margin-left: 284px;
  padding: 54px 48px 72px;
}

.content-inner {
  max-width: 900px;
  margin: 0 auto;
}

.markdown {
  padding: 54px 58px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.07);
}

.markdown > :first-child {
  margin-top: 0;
}

.markdown h1,
.markdown h2,
.markdown h3,
.markdown h4 {
  color: #0f172a;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.25;
}

.markdown h1 {
  margin: 0 0 0.45em;
  font-size: 2.5rem;
  letter-spacing: -0.04em;
}

.markdown h1 + p {
  color: #475569;
  font-size: 1.08rem;
}

.markdown h2 {
  margin: 2.3em 0 0.8em;
  padding-top: 1em;
  border-top: 1px solid var(--line);
  font-size: 1.58rem;
}

.markdown h3 {
  margin: 1.8em 0 0.55em;
  font-size: 1.22rem;
}

.markdown h4 {
  margin: 1.5em 0 0.5em;
  font-size: 1.05rem;
}

.markdown p {
  margin: 0 0 1.05em;
}

.markdown strong {
  color: #0f172a;
  font-weight: 650;
}

.markdown ul,
.markdown ol {
  margin: 0 0 1.1em;
  padding-left: 1.45em;
}

.markdown li {
  margin: 0.28em 0;
}

.markdown li > ul,
.markdown li > ol {
  margin: 0.3em 0 0.35em;
}

.markdown a {
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

.markdown a:hover {
  color: #075985;
}

.markdown .anchor {
  margin-left: 0.35em;
  color: #94a3b8;
  font-weight: 400;
  text-decoration: none;
  opacity: 0;
  transition: opacity 120ms ease;
}

.markdown h1:hover .anchor,
.markdown h2:hover .anchor,
.markdown h3:hover .anchor,
.markdown h4:hover .anchor {
  opacity: 1;
}

.markdown code {
  padding: 0.14em 0.4em;
  border: 1px solid #e0e7ff;
  border-radius: 6px;
  background: #eef2ff;
  color: #3730a3;
  font-family: "SFMono-Regular", ui-monospace, "Cascadia Code", Consolas, monospace;
  font-size: 0.86em;
}

.markdown pre {
  position: relative;
  overflow: auto;
  margin: 1.4em 0;
  padding: 20px 22px;
  border-radius: 12px;
  background: var(--code-bg);
  color: var(--code-ink);
  font-size: 13.5px;
  line-height: 1.65;
  tab-size: 2;
}

.markdown pre[data-lang]::before {
  position: absolute;
  top: 8px;
  right: 12px;
  color: #64748b;
  content: attr(data-lang);
  font-family: "SFMono-Regular", ui-monospace, Consolas, monospace;
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.markdown pre code {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font-size: inherit;
}

.markdown blockquote {
  margin: 1.5em 0;
  padding: 15px 20px;
  border-left: 4px solid #3b82f6;
  border-radius: 0 10px 10px 0;
  background: #eff6ff;
  color: #1e3a8a;
}

.markdown blockquote p {
  margin: 0;
}

.table-wrap {
  overflow-x: auto;
  margin: 1.4em 0;
  border: 1px solid var(--line);
  border-radius: 12px;
}

.markdown table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  line-height: 1.55;
}

.markdown th {
  background: #f1f5f9;
  color: #0f172a;
  font-weight: 650;
  text-align: left;
}

.markdown th,
.markdown td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
  vertical-align: top;
}

.markdown tbody tr:last-child td {
  border-bottom: 0;
}

.markdown tbody tr:hover {
  background: #f8fafc;
}

.markdown td code {
  white-space: nowrap;
  font-size: 0.83em;
}

.markdown img {
  max-width: 100%;
  height: auto;
  vertical-align: middle;
}

.markdown p > img:only-child {
  display: block;
  width: 100%;
  margin: 1.5em 0;
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.12);
}

.markdown p > a > img {
  border: 0;
  border-radius: 4px;
  box-shadow: none;
}

.markdown p[align='center'] {
  text-align: center;
}

.markdown p[align='center'] > img {
  display: inline-block;
  width: auto;
  max-height: 120px;
  margin: 0.4em 0 0.6em;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.markdown hr {
  margin: 2.2em 0;
  border: 0;
  border-top: 1px solid var(--line);
}

.doc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px 6px 0;
  color: #94a3b8;
  font-size: 13px;
}

.doc-footer a {
  color: #0369a1;
  text-decoration: none;
}

.doc-footer a:hover {
  text-decoration: underline;
}

::selection {
  background: #bae6fd;
  color: #0c4a6e;
}

@media (max-width: 980px) {
  .sidebar {
    position: static;
    width: auto;
    height: auto;
    overflow: visible;
    padding: 20px;
  }

  .brand {
    margin-bottom: 18px;
  }

  .nav {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px;
  }

  .nav-demos {
    margin-top: 12px;
    padding-top: 14px;
  }

  .nav-title {
    flex: 0 0 100%;
    padding: 0 2px 4px;
  }

  .nav-demos a {
    flex: 0 0 100%;
  }

  .sidebar-footer {
    margin-top: 18px;
    padding-top: 0;
  }

  .content {
    margin-left: 0;
    padding: 24px 16px 44px;
  }

  .markdown {
    padding: 30px 22px;
    border-radius: 16px;
  }

  .markdown h1 {
    font-size: 2rem;
  }
}

@media (max-width: 560px) {
  .markdown {
    padding: 24px 16px;
  }

  .markdown h1 {
    font-size: 1.7rem;
  }

  .markdown h2 {
    font-size: 1.35rem;
  }

  .doc-footer {
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }
}
`;

function createHandler(root, version) {
  const rootPath = resolve(root);

  return async function docsMiddleware(request, response, next) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      next();
      return;
    }

    let pathname;
    let rawPathname;

    try {
      const url = new URL(request.url || '/', 'http://localhost');
      rawPathname = decodeURIComponent(url.pathname);
      pathname = rawPathname.toLowerCase();
    } catch {
      next();
      return;
    }

    if (pathname === '/docs') {
      response.statusCode = 302;
      response.setHeader('Location', '/docs/');
      response.end();
      return;
    }

    const doc = DOC_PAGES.get(pathname);
    if (!doc) {
      if (!pathname.endsWith('.md') || pathname.startsWith('/node_modules/')) {
        next();
        return;
      }
      await serveMarkdownFile(rawPathname, request, response, next);
      return;
    }

    try {
      const filePath = resolve(rootPath, doc.file);

      if (!filePath.startsWith(`${rootPath}${sep}`)) {
        next();
        return;
      }

      const markdown = await readFile(filePath, 'utf8');
      const body = renderMarkdown(markdown, { basePath: doc.basePath });
      const page = renderPage(doc, body, version);

      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.end(request.method === 'HEAD' ? undefined : page);
    } catch (error) {
      console.error('[sweety-docs] не удалось отрисовать документацию:', error);
      next();
    }
  };

  /**
   * Любой .md внутри проекта отдаётся как HTML с UTF-8. Это закрывает не только
   * docs/, но и README пакетов в монорепозитории.
   */
  async function serveMarkdownFile(requestPath, request, response, next) {
    try {
      const relative = requestPath.replace(/^\/+/, '');
      const filePath = resolve(rootPath, relative);
      if (!filePath.startsWith(`${rootPath}${sep}`)) {
        next();
        return;
      }
      const markdown = await readFile(filePath, 'utf8');
      const heading = markdown.match(/^\s{0,3}#\s+(.+?)\s*$/m);
      const doc = {
        id: 'package',
        title: heading ? stripInline(heading[1]) : relative.split('/').pop(),
        file: relative,
        basePath: requestPath,
      };
      const body = renderMarkdown(markdown, { basePath: requestPath });
      const page = renderPage(doc, body, version);

      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.end(request.method === 'HEAD' ? undefined : page);
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'EISDIR') {
        console.error('[sweety-docs] не удалось отрисовать markdown:', error);
      }
      next();
    }
  }
}

/**
 * Экспортируется для тестов: проверяет, что middleware отдаёт markdown как
 * HTML с charset=utf-8, а не как text/markdown без кодировки.
 * @param {{root?: string, version?: string}} [options]
 */
export function createDocsMiddleware({ root = process.cwd(), version = '' } = {}) {
  return createHandler(root, version);
}

export function docsPreview({ version = '' } = {}) {
  return {
    name: 'sweety-docs-preview',
    configureServer(server) {
      server.middlewares.use(createHandler(server.config.root, version));
    },
  };
}
