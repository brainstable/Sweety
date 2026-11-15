import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const source = new URL('../dist/sweety.umd.cjs', import.meta.url);
const target = new URL('../dist/sweety.umd.js', import.meta.url);
const sourceMap = new URL('../dist/sweety.umd.cjs.map', import.meta.url);
const targetMap = new URL('../dist/sweety.umd.js.map', import.meta.url);

if (!existsSync(source)) {
  console.error('Не найден dist/sweety.umd.cjs. Сначала выполните vite build.');
  process.exit(1);
}

const bundle = await readFile(source, 'utf8');
await writeFile(target, bundle.replace(/sweety\.umd\.cjs\.map/g, 'sweety.umd.js.map'), 'utf8');

if (existsSync(sourceMap)) {
  await copyFile(sourceMap, targetMap);
}

console.log('Создана браузерная UMD-копия: dist/sweety.umd.js');
