import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { URL, fileURLToPath } from 'node:url';

const files = {
  'map-edit-plugin.es.js': 40 * 1024,
  'map-edit-plugin.umd.js': 40 * 1024,
  'map-edit-plugin.css': 10 * 1024,
};

let failed = false;
for (const [name, limit] of Object.entries(files)) {
  const path = fileURLToPath(new URL(`../dist/${name}`, import.meta.url));
  const buffer = readFileSync(path);
  const gzip = gzipSync(buffer);
  const ok = gzip.byteLength <= limit;
  if (!ok) failed = true;
  process.stdout.write(
    `${ok ? 'ok' : 'FAIL'} ${name}: ${(buffer.byteLength / 1024).toFixed(1)} KiB raw, ` +
      `${(gzip.byteLength / 1024).toFixed(1)} KiB gzip (limit ${(limit / 1024).toFixed(0)} KiB)\n`,
  );
}

if (failed) {
  throw new Error('Bundle size budget exceeded');
}
