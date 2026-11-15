import { beforeAll, describe, expect, it } from 'vitest';
import { BasemapKeyError, maskUrl } from '../src/errors.js';
import { fullProviders } from '../src/providers/index.js';
import {
  getAttribution,
  isRetinaDisplay,
  resolveBasemap,
  resolveKey,
  resolveUrl,
} from '../src/resolver.js';
import { registerProviders } from '../src/registry.js';

beforeAll(() => {
  registerProviders(fullProviders);
});

describe('resolver: subdomains и координаты', () => {
  it('оставляет шаблон субдомена для TileLayer по умолчанию', () => {
    expect(resolveUrl('osm')).toBe('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
  });

  it('подставляет субдомен, z/x/y и -y при coords', () => {
    const url = resolveUrl('osm', { coords: { x: 1, y: 2, z: 3 } });
    expect(url).toContain('/3/1/2.png');
    expect(url).toContain('https://a.tile.openstreetmap.org/');
  });

  it('явно заданный subdomain имеет приоритет', () => {
    expect(resolveUrl('osm', { subdomain: 'c' })).toContain('https://c.tile');
  });
});

describe('resolver: retina и варианты', () => {
  it('подставляет @2x для retina', () => {
    expect(resolveUrl('carto-dark', { retina: true })).toContain('@2x.png');
    expect(resolveUrl('carto-dark', { retina: false })).not.toContain('@2x');
  });

  it('выбирает вариант Mapbox и подставляет ключ', () => {
    const url = resolveUrl('mapbox', { key: 'pk.test-12345678', variant: 'satellite' });
    expect(url).toContain('/satellite-v9/');
    expect(url).toContain('access_token=pk.test-12345678');
  });

  it('разрешает {variant} для HERE и MapTiler', () => {
    expect(resolveUrl('here', { key: 'here-key-123', variant: 'satellite' })).toContain(
      'style=satellite.day',
    );
    expect(resolveUrl('maptiler', { key: 'mt-key-123', variant: 'topo' })).toContain('/topo-v2/');
  });

  it('возвращает атрибуцию варианта', () => {
    expect(getAttribution('mapbox', { variant: 'satellite' })).toContain('Mapbox');
    expect(getAttribution('osm')).toContain('OpenStreetMap');
  });

  it('ошибка на неизвестном варианте', () => {
    expect(() => resolveBasemap('mapbox', { key: 'pk-12345678', variant: 'nope' })).toThrow(
      /Unknown variant/,
    );
  });
});

describe('resolver: ключи', () => {
  it('требует ключ и содержит termsUrl в ошибке', () => {
    let error;
    try {
      resolveUrl('mapbox');
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(BasemapKeyError);
    expect(error.code).toBe('missing-key');
    expect(error.message).toContain('requires an API key');
    expect(error.message).toContain('mapbox.com');
  });

  it('приоритет opts.key → keys[id] → global → env', () => {
    const provider = { id: 'x', requiresKey: true };
    expect(resolveKey(provider, { key: 'opts' }, { keys: { x: 'id', global: 'global' } })).toBe(
      'opts',
    );
    expect(resolveKey(provider, {}, { keys: { x: 'id', global: 'global' } })).toBe('id');
    expect(resolveKey(provider, {}, { keys: { global: 'global' } })).toBe('global');
    expect(resolveKey(provider, {}, { env: { SWEETY_BASEMAP_X_KEY: 'env' } })).toBe('env');
  });

  it('использует envKey провайдера', () => {
    const url = resolveUrl('mapbox', {}, { env: { MAPBOX_ACCESS_TOKEN: 'pk.env-12345678' } });
    expect(url).toContain('access_token=pk.env-12345678');
  });

  it('маскирует ключ в URL и ошибках', () => {
    expect(maskUrl('https://x/?access_token=pk.secret-123', 'pk.secret-123')).not.toContain(
      'pk.secret-123',
    );
    expect(maskUrl('https://x/?key=secret')).not.toContain('secret');
  });
});

describe('resolver: proxy и attribution', () => {
  it('применяет proxy-функцию', () => {
    const url = resolveUrl('osm', { proxy: (value) => `/proxy?url=${encodeURIComponent(value)}` });
    expect(url).toMatch(/^\/proxy\?url=/);
  });

  it('отключает атрибуцию при attribution:false', () => {
    expect(resolveBasemap('osm', { attribution: false }).attribution).toBe('');
  });

  it('isRetinaDisplay не падает без window', () => {
    expect(typeof isRetinaDisplay()).toBe('boolean');
  });
});
