import { afterEach, describe, expect, it, vi } from 'vitest';
import { Map } from '../src/core/Map.js';
import { TileLayer } from '../src/layers/TileLayer.js';

function setup(layerOptions = {}, mapOptions = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mockElementSize(container, 800, 600);
  const map = new Map(container, {
    center: [0, 0],
    zoom: 4,
    zoomControl: false,
    attributionControl: false,
    ...mapOptions,
  });
  const layer = new TileLayer('https://{s}.tiles.test/{z}/{x}/{y}{r}.png', {
    subdomains: 'abc',
    ...layerOptions,
  }).addTo(map);
  return { map, layer, container };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('TileLayer', () => {
  it('renders only visible tiles and reuses or removes them while panning', () => {
    const { map, layer } = setup();
    const initial = layer.getActiveTileCount();
    expect(initial).toBeGreaterThan(10);
    expect(initial).toBeLessThan(120);
    expect(layer._container.querySelectorAll('img.sweety-tile')).toHaveLength(initial);

    const range = layer.getTileRange();
    expect(range).toMatchObject({ minX: expect.any(Number), maxX: expect.any(Number) });
    for (const key of Object.keys(layer._tiles)) {
      const [, x, y] = key.split('/').map(Number);
      expect(x).toBeGreaterThanOrEqual(range.minX);
      expect(x).toBeLessThanOrEqual(range.maxX);
      expect(y).toBeGreaterThanOrEqual(range.minY);
      expect(y).toBeLessThanOrEqual(range.maxY);
    }

    const firstKeys = Object.keys(layer._tiles);
    map.panBy([1600, 1200]);
    const movedKeys = Object.keys(layer._tiles);
    expect(movedKeys).not.toEqual(firstKeys);
    expect(layer.getActiveTileCount()).toBeLessThan(120);
    map.remove();
  });

  it('builds URLs with subdomains, TMS and retina support', () => {
    const { map, layer } = setup();
    const url = layer.getTileUrl({ x: 1, y: 2, z: 3 });
    expect(url).toBe('https://a.tiles.test/3/1/2.png');

    layer.options.tms = true;
    expect(layer.getTileUrl({ x: 1, y: 0, z: 1 })).toBe('https://c.tiles.test/1/1/1.png');

    layer.options.tms = false;
    layer.options.detectRetina = true;
    const originalDpr = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    expect(layer.getTileUrl({ x: 1, y: 2, z: 3 })).toContain('@2x.png');
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: originalDpr });
    map.remove();
  });

  it('honours noWrap and zoom range options', () => {
    const { map, layer } = setup({ noWrap: true, minZoom: 4, maxZoom: 8 });
    const keys = Object.keys(layer._tiles);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const x = Number(key.split('/')[1]);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(2 ** 4);
    }

    map.setZoom(2);
    expect(layer._container.style.display).toBe('none');
    expect(layer.getActiveTileCount()).toBe(0);
    map.remove();
  });

  it('supports opacity, URL changes and cache bookkeeping', () => {
    const { map, layer } = setup();
    layer.setOpacity(0.5);
    expect(layer._container.style.opacity).toBe('0.5');

    const cached = document.createElement('img');
    Object.defineProperty(cached, 'complete', { value: true });
    layer._putCachedTile('cached://tile', cached);
    expect(layer.getCacheSize()).toBe(1);
    expect(layer._takeCachedTile('cached://tile')).toBe(cached);
    expect(layer.getCacheSize()).toBe(0);

    layer.setUrl('https://{s}.other.test/{z}/{x}/{y}.png');
    expect(layer.getTileUrl({ x: 0, y: 0, z: 0 })).toContain('other.test');
    map.remove();
  });

  it('fires tileerror and applies the configured error tile', () => {
    vi.useFakeTimers();
    const { map, layer } = setup({ errorTileUrl: 'https://tiles.test/error.png' });
    const listener = vi.fn();
    map.on('tileerror', listener);
    const tile = Object.values(layer._tiles)[0];
    tile.el.onerror();

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].url).toContain('tiles.test');
    expect(tile.el.src).toBe('https://tiles.test/error.png');
    expect(tile.el.classList.contains('sweety-tile-error')).toBe(true);
    map.remove();
  });

  it('retries failed tiles with exponential backoff', () => {
    vi.useFakeTimers();
    const { map, layer } = setup({ maxRetries: 2 });
    const tile = Object.values(layer._tiles)[0];
    tile.el.onerror();
    expect(tile.errorCount).toBe(1);
    vi.advanceTimersByTime(300);
    expect(tile.el.src).toContain('_sweety_retry=1');
    map.remove();
  });

  it('defers tile updates until idle when requested', () => {
    const { map, layer } = setup({ updateWhenIdle: true });
    const before = Object.keys(layer._tiles);
    map._dragging = true;
    map.setView([20, 20], 4, { animate: false });
    expect(Object.keys(layer._tiles)).toEqual(before);

    map._dragging = false;
    map.fire('moveend');
    expect(Object.keys(layer._tiles)).not.toEqual(before);
    map.remove();
  });

  it('cleans up its DOM and timers on removal', () => {
    const { map, layer } = setup();
    const root = layer._container;
    layer.remove();
    expect(root.parentNode).toBeNull();
    expect(layer._container).toBeNull();
    expect(layer.getActiveTileCount()).toBe(0);
    map.remove();
  });
});
