import { afterEach, describe, expect, it } from 'vitest';
import {
  Bounds,
  Circle,
  FeatureGroup,
  GeoJSONLayer,
  LatLng,
  Map,
  Marker,
  Polygon,
  Rectangle,
} from 'sweety-map';
import { EditPlugin } from '../src/EditPlugin.js';

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

function square() {
  return new Polygon([
    [
      [-20, -20],
      [-20, 20],
      [20, 20],
      [20, -20],
    ],
  ]);
}

function pointer(target, type, point, extra = {}) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
      button: 0,
      ...extra,
    }),
  );
}

function centerOf(node) {
  return { x: Number(node.getAttribute('cx')), y: Number(node.getAttribute('cy')) };
}

const frame = () => new Promise((resolve) => setTimeout(resolve, 40));

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    if (!harness.plugin._destroyed) harness.plugin.destroy();
    harness.map.remove();
  }
});

describe('Жесты: тело геометрии', () => {
  it('перетаскивает весь полигон и откатывает перемещение', async () => {
    const { plugin, map } = createHarness();
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);

    const before = polygon.getLatLngs()[0][0].lng;
    const start = map.latLngToContainerPoint([0, 0]);
    pointer(polygon._path, 'pointerdown', start);
    pointer(document, 'pointermove', { x: start.x + 50, y: start.y });
    await frame();
    pointer(document, 'pointerup', { x: start.x + 50, y: start.y });

    expect(polygon.getLatLngs()[0][0].lng).toBeGreaterThan(before);
    expect(plugin.canUndo()).toBe(true);
    plugin.undo();
    expect(polygon.getLatLngs()[0][0].lng).toBeCloseTo(before, 9);
  });

  it('перетаскивает маркер за тело', async () => {
    const { plugin, map } = createHarness();
    const marker = new Marker([0, 0]).addTo(map);
    plugin.enableEdit(marker);
    plugin.setMode('edit');
    plugin.selectLayer(marker);
    const before = marker.getLatLng().lng;
    const start = map.latLngToContainerPoint([0, 0]);
    const element = marker.getElement();
    pointer(element, 'pointerdown', start);
    pointer(document, 'pointermove', { x: start.x + 40, y: start.y });
    await frame();
    pointer(document, 'pointerup', { x: start.x + 40, y: start.y });
    expect(marker.getLatLng().lng).not.toBeCloseTo(before, 9);
    plugin.undo();
    expect(marker.getLatLng().lng).toBeCloseTo(before, 9);
  });

  it('перетаскивает круг и меняет радиус', async () => {
    const { plugin, map, container } = createHarness();
    const circle = new Circle([0, 0], 50000).addTo(map);
    plugin.enableEdit(circle);
    plugin.setMode('edit');
    plugin.selectLayer(circle);

    const radiusHandle = container.querySelector('.map-edit-handle-radius');
    const point = centerOf(radiusHandle);
    pointer(radiusHandle, 'pointerdown', point);
    pointer(document, 'pointermove', { x: point.x + 30, y: point.y });
    await frame();
    pointer(document, 'pointerup', { x: point.x + 30, y: point.y });
    expect(circle.getRadius()).toBeGreaterThan(50000);
    plugin.undo();
    expect(circle.getRadius()).toBeCloseTo(50000, 3);
  });

  it('перетаскивает угол прямоугольника и меняет bounds', async () => {
    const { plugin, map, container } = createHarness();
    const rectangle = new Rectangle(
      new Bounds([
        [-20, -20],
        [20, 20],
      ]),
    ).addTo(map);
    plugin.enableEdit(rectangle);
    plugin.setMode('edit');
    plugin.selectLayer(rectangle);
    const corners = container.querySelectorAll('.map-edit-handle-corner');
    expect(corners).toHaveLength(4);

    const point = centerOf(corners[0]);
    pointer(corners[0], 'pointerdown', point);
    pointer(document, 'pointermove', { x: point.x - 30, y: point.y - 30 });
    await frame();
    pointer(document, 'pointerup', { x: point.x - 30, y: point.y - 30 });
    expect(rectangle.getBounds().getWest()).toBeLessThan(-20);
    plugin.undo();
    expect(rectangle.getBounds().getWest()).toBeCloseTo(-20, 6);
  });

  it('двигает все части GeoJSON-группы одной командой', async () => {
    const { plugin, map } = createHarness();
    const group = new GeoJSONLayer({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-30, -30],
              [-30, -20],
              [-20, -20],
              [-20, -30],
              [-30, -30],
            ],
          ],
          [
            [
              [20, 20],
              [20, 30],
              [30, 30],
              [30, 20],
              [20, 20],
            ],
          ],
        ],
      },
    }).addTo(map);
    plugin.enableEdit(group);
    plugin.setMode('edit');
    plugin.selectLayer(group);
    const parts = [];
    group.eachLayer((child) => {
      if (typeof child.eachLayer === 'function') child.eachLayer((leaf) => parts.push(leaf));
      else parts.push(child);
    });
    const beforeFirst = parts[0].getLatLngs()[0][0].lng;
    const beforeSecond = parts[1].getLatLngs()[0][0].lng;
    const start = map.latLngToContainerPoint([-25, -25]);

    pointer(parts[0]._path, 'pointerdown', start);
    pointer(document, 'pointermove', { x: start.x + 40, y: start.y });
    await frame();
    pointer(document, 'pointerup', { x: start.x + 40, y: start.y });

    expect(parts[0].getLatLngs()[0][0].lng).toBeGreaterThan(beforeFirst);
    expect(parts[1].getLatLngs()[0][0].lng).toBeGreaterThan(beforeSecond);
    plugin.undo();
    expect(parts[0].getLatLngs()[0][0].lng).toBeCloseTo(beforeFirst, 9);
    expect(parts[1].getLatLngs()[0][0].lng).toBeCloseTo(beforeSecond, 9);
  });
});

describe('Жесты: midpoint', () => {
  it('вставляет вершину кликом по середине и позволяет её перетащить', async () => {
    const { plugin, map, container } = createHarness();
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);
    const midpoint = container.querySelector('.map-edit-handle-midpoint');
    const point = centerOf(midpoint);
    pointer(midpoint, 'pointerdown', point);
    pointer(document, 'pointermove', { x: point.x + 20, y: point.y + 20 });
    await frame();
    pointer(document, 'pointerup', { x: point.x + 20, y: point.y + 20 });

    expect(polygon.getLatLngs()[0]).toHaveLength(5);
    expect(plugin.canUndo()).toBe(true);
    plugin.undo();
    expect(polygon.getLatLngs()[0]).toHaveLength(4);
  });

  it('вставка одной вершины работает без движения', async () => {
    const { plugin, map, container } = createHarness();
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);
    const midpoint = container.querySelector('.map-edit-handle-midpoint');
    const point = centerOf(midpoint);
    pointer(midpoint, 'pointerdown', point);
    pointer(document, 'pointerup', point);
    expect(polygon.getLatLngs()[0]).toHaveLength(5);
    plugin.undo();
    expect(polygon.getLatLngs()[0]).toHaveLength(4);
  });
});

describe('Жесты: вид и handles', () => {
  it('пересчитывает handles после зума', async () => {
    const { plugin, map, container } = createHarness();
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);
    const handle = container.querySelector('.map-edit-handle-vertex');
    const before = centerOf(handle);
    map.setZoom(4);
    await frame();
    const after = centerOf(handle);
    expect(after.x).not.toBe(before.x);
    const expected = map.latLngToContainerPoint(polygon.getLatLngs()[0][0]);
    expect(after.x).toBeCloseTo(expected.x, 0);
  });

  it('прореживает handles для больших полигонов', () => {
    const { plugin, map, container } = createHarness({ maxHandles: 20, midpoints: false });
    const ring = [];
    for (let index = 0; index < 200; index += 1) {
      const angle = (index / 200) * Math.PI * 2;
      ring.push([Math.sin(angle) * 20, Math.cos(angle) * 20]);
    }
    const polygon = new Polygon([ring]).addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);
    const handles = container.querySelectorAll('.map-edit-handle-vertex');
    expect(handles.length).toBeLessThanOrEqual(25);
    expect(handles.length).toBeGreaterThan(5);
  });

  it('не создаёт handles в режиме select', () => {
    const { plugin, map, container } = createHarness();
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.selectLayer(polygon);
    expect(container.querySelectorAll('.map-edit-handle').length).toBe(0);
  });
});

describe('Выбор и приоритет', () => {
  it('выбирает верхний из перекрывающихся объектов', () => {
    const { plugin, map } = createHarness();
    const bottom = square().addTo(map);
    const top = square().addTo(map);
    plugin.setMode('select');
    const point = map.latLngToContainerPoint([0, 0]);
    map.fire('click', { latlng: new LatLng(0, 0), containerPoint: point });
    expect(plugin.getSelected()).toEqual([top]);
    expect(bottom._path.classList.contains('map-edit-selected')).toBe(false);
  });

  it('добавляет и снимает выбор через Shift', () => {
    const { plugin, map } = createHarness();
    const first = square().addTo(map);
    const second = new Polygon([
      [
        [30, 30],
        [30, 50],
        [50, 50],
      ],
    ]).addTo(map);
    plugin.setMode('select');
    plugin.selectLayer(first);
    plugin.toggleSelection(second);
    expect(plugin.getSelected()).toHaveLength(2);
    plugin.toggleSelection(second);
    expect(plugin.getSelected()).toEqual([first]);
  });
});

describe('Рисование: дополнительные сценарии', () => {
  it('рисует маркер одним кликом', () => {
    const { plugin, map } = createHarness();
    const created = [];
    plugin.on('create', (event) => created.push(event.layer));
    plugin.startDrawing('marker');
    const latlng = new LatLng([10, 20]);
    map.fire('click', { latlng, containerPoint: map.latLngToContainerPoint(latlng) });
    expect(created).toHaveLength(1);
    expect(created[0]).toBeInstanceOf(Marker);
    expect(map.hasLayer(created[0])).toBe(true);
    expect(plugin.isDrawing()).toBe(false);
  });

  it('завершает полигон кликом по первой вершине', () => {
    const { plugin, map } = createHarness();
    const created = [];
    plugin.on('create', (event) => created.push(event.layer));
    plugin.startDrawing('polygon');
    const coordinates = [
      [-20, -20],
      [-20, 20],
      [20, 20],
    ];
    for (const coordinate of coordinates) {
      const latlng = new LatLng(coordinate);
      map.fire('click', { latlng, containerPoint: map.latLngToContainerPoint(latlng) });
    }
    const first = new LatLng(coordinates[0]);
    map.fire('click', {
      latlng: first,
      containerPoint: map.latLngToContainerPoint(first),
    });
    expect(created).toHaveLength(1);
    expect(created[0].getLatLngs()[0]).toHaveLength(3);
  });

  it('рисует в указанную группу и выбирает её', () => {
    const { plugin, map } = createHarness();
    const group = new FeatureGroup().addTo(map);
    plugin.startDrawing('marker', { target: group });
    const latlng = new LatLng([5, 5]);
    map.fire('click', { latlng, containerPoint: map.latLngToContainerPoint(latlng) });
    expect(group.getLayers()).toHaveLength(1);
    expect(plugin.getSelected()).toEqual([group]);
    expect(plugin.isEditable(group)).toBe(true);
  });

  it('событие draw:vertexadded приходит на каждую вершину', () => {
    const { plugin, map } = createHarness();
    const vertices = [];
    plugin.on('draw:vertexadded', (event) => vertices.push(event.index));
    plugin.startDrawing('polyline');
    for (const coordinate of [
      [0, 0],
      [5, 5],
      [10, 0],
    ]) {
      const latlng = new LatLng(coordinate);
      map.fire('click', { latlng, containerPoint: map.latLngToContainerPoint(latlng) });
    }
    expect(vertices).toEqual([0, 1, 2]);
    plugin.cancelDrawing();
  });
});

describe('Удаление: подтверждение и клавиатура', () => {
  it('не удаляет слой, если confirmDelete вернул false', () => {
    const { plugin, map } = createHarness({ confirmDelete: () => false });
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.selectLayer(polygon);
    expect(plugin.deleteLayer(polygon)).toBe(false);
    expect(map.hasLayer(polygon)).toBe(true);
  });

  it('удаляет выбранное по Delete при включённой клавиатуре', () => {
    const { plugin, map } = createHarness({ keyboard: true });
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('select');
    plugin.selectLayer(polygon);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(map.hasLayer(polygon)).toBe(false);
  });

  it('откатывает перемещение по Ctrl+Z', async () => {
    const { plugin, map, container } = createHarness({ keyboard: true });
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);
    const before = polygon.getLatLngs()[0][0].lat;
    const handle = container.querySelector('.map-edit-handle-vertex');
    const point = centerOf(handle);
    pointer(handle, 'pointerdown', point);
    pointer(document, 'pointermove', { x: point.x, y: point.y + 40 });
    await frame();
    pointer(document, 'pointerup', { x: point.x, y: point.y + 40 });
    expect(polygon.getLatLngs()[0][0].lat).not.toBeCloseTo(before, 9);

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
    );
    expect(polygon.getLatLngs()[0][0].lat).toBeCloseTo(before, 9);
  });
});

describe('Устойчивость', () => {
  it('не падает, если слой удалили во время перетаскивания', async () => {
    const { plugin, map } = createHarness();
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);
    const start = map.latLngToContainerPoint([0, 0]);
    pointer(polygon._path, 'pointerdown', start);
    pointer(document, 'pointermove', { x: start.x + 20, y: start.y });
    await frame();
    map.removeLayer(polygon);
    expect(() => pointer(document, 'pointerup', { x: start.x + 20, y: start.y })).not.toThrow();
  });

  it('повторный destroy безопасен и снимает keyboard-обработчик', () => {
    const { plugin, map } = createHarness({ keyboard: true });
    plugin.destroy();
    expect(() => plugin.destroy()).not.toThrow();
    expect(map.editPlugin).toBeUndefined();
  });

  it('destroy во время активного рисования очищает ghost и toolbar', () => {
    const { plugin, container } = createHarness();
    plugin.startDrawing('circle');
    expect(container.querySelector('.map-edit-draw-toolbar')).toBeTruthy();
    plugin.destroy();
    expect(container.querySelector('.map-edit-draw-toolbar')).toBeFalsy();
    expect(container.querySelector('.map-edit-ghost')).toBeFalsy();
  });
});
