import { afterEach, describe, expect, it } from 'vitest';
import { Map, Polygon, Polyline } from 'sweety-map';
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

/**
 * Прямоугольник по координатам в формате `[lat, lng]`.
 * @returns {Polygon}
 */
function box(west, south, east, north, options = {}) {
  return new Polygon(
    [
      [
        [south, west],
        [south, east],
        [north, east],
        [north, west],
      ],
    ],
    options,
  );
}

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    if (!harness.plugin._destroyed) harness.plugin.destroy();
    harness.map.remove();
  }
});

describe('EditPlugin: мультиобъекты', () => {
  it('объединяет полигоны в один и разъединяет его обратно', () => {
    const { plugin, map } = createHarness();
    const left = box(0, 0, 10, 10).addTo(map);
    const right = box(20, 0, 30, 10).addTo(map);
    plugin.selectLayer(left);
    plugin.selectLayer(right, true);

    expect(plugin.canMerge()).toBe(true);
    expect(plugin.canUnion()).toBe(true);

    const merged = plugin.mergeSelected();
    expect(merged).toBeTruthy();
    expect(map.hasLayer(left)).toBe(false);
    expect(map.hasLayer(right)).toBe(false);
    expect(map.hasLayer(merged)).toBe(true);
    expect(plugin.isEditable(merged)).toBe(true);
    expect(merged.getLatLngs()).toHaveLength(2);

    // Несвязанные контуры экспортируются как MultiPolygon, а не как дырки.
    const json = merged.toGeoJSON();
    expect(json.geometry.type).toBe('MultiPolygon');
    expect(json.geometry.coordinates).toHaveLength(2);

    plugin.undo();
    expect(map.hasLayer(left)).toBe(true);
    expect(map.hasLayer(right)).toBe(true);
    expect(map.hasLayer(merged)).toBe(false);

    plugin.redo();
    expect(map.hasLayer(merged)).toBe(true);
  });

  it('не объединяет полигон с полилинией', () => {
    const { plugin, map } = createHarness();
    const polygon = box(0, 0, 10, 10).addTo(map);
    const line = new Polyline([
      [
        [20, 20],
        [21, 21],
        [22, 22],
      ],
    ]).addTo(map);
    plugin.selectLayer(polygon);
    plugin.selectLayer(line, true);

    expect(plugin.canMerge()).toBe(false);
    const events = [];
    plugin.on('merge:invalid', (event) => events.push(event));
    expect(plugin.mergeSelected()).toBeNull();
    expect(events.at(-1)?.reason).toBe('selection');
  });

  it('разъединяет мультиобъект на отдельные полигоны', () => {
    const { plugin, map } = createHarness();
    const merged = new Polygon([
      [
        [0, 0],
        [0, 10],
        [10, 10],
        [10, 0],
      ],
      [
        [20, 20],
        [20, 30],
        [30, 30],
        [30, 20],
      ],
    ]).addTo(map);
    plugin.enableEdit(merged);
    plugin.selectLayer(merged);

    expect(plugin.canExplode()).toBe(true);
    const parts = plugin.explodeLayer(merged);
    expect(parts).toHaveLength(2);
    expect(map.hasLayer(merged)).toBe(false);
    for (const part of parts) {
      expect(map.hasLayer(part)).toBe(true);
      expect(part.getLatLngs()).toHaveLength(1);
    }

    plugin.undo();
    expect(map.hasLayer(merged)).toBe(true);
    for (const part of parts) expect(map.hasLayer(part)).toBe(false);
  });
});

describe('EditPlugin: отверстия', () => {
  it('добавляет и убирает отверстие, сохраняя GeoJSON-полигон', () => {
    const { plugin, map } = createHarness();
    const polygon = box(0, 0, 20, 20).addTo(map);
    plugin.enableEdit(polygon);
    plugin.selectLayer(polygon);

    const events = [];
    plugin.on('hole:added', (event) => events.push(event));

    const hole = [
      [5, 5],
      [5, 10],
      [10, 10],
      [10, 5],
    ];
    expect(plugin.canAddHole()).toBe(true);
    expect(plugin.addHole(polygon, hole)).toBe(true);
    expect(polygon.getLatLngs()).toHaveLength(2);
    expect(events.at(-1)?.holes).toBe(1);

    const json = polygon.toGeoJSON();
    expect(json.geometry.type).toBe('Polygon');
    expect(json.geometry.coordinates).toHaveLength(2);

    expect(plugin.removeHole(polygon, 1)).toBe(true);
    expect(polygon.getLatLngs()).toHaveLength(1);

    plugin.undo();
    expect(polygon.getLatLngs()).toHaveLength(2);
    plugin.undo();
    expect(polygon.getLatLngs()).toHaveLength(1);
  });

  it('отклоняет отверстие вне полигона и сообщает причину', () => {
    const { plugin, map } = createHarness();
    const polygon = box(0, 0, 10, 10).addTo(map);
    plugin.enableEdit(polygon);
    const events = [];
    plugin.on('hole:invalid', (event) => events.push(event));

    const outside = [
      [20, 20],
      [20, 25],
      [25, 25],
      [25, 20],
    ];
    expect(plugin.addHole(polygon, outside)).toBe(false);
    expect(polygon.getLatLngs()).toHaveLength(1);
    expect(events.at(-1)?.reason).toBe('outside');
  });

  it('запускает рисование отверстия только для одного выбранного полигона', () => {
    const { plugin, map } = createHarness();
    const polygon = box(0, 0, 10, 10).addTo(map);
    plugin.selectLayer(polygon);

    const handler = plugin.startHole();
    expect(handler).toBeTruthy();
    expect(handler.intent).toBe('hole');
    expect(plugin.getDrawType()).toBe('polygon');
    plugin.cancelDrawing();

    plugin.clearSelection();
    expect(plugin.startHole()).toBeNull();
  });
});

describe('EditPlugin: разрезание', () => {
  it('делит полигон на две части и откатывает разрез', () => {
    const { plugin, map } = createHarness();
    const polygon = box(0, 0, 10, 10).addTo(map);
    plugin.enableEdit(polygon);
    plugin.selectLayer(polygon);

    expect(plugin.canCut()).toBe(true);
    const created = plugin.cutLayers(
      [polygon],
      [
        [0, 5],
        [10, 5],
      ],
    );
    expect(created).toHaveLength(2);
    expect(map.hasLayer(polygon)).toBe(false);
    for (const part of created) {
      expect(map.hasLayer(part)).toBe(true);
      expect(part.getLatLngs()).toHaveLength(1);
    }

    plugin.undo();
    expect(map.hasLayer(polygon)).toBe(true);
    for (const part of created) expect(map.hasLayer(part)).toBe(false);
  });

  it('не трогает объекты, которые разрез не задел', () => {
    const { plugin, map } = createHarness();
    const polygon = box(0, 0, 10, 10).addTo(map);
    const events = [];
    plugin.on('cut:invalid', (event) => events.push(event));

    expect(
      plugin.cutLayers(
        [polygon],
        [
          [20, 20],
          [21, 21],
        ],
      ),
    ).toEqual([]);
    expect(map.hasLayer(polygon)).toBe(true);
    expect(events.at(-1)?.reason).toBe('crossings');
  });

  it('делит полигон на равные половины', () => {
    const { plugin, map } = createHarness();
    const polygon = box(0, 0, 10, 10).addTo(map);
    const created = plugin.cutLayers(
      [polygon],
      [
        [5, 0],
        [5, 10],
      ],
    );
    expect(created).toHaveLength(2);
    const areas = created.map((part) => {
      const ring = part.getLatLngs()[0];
      let sum = 0;
      for (let index = 0; index < ring.length; index += 1) {
        const current = ring[index];
        const next = ring[(index + 1) % ring.length];
        sum += current.lng * next.lat - next.lng * current.lat;
      }
      return Math.abs(sum / 2);
    });
    expect(areas[0]).toBeCloseTo(50, 6);
    expect(areas[1]).toBeCloseTo(50, 6);
  });

  it('разрезает полилинию на несколько частей', () => {
    const { plugin, map } = createHarness();
    const line = new Polyline([
      [
        [0, 0],
        [0, 10],
      ],
    ]).addTo(map);
    plugin.enableEdit(line);
    plugin.selectLayer(line);

    const created = plugin.cutLayers(
      [line],
      [
        [0, 4],
        [10, 4],
      ],
    );
    expect(created).toHaveLength(2);
    expect(map.hasLayer(line)).toBe(false);
    const totals = created.map((part) => part.getLatLngs().length);
    expect(totals).toEqual([1, 1]);
    const lengths = created.map((part) => part.getLatLngs()[0].length);
    expect(lengths.every((count) => count >= 2)).toBe(true);
  });

  it('запускает режим черчения секущей', () => {
    const { plugin, map } = createHarness();
    const polygon = box(0, 0, 10, 10).addTo(map);
    plugin.selectLayer(polygon);

    const handler = plugin.startCut();
    expect(handler).toBeTruthy();
    expect(handler.intent).toBe('cut');
    expect(plugin.getDrawType()).toBe('polyline');
    plugin.cancelDrawing();

    plugin.clearSelection();
    expect(plugin.startCut()).toBeNull();
  });
});

describe('EditPlugin: объединение по общим границам', () => {
  it('убирает общую границу двух смежных полигонов', () => {
    const { plugin, map } = createHarness();
    const left = box(0, 0, 10, 10).addTo(map);
    const right = box(10, 0, 20, 10).addTo(map);
    plugin.selectLayer(left);
    plugin.selectLayer(right, true);

    const union = plugin.unionSelected();
    expect(union).toBeTruthy();
    expect(map.hasLayer(left)).toBe(false);
    expect(map.hasLayer(right)).toBe(false);
    expect(union.getLatLngs()).toHaveLength(1);

    const ring = union.getLatLngs()[0];
    const lngs = ring.map((latlng) => Math.round(latlng.lng));
    expect(Math.min(...lngs)).toBe(0);
    expect(Math.max(...lngs)).toBe(20);

    plugin.undo();
    expect(map.hasLayer(left)).toBe(true);
    expect(map.hasLayer(right)).toBe(true);
  });

  it('сохраняет отверстие и сообщает о наложении', () => {
    const { plugin, map } = createHarness();
    const outer = box(0, 0, 20, 20).addTo(map);
    const inner = new Polygon([
      [
        [5, 5],
        [5, 10],
        [10, 10],
        [10, 5],
      ],
    ]).addTo(map);
    plugin.addHole(outer, inner.getLatLngs()[0]);

    const neighbor = box(20, 0, 30, 20).addTo(map);
    plugin.selectLayer(outer);
    plugin.selectLayer(neighbor, true);
    const union = plugin.unionSelected();
    expect(union).toBeTruthy();
    expect(union.getLatLngs()).toHaveLength(2);

    const overlapping = createHarness();
    const first = box(0, 0, 10, 10).addTo(overlapping.map);
    const second = box(5, 5, 15, 15).addTo(overlapping.map);
    overlapping.plugin.selectLayer(first);
    overlapping.plugin.selectLayer(second, true);
    const events = [];
    overlapping.plugin.on('union:invalid', (event) => events.push(event));
    expect(overlapping.plugin.unionSelected()).toBeNull();
    expect(events.at(-1)?.reason).toBe('overlap');
  });
});

describe('EditPlugin: кнопки операций', () => {
  it('показывает операции в панели и включает их по выбору', () => {
    const { plugin, container, map } = createHarness();
    const actions = [...container.querySelectorAll('button[data-action]')].map(
      (button) => button.dataset.action,
    );
    for (const action of ['merge', 'union', 'explode', 'hole', 'cut']) {
      expect(actions).toContain(action);
    }

    const button = (action) => container.querySelector(`button[data-action="${action}"]`);
    expect(button('merge').disabled).toBe(true);
    expect(button('union').disabled).toBe(true);
    expect(button('cut').disabled).toBe(true);

    const left = box(0, 0, 10, 10).addTo(map);
    const right = box(10, 0, 20, 10).addTo(map);
    plugin.selectLayer(left);
    plugin.selectLayer(right, true);
    expect(button('merge').disabled).toBe(false);
    expect(button('union').disabled).toBe(false);
    expect(button('cut').disabled).toBe(false);

    button('merge').click();
    expect(plugin.getSelected()).toHaveLength(1);
  });
});
