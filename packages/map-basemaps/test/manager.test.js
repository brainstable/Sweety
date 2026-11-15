import { afterEach, describe, expect, it } from 'vitest';
import { AttributionControl, Map, TileLayer } from 'sweety-map';
import { BasemapControl, basemaps, createBasemap } from '../src/index.js';

const harnesses = [];

function createMap(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mockElementSize(container, 800, 600);
  const map = new Map(container, {
    center: [0, 0],
    zoom: 3,
    zoomControl: false,
    attributionControl: false,
    zoomAnimation: false,
    fadeAnimation: false,
    doubleClickZoom: false,
    ...options,
  });
  return { map, container };
}

function createHarness(managerOptions = {}) {
  const { map, container } = createMap();
  const manager = basemaps.install(map, managerOptions);
  const harness = { map, container, manager };
  harnesses.push(harness);
  return harness;
}

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    if (!harness.manager._destroyed) harness.manager.destroy();
    harness.map.remove();
  }
  localStorage.clear();
});

describe('BasemapsManager: переключение', () => {
  it('добавляет OSM и переключает Carto без дублей атрибуции', () => {
    const { map, container, manager } = createHarness();
    map.addControl(new AttributionControl({ prefix: '' }));

    expect(manager.set('osm')).toBe(true);
    expect(manager.get()).toBe('osm');
    expect(manager.getLayer()).toBeInstanceOf(TileLayer);
    expect(map.hasLayer(manager.getLayer())).toBe(true);
    expect(manager.getLayer().getAttribution()).toContain('OpenStreetMap');

    const old = manager.getLayer();
    manager.set('carto-dark');
    expect(manager.get()).toBe('carto-dark');
    expect(map.hasLayer(old)).toBe(false);
    expect(map.hasLayer(manager.getLayer())).toBe(true);
    const attribution = container.querySelector('.sweety-control-attribution').innerHTML;
    expect(attribution.match(/OpenStreetMap contributors/g)).toHaveLength(1);
    expect(attribution).toContain('CARTO');
  });

  it('сохраняет zIndex при смене подложки', () => {
    const { manager } = createHarness();
    manager.set('osm', { zIndex: 7 });
    expect(manager.getLayer().options.zIndex).toBe(7);
    manager.set('carto-dark');
    expect(manager.getLayer().options.zIndex).toBe(7);
  });

  it('повторный set того же id — no-op', () => {
    const { manager } = createHarness();
    manager.set('osm');
    const layer = manager.getLayer();
    expect(manager.set('osm')).toBe(true);
    expect(manager.getLayer()).toBe(layer);
  });

  it('умеет добавлять дополнительные подложки', () => {
    const { map, manager } = createHarness();
    manager.set('osm');
    const extra = manager.add('carto-dark');
    expect(manager.get()).toBe('osm');
    expect(map.hasLayer(extra)).toBe(true);
    expect(map.hasLayer(manager.getLayer())).toBe(true);
    expect(manager.remove('carto-dark')).toBe(true);
    expect(manager.get()).toBe('osm');
  });

  it('remove активной оставляет карту без тайлов и fire basemapchange null', () => {
    const { map, manager } = createHarness();
    manager.set('osm');
    const layer = manager.getLayer();
    const changes = [];
    manager.on('basemapchange', (event) => changes.push(event));
    manager.remove('osm');
    expect(manager.get()).toBeNull();
    expect(map.hasLayer(layer)).toBe(false);
    expect(changes.at(-1)).toMatchObject({ id: null, previousId: 'osm' });
  });

  it('multiple: true сохраняет обе подложки', () => {
    const { map, manager } = createHarness({ multiple: true });
    manager.set('osm');
    manager.set('carto-dark');
    expect(manager.get()).toBe('carto-dark');
    expect(map.getLayers().filter((layer) => layer instanceof TileLayer)).toHaveLength(2);
  });

  it('переключает вариант и retina активной подложки', () => {
    const { manager } = createHarness();
    manager.options.keys.mapbox = 'pk.test-12345678';
    manager.set('mapbox');
    expect(manager.getLayer().getBasemapVariant()).toBe('streets');
    manager.setVariant('dark');
    expect(manager.getLayer().getBasemapVariant()).toBe('dark');
    manager.setVariant('retina');
    expect(manager.getLayer().getResolved().retina).toBe(true);
  });

  it('независимые менеджеры на разных картах', () => {
    const first = createHarness();
    const second = createHarness();
    first.manager.set('osm');
    second.manager.set('carto-dark');
    expect(first.manager.get()).toBe('osm');
    expect(second.manager.get()).toBe('carto-dark');
    expect(first.map.basemaps).toBe(first.manager);
    expect(second.map.basemaps).toBe(second.manager);
  });
});

describe('BasemapsManager: ошибки и fallback', () => {
  it('несуществующий id даёт basemaperror и не ломает карту', () => {
    const { manager } = createHarness();
    manager.set('osm');
    const errors = [];
    manager.on('basemaperror', (event) => errors.push(event));
    expect(() => manager.set('missing')).toThrow(/Unknown basemap/);
    expect(manager.get()).toBe('osm');
    expect(errors.at(-1)).toMatchObject({ id: 'missing', code: 'unknown-provider' });
  });

  it('без ключа откатывается на предыдущую подложку', () => {
    const { manager } = createHarness();
    manager.set('osm');
    const errors = [];
    manager.on('basemaperror', (event) => errors.push(event));
    expect(() => manager.set('mapbox')).toThrow(/requires an API key/);
    expect(manager.get()).toBe('osm');
    expect(errors.at(-1).code).toBe('missing-key');
  });

  it('fallback после серии tileerror', () => {
    const { manager } = createHarness({ fallback: 'osm', maxTileErrors: 2 });
    manager.set('carto-dark');
    const stale = manager.getLayer();
    stale.fire('tileerror', { url: 'https://example/tile.png' });
    stale.fire('tileerror', { url: 'https://example/tile.png' });
    expect(manager.get()).toBe('osm');
    expect(manager.getLayer().getBasemapId()).toBe('osm');
  });

  it('показывает projection warning, но не падает', () => {
    const { manager, map } = createHarness();
    const warnings = [];
    manager.on('basemaperror', (event) => warnings.push(event));
    manager.set('yandex');
    expect(manager.get()).toBe('yandex');
    expect(warnings.at(-1)).toMatchObject({ code: 'projection-warning', warning: true });
    expect(map.options.crs.code).toBe('EPSG:3857');
  });

  it('не отправляет tileerror-спам на каждый тайл', () => {
    const { manager } = createHarness();
    manager.set('osm');
    const errors = [];
    manager.on('basemaperror', (event) => errors.push(event));
    const layer = manager.getLayer();
    for (let index = 0; index < 5; index += 1) layer.fire('tileerror', { url: 'x' });
    expect(errors).toHaveLength(1);
  });
});

describe('BasemapsManager: persistence и destroy', () => {
  it('сохраняет и восстанавливает активную подложку', () => {
    const first = createHarness({ persist: true });
    first.manager.set('carto-dark');
    const stored = JSON.parse(localStorage.getItem('basemap'));
    expect(stored).toMatchObject({ id: 'carto-dark' });
    first.manager.destroy();
    first.map.remove();
    harnesses.length = 0;

    const { map } = createMap();
    const restored = basemaps.install(map, { persist: true });
    expect(restored.get()).toBe('carto-dark');
    restored.destroy();
    map.remove();
  });

  it('destroy удаляет слои, менеджер и map.basemaps', () => {
    const { map, manager } = createHarness();
    manager.set('osm');
    const layer = manager.getLayer();
    manager.destroy();
    expect(map.hasLayer(layer)).toBe(false);
    expect(map.basemaps).toBeUndefined();
    expect(() => manager.destroy()).not.toThrow();
  });
});

describe('Сценарии A–D', () => {
  it('A: basemaps.install(map).set(...) одной строкой', () => {
    const { map } = createMap();
    const manager = basemaps.install(map);
    manager.set('osm');
    expect(map.basemaps.get()).toBe('osm');
    manager.destroy();
    map.remove();
  });

  it('B: createBasemap без менеджера', () => {
    const { map } = createMap();
    const layer = createBasemap('osm');
    layer.addTo(map);
    expect(map.hasLayer(layer)).toBe(true);
    expect(layer.getBasemapId()).toBe('osm');
    layer.remove();
    map.remove();
  });

  it('C: контрол сам создаёт менеджер и переключает подложку', () => {
    const { map, container } = createMap();
    const control = new BasemapControl({
      providers: ['osm', 'carto-dark'],
      preview: true,
      previewCoords: { x: 1, y: 1, z: 1 },
      labels: { osm: 'Улицы', 'carto-dark': 'Тёмная' },
      i18n: { title: 'Слои', close: 'Закрыть' },
    }).addTo(map);
    expect(container.querySelectorAll('.map-basemaps-item')).toHaveLength(2);
    expect(container.querySelector('.map-basemaps-title').textContent).toBe('Слои');
    expect(container.querySelector('[data-id="osm"] .map-basemaps-item-name').textContent).toBe(
      'Улицы',
    );
    control.open();
    expect(container.querySelector('.map-basemaps-panel').hidden).toBe(false);
    expect(container.querySelector('.map-basemaps-thumb img').getAttribute('src')).toContain(
      '/1/1/1.png',
    );
    container.querySelector('.map-basemaps-close').click();
    expect(container.querySelector('.map-basemaps-panel').hidden).toBe(true);
    control.open();
    const search = container.querySelector('.map-basemaps-search-input');
    search.value = 'тёмн';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(container.querySelector('[data-id="osm"]').hidden).toBe(true);
    expect(container.querySelector('[data-id="carto-dark"]').hidden).toBe(false);
    const item = container.querySelector('[data-id="carto-dark"]');
    item.click();
    expect(map.basemaps.get()).toBe('carto-dark');
    expect(container.querySelector('.map-basemaps-toggle-label').textContent).toBe('Тёмная');
    control.remove();
    map.basemaps.destroy();
    map.remove();
  });

  it('D: basemap в опциях Map через init hook', () => {
    const { map } = createMap({ basemap: 'osm' });
    expect(map.basemaps.get()).toBe('osm');
    expect(map.hasLayer(map.basemaps.getLayer())).toBe(true);
    map.basemaps.destroy();
    map.remove();
  });

  it('ввод ключа в контроле для Mapbox', () => {
    const { map, container } = createMap();
    const control = new BasemapControl({ providers: ['mapbox'] }).addTo(map);
    control.open();
    container.querySelector('[data-id="mapbox"]').click();
    const form = container.querySelector('.map-basemaps-key');
    expect(form.hidden).toBe(false);
    const input = form.querySelector('input');
    input.value = 'pk.test-12345678';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(map.basemaps.get()).toBe('mapbox');
    expect(localStorage.getItem('basemap')).toBeNull();
    control.remove();
    map.basemaps.destroy();
    map.remove();
  });
});
