import { copyFile } from 'node:fs/promises';
import { URL, fileURLToPath } from 'node:url';

// UMD-сборка Vite получает расширение .cjs для require; для <script> и unpkg
// кладём рядом копию с .js, чтобы MIME и имя файла были предсказуемыми.
const source = fileURLToPath(new URL('../dist/map-edit-plugin.umd.cjs', import.meta.url));
const target = fileURLToPath(new URL('../dist/map-edit-plugin.umd.js', import.meta.url));
await copyFile(source, target);
