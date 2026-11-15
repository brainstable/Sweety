import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');

const artifacts = [
  'dist/sweety.es.js',
  'dist/sweety.umd.cjs',
  'dist/sweety.umd.js',
  'dist/sweety.css',
];

for (const artifact of artifacts) {
  const path = resolve(root, artifact);
  if (!existsSync(path) || statSync(path).size === 0) {
    console.error(`Отсутствует артефакт сборки: ${artifact}`);
    process.exit(1);
  }
}

const umd = require(resolve(root, 'dist/sweety.umd.cjs'));
const esm = await import(pathToFileURL(resolve(root, 'dist/sweety.es.js')).href);

if (typeof umd.Map !== 'function' || typeof esm.Map !== 'function') {
  console.error('В сборках отсутствует экспорт Map');
  process.exit(1);
}
if (umd.version !== esm.version) {
  console.error('Версии ESM и UMD не совпадают');
  process.exit(1);
}

console.log(`Сборки корректны, версия ${umd.version}`);
