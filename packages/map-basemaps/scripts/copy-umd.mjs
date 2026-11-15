import { copyFile } from 'node:fs/promises';
import { URL, fileURLToPath } from 'node:url';

const files = [
  ['map-basemaps.umd.cjs', 'map-basemaps.umd.js'],
  ['map-basemaps.light.umd.cjs', 'map-basemaps.light.umd.js'],
];

for (const [from, to] of files) {
  const source = fileURLToPath(new URL(`../dist/${from}`, import.meta.url));
  const target = fileURLToPath(new URL(`../dist/${to}`, import.meta.url));
  await copyFile(source, target);
}
