import { beforeAll, describe, expect, it } from 'vitest';
import { fullProviders } from '../src/providers/index.js';
import { registerProviders } from '../src/registry.js';
import { getTileSource, registerTileSource, TileSourceAdapter } from '../src/adapters/index.js';
import { quadKey } from '../src/adapters/BingAdapter.js';
import { resolveBasemap } from '../src/resolver.js';

beforeAll(() => {
  registerProviders(fullProviders);
});

function urlFor(id, coords, opts = {}) {
  const resolved = resolveBasemap(id, opts);
  return getTileSource(resolved.type).buildUrl(resolved.provider, coords, resolved);
}

describe('adapters: XYZ/Google/Bing', () => {
  it('XYZ выбирает субдомен и подставляет координаты', () => {
    const url = urlFor('osm', { x: 1, y: 2, z: 3 });
    expect(url).toMatch(/^https:\/\/[abc]\.tile\.openstreetmap\.org\/3\/1\/2\.png$/);
  });

  it('Google кодирует слой и использует mt-субдомен', () => {
    const resolved = resolveBasemap('google', { variant: 'satellite' });
    const url = getTileSource('google').buildUrl(resolved.provider, { x: 4, y: 5, z: 6 }, resolved);
    expect(url).toContain('lyrs=s');
    expect(url).toContain('x=4&y=5&z=6');
    expect(url).toMatch(/mt[0-3]\.google\.com/);
  });

  it('Bing строит quadkey', () => {
    expect(quadKey({ x: 3, y: 5, z: 3 })).toBe('213');
    const resolved = resolveBasemap('bing');
    const url = getTileSource('bing').buildUrl(resolved.provider, { x: 3, y: 5, z: 3 }, resolved);
    expect(url).toContain('/a213.jpeg');

    const keyed = resolveBasemap('bing', { key: 'bing-key-123' });
    const keyedUrl = getTileSource('bing').buildUrl(keyed.provider, { x: 3, y: 5, z: 3 }, keyed);
    expect(keyedUrl).toContain('key=bing-key-123');
  });

  it('Yandex передаёт слой', () => {
    const resolved = resolveBasemap('yandex', { variant: 'satellite' });
    const url = getTileSource('yandex').buildUrl(resolved.provider, { x: 1, y: 1, z: 1 }, resolved);
    expect(url).toContain('l=sat');
  });
});

describe('adapters: WMS/WMTS', () => {
  it('WMS собирает BBOX в EPSG:3857', () => {
    const resolved = resolveBasemap('usgs-imagery');
    const url = getTileSource('wms').buildUrl(resolved.provider, { x: 1, y: 1, z: 2 }, resolved);
    expect(url).toContain('SERVICE=WMS');
    expect(url).toContain('REQUEST=GetMap');
    expect(url).toContain('WIDTH=256');
    expect(url).toContain('HEIGHT=256');
    expect(url).toContain('CRS=EPSG%3A3857');
    expect(url).toContain('BBOX=');
  });

  it('WMS 1.1.1 использует SRS', () => {
    const resolved = resolveBasemap('usgs-imagery');
    const url = getTileSource('wms').buildUrl(
      { ...resolved.provider, version: '1.1.1' },
      { x: 1, y: 1, z: 2 },
      resolved,
    );
    expect(url).toContain('SRS=EPSG%3A3857');
    expect(url).not.toContain('CRS=');
  });

  it('WMTS формирует TileMatrix/TileRow/TileCol', () => {
    const adapter = getTileSource('wmts');
    const provider = {
      id: 'wmts-test',
      url: 'https://wmts.example/{z}/{x}/{y}',
      layer: 'demo',
      tileMatrixSet: 'EPSG:3857',
      format: 'image/png',
    };
    const url = adapter.buildUrl(provider, { x: 3, y: 4, z: 5 }, {});
    expect(url).toContain('TILEMATRIX=5');
    expect(url).toContain('TILEROW=4');
    expect(url).toContain('TILECOL=3');
    expect(url).toContain('TILEMATRIXSET=EPSG%3A3857');
  });

  it('пользовательский адаптер регистрируется по type', () => {
    class CorpAdapter extends TileSourceAdapter {
      constructor() {
        super('corp');
      }
      buildUrl(_provider, coords) {
        return `https://corp/${coords.z}/${coords.x}/${coords.y}`;
      }
    }
    registerTileSource('corp', new CorpAdapter());
    expect(getTileSource('corp').buildUrl({}, { x: 1, y: 2, z: 3 }, {})).toBe('https://corp/3/1/2');
  });
});
