#!/usr/bin/env node
/**
 * Дымовой тест демо редактора в настоящем браузере.
 *
 * Поднимает dev-сервер Vite, открывает демо в headless Chrome и проверяет, что
 * страница действительно отрисовалась: панель на месте, кнопки инструментов
 * есть, а экран ошибки демо не появился. Тест ловит регрессии, которые не видит
 * jsdom, — например пустую страницу из-за несобираемого импорта.
 *
 * Запуск: `npm run smoke:demo`. Путь к браузеру можно задать через CHROME_PATH,
 * порт — через SMOKE_PORT.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.SMOKE_PORT) || 5199;
const DEMO_URL = `http://localhost:${PORT}/packages/map-edit-plugin/demo/`;
const VITE_BIN = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const WORK = mkdtempSync(join(tmpdir(), 'sweety-smoke-'));
const DOM_FILE = join(WORK, 'dom.html');
const VITE_LOG = join(WORK, 'vite.log');

/** Кандидаты в порядке предпочтения; первый найденный используется. */
function chromeCandidates() {
  const candidates = [process.env.CHROME_PATH, process.env.CHROME_BIN];
  if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    );
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  } else {
    candidates.push('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser');
  }
  return candidates.filter(Boolean);
}

/** Запускает команду, направляя stdout в файл: без пайпов это работает везде. */
function runToFile(command, args, file, timeout) {
  return new Promise((resolvePromise, reject) => {
    const fd = openSync(file, 'w');
    const child = spawn(command, args, { stdio: ['ignore', fd, 'ignore'] });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${command}: превышено время ожидания (${timeout} мс)`));
    }, timeout);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolvePromise(code);
    });
  });
}

async function waitForServer(url, timeout = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return true;
    } catch {
      // сервер ещё поднимается
    }
    await new Promise((done) => setTimeout(done, 300));
  }
  return false;
}

/** Первый кандидат, который действительно запускается. */
function findChrome() {
  for (const candidate of chromeCandidates()) {
    const probe = spawnSync(candidate, ['--version'], { stdio: 'ignore', timeout: 10000 });
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
}

async function main() {
  if (!existsSync(VITE_BIN)) {
    throw new Error(`не найден Vite: ${VITE_BIN}. Запустите npm install`);
  }
  const chrome = findChrome();
  if (!chrome) throw new Error('не найден Chrome. Укажите CHROME_PATH');

  const vite = spawn(
    process.execPath,
    [VITE_BIN, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: ROOT, stdio: ['ignore', openSync(VITE_LOG, 'w'), openSync(VITE_LOG, 'a')] },
  );

  try {
    if (!(await waitForServer(DEMO_URL))) {
      const log = existsSync(VITE_LOG) ? readFileSync(VITE_LOG, 'utf8').slice(-1500) : '';
      throw new Error(`dev-сервер не ответил за 30 с.\n${log}`);
    }

    // Внешние запросы (тайлы) блокируем: в CI сети может не быть, а для проверки
    // разметки они не нужны.
    await runToFile(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        '--virtual-time-budget=15000',
        '--dump-dom',
        `--user-data-dir=${join(WORK, 'profile')}`,
        '--host-resolver-rules=MAP * 127.0.0.1,EXCLUDE localhost',
        DEMO_URL,
      ],
      DOM_FILE,
      60000,
    );

    const dom = readFileSync(DOM_FILE, 'utf8');
    const buttons = (dom.match(/data-action="/g) || []).length;
    const problems = [];
    if (!dom) problems.push('браузер вернул пустой DOM');
    if (dom.includes('id="demo-failure"')) problems.push('демо показало экран ошибки');
    if (!dom.includes('map-edit-control')) problems.push('панель инструментов не отрисована');
    if (!dom.includes('data-action="drag"')) problems.push('нет кнопки перетаскивания');
    if (buttons < 16) problems.push(`кнопок инструментов: ${buttons}, ожидалось не меньше 16`);
    if (!dom.includes('плагин установлен')) problems.push('демо не дошло до состояния ready');

    if (problems.length) {
      throw new Error(`проверка демо не прошла:\n- ${problems.join('\n- ')}`);
    }
    console.log(`ok демо: ${buttons} кнопок, панель и редактор на месте`);
  } finally {
    vite.kill('SIGKILL');
    rmSync(WORK, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`smoke:demo: ${error.message}`);
  process.exitCode = 1;
});
