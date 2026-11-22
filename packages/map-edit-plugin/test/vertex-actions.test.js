import { afterEach, describe, expect, it } from 'vitest';
import { Map, Polygon } from 'sweety-map';
import { EditPlugin } from '../src/EditPlugin.js';

/** @type {Array<{plugin: EditPlugin, map: Map, container: HTMLElement}>} */
const harnesses = [];

function createHarness(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mockElementSize(container, 800, 600);
  const map = new Map(container, {
    center: [0, 0],
    zoom: 2,
    zoomControl: false,
    attributionControl: false,
    zoomAnimation: false,
    fadeAnimation: false,
    doubleClickZoom: false,
  });
  const plugin = new EditPlugin(map, { keyboard: false, ...options });
  const harness = { plugin, map, container };
  harnesses.push(harness);
  return harness;
}

/** Полигон из `[lat, lng]`-пар. */
function polygonOf(points, options = {}) {
  return new Polygon([points.map(([lat, lng]) => [lat, lng])], options);
}

/** Вершины первого кольца в формате `[lat, lng]`. */
function ring(layer) {
  return layer.getLatLngs()[0].map((latlng) => [latlng.lat, latlng.lng]);
}

function event(target, type, extra = {}) {
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 10, ...extra }),
  );
}

/** Узлы вершин в порядке отрисовки: `part:index` → элемент. */
function vertexNodes(container) {
  return [...container.querySelectorAll('.map-edit-handle-vertex')];
}

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    if (!harness.plugin._destroyed) harness.plugin.destroy();
    harness.map.remove();
  }
});

describe('Удаление вершин: способы и настройки', () => {
  it('по умолчанию удаляет правым кликом, а обычный клик ничего не меняет', () => {
    const { plugin, map, container } = createHarness();
    const polygon = polygonOf([
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
    ]).addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);

    const [node] = vertexNodes(container);
    event(node, 'click');
    expect(polygon.getLatLngs()[0]).toHaveLength(4);

    event(node, 'contextmenu');
    expect(polygon.getLatLngs()[0]).toHaveLength(3);
    plugin.undo();
    expect(polygon.getLatLngs()[0]).toHaveLength(4);
  });

  it('удаляет кликом при removeVertexOn: "click" и не удаляет после перетаскивания', async () => {
    const { plugin, map, container } = createHarness({ removeVertexOn: 'click' });
    const polygon = polygonOf([
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
    ]).addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);

    const [node] = vertexNodes(container);
    event(node, 'click');
    expect(polygon.getLatLngs()[0]).toHaveLength(3);
    plugin.undo();
    expect(polygon.getLatLngs()[0]).toHaveLength(4);
  });

  it('removeVertexOn: "none" отключает правый клик, но Ctrl+клик работает', () => {
    const { plugin, map, container } = createHarness({ removeVertexOn: 'none' });
    const polygon = polygonOf([
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
    ]).addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);

    const [node] = vertexNodes(container);
    event(node, 'contextmenu');
    expect(polygon.getLatLngs()[0]).toHaveLength(4);

    event(node, 'click', { ctrlKey: true });
    expect(polygon.getLatLngs()[0]).toHaveLength(3);
  });

  it('при нехватке вершин убирает объект, а с removeLayerBelowMinVertexCount: false — нет', () => {
    const guarded = createHarness({ removeLayerBelowMinVertexCount: false });
    const guardedPolygon = polygonOf([
      [0, 0],
      [0, 10],
      [10, 10],
    ]).addTo(guarded.map);
    guarded.plugin.enableEdit(guardedPolygon);
    guarded.plugin.setMode('edit');
    guarded.plugin.selectLayer(guardedPolygon);

    const limits = [];
    guarded.plugin.on('vertexlimit', (event) => limits.push(event));
    event(vertexNodes(guarded.container)[0], 'contextmenu');
    expect(guardedPolygon.getLatLngs()[0]).toHaveLength(3);
    expect(limits).toHaveLength(1);

    const { plugin, map } = createHarness();
    const polygon = polygonOf([
      [0, 0],
      [0, 10],
      [10, 10],
    ]).addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);
    event(vertexNodes(containerOf(plugin))[0], 'contextmenu');
    expect(map.hasLayer(polygon)).toBe(false);

    plugin.undo();
    expect(map.hasLayer(polygon)).toBe(true);
    expect(polygon.getLatLngs()[0]).toHaveLength(3);
  });

  it('удаляет отверстие целиком, не трогая сам полигон', () => {
    const { plugin, map, container } = createHarness();
    const polygon = new Polygon([
      [
        [0, 0],
        [0, 20],
        [20, 20],
        [20, 0],
      ],
      [
        [5, 5],
        [5, 10],
        [10, 10],
      ],
    ]).addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);
    expect(polygon.getLatLngs()).toHaveLength(2);

    // Вершины отверстия идут после вершин внешнего кольца.
    const nodes = [...container.querySelectorAll('.map-edit-handle-vertex')];
    event(nodes[4], 'contextmenu');
    expect(polygon.getLatLngs()).toHaveLength(1);
    expect(map.hasLayer(polygon)).toBe(true);

    plugin.undo();
    expect(polygon.getLatLngs()).toHaveLength(2);
  });

  it('toggleEdit включает и выключает редактирование', () => {
    const { plugin, map } = createHarness();
    const polygon = polygonOf([
      [0, 0],
      [0, 10],
      [10, 10],
    ]).addTo(map);
    expect(plugin.toggleEdit(polygon)).toBe(true);
    expect(plugin.isEditable(polygon)).toBe(true);
    expect(plugin.toggleEdit(polygon)).toBe(false);
    expect(plugin.isEditable(polygon)).toBe(false);
  });

  it('hideMiddleMarkers убирает середины сегментов', () => {
    const { plugin, map, container } = createHarness({ hideMiddleMarkers: true });
    const polygon = polygonOf([
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
    ]).addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);
    expect(container.querySelectorAll('.map-edit-handle-midpoint')).toHaveLength(0);
    expect(container.querySelectorAll('.map-edit-handle-vertex')).toHaveLength(4);
    expect(ring(polygon)).toHaveLength(4);
  });
});

/** Контейнер карты по плагину — для проверок в другом harness. */
function containerOf(plugin) {
  return plugin.map.getContainer();
}
