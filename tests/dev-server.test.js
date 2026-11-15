import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'vite';

// Корневой dev-сервер (`npm run dev`) обслуживает demo-страницы пакетов по
// адресам /packages/<pkg>/demo/. Пакеты импортируют ядро как `sweety-map`,
// и это имя должно разрешаться без установки пакета в node_modules.
// Регрессия: без alias Vite отвечал 500 «Failed to resolve import
// "sweety-map"» на inline-модуль demo, и страница оставалась пустой.

const root = process.cwd();
const configFile = join(root, 'vite.config.js');

/** @type {import('vite').ViteDevServer} */
let server;

beforeAll(async () => {
  server = await createServer({
    configFile,
    root,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, watch: null },
  });
}, 60_000);

afterAll(async () => {
  await server.close();
});

/**
 * Повторяет то, что делает браузер: Vite превращает inline-модуль demo в
 * html-proxy, а затем трансформирует его вместе с импортами.
 * @param {string} demoPath путь от корня репозитория
 * @returns {Promise<string>} код трансформированного модуля
 */
async function transformDemoModule(demoPath) {
  const url = `/${demoPath.split('\\').join('/')}`;
  const html = readFileSync(join(root, demoPath), 'utf8');
  const transformed = await server.transformIndexHtml(url, html);

  const proxy = transformed.match(/[^"'\s]+\?html-proxy[^"'\s]*\.js/);
  expect(proxy, 'inline-модуль demo должен превращаться в html-proxy').not.toBeNull();

  const result = await server.transformRequest(proxy[0].replace(/&amp;/g, '&'));
  expect(result).not.toBeNull();
  return result.code;
}

describe('root Vite server: demo-страницы пакетов запускаются', () => {
  it('редактор геометрии: inline-модуль резолвит sweety-map и ядро', async () => {
    const code = await transformDemoModule('packages/map-edit-plugin/demo/index.html');
    expect(code).toContain('/src/index.js');
    expect(code).toContain('__sweetyDemoReady');
  });

  it('каталог подложек: inline-модуль резолвит sweety-map', async () => {
    const code = await transformDemoModule('packages/map-basemaps/demo/index.html');
    expect(code).toContain('/src/index.js');
  });

  it('пакетный исходник резолвит sweety-map в src, а не в dist', async () => {
    const result = await server.transformRequest(
      '/packages/map-edit-plugin/src/core/EditSession.js',
    );
    expect(result.code).toMatch(/["']\/src\/index\.js["']/);
  });
});
