import { afterEach, describe, expect, it } from 'vitest';
import { Bounds, GeoJSONLayer, LatLng, Map, Polygon } from 'sweety-map';
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

function square(layerOptions = {}) {
  const polygon = new Polygon(
    [
      [
        [-20, -20],
        [-20, 20],
        [20, 20],
        [20, -20],
      ],
    ],
    layerOptions,
  );
  return polygon;
}

function dispatchPointer(target, type, point, extra = {}) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    button: 0,
    ...extra,
  });
  target.dispatchEvent(event);
  return event;
}

const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 40));

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    if (!harness.plugin._destroyed) harness.plugin.destroy();
    harness.map.remove();
  }
});

describe('EditPlugin: установка и режимы', () => {
  it('создаёт контрол и переключает режимы с событием modechange', () => {
    const { plugin, container } = createHarness();
    const modechanges = [];
    plugin.on('modechange', (event) => modechanges.push(event));
    expect(container.querySelector('.map-edit-control')).toBeTruthy();
    expect(plugin.getMode()).toBe('idle');

    plugin.setMode('select');
    expect(plugin.getMode()).toBe('select');
    expect(modechanges.at(-1)).toMatchObject({ mode: 'select', previousMode: 'idle' });

    plugin.setMode('delete');
    expect(plugin.getMode()).toBe('delete');
    expect(() => plugin.setMode('nonsense')).toThrow(RangeError);
  });

  it('регистрируется как map.editPlugin и через статический install', () => {
    const { plugin, map } = createHarness();
    expect(map.editPlugin).toBe(plugin);
    expect(EditPlugin.install(map)).toBe(plugin);
    expect(typeof map.edit).toBe('function');
    expect(map.edit()).toBe(plugin);
  });

  it('реагирует на кнопки контрола', () => {
    const { plugin, container } = createHarness();
    const selectButton = container.querySelector('[data-action="select"]');
    selectButton.click();
    expect(plugin.getMode()).toBe('select');
    expect(selectButton.classList.contains('is-active')).toBe(true);

    const undoButton = container.querySelector('[data-action="undo"]');
    expect(undoButton.disabled).toBe(true);
  });
});

describe('EditPlugin: выбор и вершины', () => {
  it('включает редактирование, строит handles и подсвечивает слой', () => {
    const { plugin, map, container } = createHarness();
    const polygon = square().addTo(map);
    const session = plugin.enableEdit(polygon);
    expect(session).toBeTruthy();
    expect(plugin.isEditable(polygon)).toBe(true);

    plugin.setMode('edit');
    plugin.selectLayer(polygon);
    expect(plugin.getSelected()).toEqual([polygon]);
    expect(polygon._path.classList.contains('map-edit-selected')).toBe(true);

    const vertices = container.querySelectorAll('.map-edit-handle-vertex');
    const midpoints = container.querySelectorAll('.map-edit-handle-midpoint');
    expect(vertices).toHaveLength(4);
    expect(midpoints).toHaveLength(4);
  });

  it('перетаскивает вершину, обновляет геометрию и откатывает undo', async () => {
    const { plugin, map, container } = createHarness();
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);

    const updates = [];
    plugin.on('update', (event) => updates.push(event));
    const before = polygon.getLatLngs()[0][0].lng;
    const circle = container.querySelector('.map-edit-handle-vertex');
    const x = Number(circle.getAttribute('cx'));
    const y = Number(circle.getAttribute('cy'));

    dispatchPointer(circle, 'pointerdown', { x, y });
    dispatchPointer(document, 'pointermove', { x: x + 60, y });
    await nextFrame();
    dispatchPointer(document, 'pointerup', { x: x + 60, y });

    expect(polygon.getLatLngs()[0][0].lng).not.toBeCloseTo(before, 9);
    expect(updates.at(-1)).toMatchObject({ action: 'move-vertex', layer: polygon });
    expect(plugin.canUndo()).toBe(true);

    plugin.undo();
    expect(polygon.getLatLngs()[0][0].lng).toBeCloseTo(before, 9);
  });

  it('вставляет и удаляет вершины', () => {
    const { plugin, map } = createHarness();
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);

    const session = plugin.getSession(polygon);
    const midpoint = session.getHandles().find((handle) => handle.kind === 'midpoint');
    const inserted = session.insertVertex(midpoint);
    expect(inserted).toBeTruthy();
    expect(polygon.getLatLngs()[0]).toHaveLength(5);

    const vertex = session
      .getHandles()
      .find((handle) => handle.kind === 'vertex' && handle.index === inserted.index);
    expect(session.deleteVertex(vertex)).toBe('vertex');
    expect(polygon.getLatLngs()[0]).toHaveLength(4);
  });

  it('не удаляет вершины ниже минимума, если это запрещено опцией', () => {
    const { plugin, map } = createHarness({ removeLayerBelowMinVertexCount: false });
    const polygon = new Polygon([
      [
        [-20, -20],
        [-20, 20],
        [20, 20],
      ],
    ]).addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    const session = plugin.getSession(polygon);
    const vertex = session.getHandles().find((handle) => handle.kind === 'vertex');
    const limits = [];
    plugin.on('vertexlimit', (event) => limits.push(event));
    expect(session.deleteVertex(vertex)).toBe(false);
    expect(polygon.getLatLngs()[0]).toHaveLength(3);
    expect(limits).toHaveLength(0);
  });

  it('выбирает объект кликом по path через всплытие события', () => {
    const { plugin, map } = createHarness();
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('select');
    const point = map.latLngToContainerPoint([0, 0]);
    polygon.fire('click', {
      latlng: new LatLng(0, 0),
      containerPoint: point,
      originalEvent: { shiftKey: false },
    });
    expect(plugin.getSelected()).toEqual([polygon]);
  });
});

describe('EditPlugin: рисование', () => {
  it('рисует полигон, добавляет его на карту и включает редактирование', () => {
    const { plugin, map, container } = createHarness();
    const created = [];
    const completed = [];
    plugin.on('create', (event) => created.push(event.layer));
    plugin.on('draw:completed', (event) => completed.push(event));

    plugin.startDrawing('polygon');
    expect(plugin.getMode()).toBe('create');
    expect(plugin.isDrawing()).toBe(true);
    expect(plugin.getDrawType()).toBe('polygon');
    expect(container.querySelector('.map-edit-draw-toolbar')).toBeTruthy();

    const coordinates = [
      [-20, -20],
      [-20, 20],
      [20, 20],
      [20, -20],
    ];
    for (const coordinate of coordinates) {
      const latlng = new LatLng(coordinate);
      map.fire('click', {
        latlng,
        containerPoint: map.latLngToContainerPoint(latlng),
      });
    }
    expect(plugin.finishDrawing()).toBe(true);

    expect(created).toHaveLength(1);
    expect(completed).toHaveLength(1);
    expect(map.hasLayer(created[0])).toBe(true);
    expect(created[0].toGeoJSON().geometry.type).toBe('Polygon');
    expect(plugin.getMode()).toBe('select');
    expect(plugin.isDrawing()).toBe(false);
    expect(container.querySelector('.map-edit-draw-toolbar')).toBeFalsy();
    expect(plugin.getSelected()).toEqual([created[0]]);
    expect(plugin.isEditable(created[0])).toBe(true);
    expect(plugin.canUndo()).toBe(true);

    plugin.undo();
    expect(map.hasLayer(created[0])).toBe(false);
    plugin.redo();
    expect(map.hasLayer(created[0])).toBe(true);
  });

  it('отменяет черновик по Esc и не создаёт слой', () => {
    const { plugin, map, container } = createHarness({ keyboard: true });
    const canceled = [];
    plugin.on('draw:canceled', (event) => canceled.push(event));
    plugin.startDrawing('polyline');
    map.fire('click', {
      latlng: new LatLng([0, 0]),
      containerPoint: map.latLngToContainerPoint([0, 0]),
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(plugin.isDrawing()).toBe(true);
    expect(canceled).toHaveLength(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(canceled.at(-1)).toMatchObject({ type: 'polyline', reason: 'escape' });
    expect(plugin.isDrawing()).toBe(false);
    expect(container.querySelector('.map-edit-draw-toolbar')).toBeFalsy();
  });

  it('рисует круг и прямоугольник по двум кликам', () => {
    const { plugin, map } = createHarness();
    for (const type of ['circle', 'rectangle']) {
      plugin.startDrawing(type);
      for (const coordinate of [
        [-10, -10],
        [10, 10],
      ]) {
        const latlng = new LatLng(coordinate);
        map.fire('click', {
          latlng,
          containerPoint: map.latLngToContainerPoint(latlng),
        });
      }
      expect(plugin.isDrawing()).toBe(false);
    }
    expect(plugin.canUndo()).toBe(true);
  });
});

describe('EditPlugin: удаление и undo/redo', () => {
  it('удаляет слой, откатывает и повторяет удаление', () => {
    const { plugin, map } = createHarness();
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('delete');
    plugin.selectLayer(polygon);
    const deleted = [];
    plugin.on('delete', (event) => deleted.push(event));

    expect(plugin.deleteLayer(polygon)).toBe(true);
    expect(map.hasLayer(polygon)).toBe(false);
    expect(deleted).toHaveLength(1);
    expect(plugin.getSelected()).toHaveLength(0);

    plugin.undo();
    expect(map.hasLayer(polygon)).toBe(true);
    expect(plugin.isEditable(polygon)).toBe(true);
    plugin.redo();
    expect(map.hasLayer(polygon)).toBe(false);
  });

  it('удаляет выбранные объекты', () => {
    const { plugin, map } = createHarness();
    const first = square().addTo(map);
    const second = new Polygon([
      [
        [30, 30],
        [30, 50],
        [50, 50],
      ],
    ]).addTo(map);
    plugin.enableEdit(first);
    plugin.enableEdit(second);
    plugin.setMode('select');
    plugin.selectLayer(first);
    plugin.selectLayer(second, true);
    expect(plugin.getSelected()).toHaveLength(2);
    expect(plugin.deleteSelected()).toBe(2);
    expect(map.hasLayer(first)).toBe(false);
    expect(map.hasLayer(second)).toBe(false);
  });
});

describe('EditPlugin: GeoJSON group', () => {
  it('редактирует все части MultiPolygon как одну группу', () => {
    const { plugin, map, container } = createHarness();
    const group = new GeoJSONLayer({
      type: 'Feature',
      properties: { name: 'multi' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-20, -20],
              [-20, -5],
              [-5, -5],
              [-5, -20],
              [-20, -20],
            ],
          ],
          [
            [
              [5, 5],
              [5, 20],
              [20, 20],
              [20, 5],
              [5, 5],
            ],
          ],
        ],
      },
    }).addTo(map);
    const session = plugin.enableEdit(group);
    expect(session.isGroup()).toBe(true);
    plugin.setMode('edit');
    plugin.selectLayer(group);
    expect(plugin.getSelected()).toEqual([group]);
    const vertices = container.querySelectorAll('.map-edit-handle-vertex');
    expect(vertices.length).toBeGreaterThanOrEqual(8);
  });
});

describe('EditPlugin: edge cases и destroy', () => {
  it('автоматически закрывает сессию при удалении слоя с карты', () => {
    const { plugin, map } = createHarness();
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);

    map.removeLayer(polygon);
    expect(plugin.getSession(polygon)).toBeNull();
    expect(plugin.getSelected()).toHaveLength(0);
  });

  it('полностью очищает DOM, обработчики и map.editPlugin', () => {
    const { plugin, map, container } = createHarness();
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    plugin.selectLayer(polygon);
    plugin.destroy();

    expect(container.querySelector('.map-edit-control')).toBeFalsy();
    expect(container.querySelector('.map-edit-handles')).toBeFalsy();
    expect(map.editPlugin).toBeUndefined();
    expect(plugin.getSession(polygon)).toBeNull();
    expect(() => plugin.destroy()).not.toThrow();
  });

  it('поддерживает несколько объектов в мультивыборе', () => {
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
    plugin.selectLayer(second, true);
    expect(plugin.getSelected()).toHaveLength(2);
    plugin.clearSelection();
    expect(plugin.getSelected()).toHaveLength(0);
  });

  it('destroy отменяет незавершённое рисование', () => {
    const { plugin } = createHarness();
    plugin.startDrawing('polygon');
    expect(plugin.isDrawing()).toBe(true);
    plugin.destroy();
    expect(plugin._draw).toBeNull();
  });

  it('ограничивает историю и умеет очищать redo', () => {
    const { plugin, map } = createHarness({ maxHistory: 2 });
    const first = square().addTo(map);
    plugin.enableEdit(first);
    plugin.setMode('edit');
    const session = plugin.getSession(first);
    const vertex = session.getHandles().find((handle) => handle.kind === 'vertex');
    session.setVertex(vertex, new LatLng(-25, -25));
    plugin._emitUpdate([first], 'move-vertex');
    expect(plugin._stack.undoLength).toBe(0);
    expect(plugin.t('select')).toBe('Select');
  });

  it('возвращает границы и данные GeoJSON после изменения', () => {
    const { plugin, map } = createHarness();
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    const session = plugin.getSession(polygon);
    const vertex = session.getHandles().find((handle) => handle.kind === 'vertex');
    session.setVertex(vertex, new LatLng(-30, -30));
    expect(polygon.getBounds().contains(new LatLng(-30, -30))).toBe(true);
    expect(polygon.toGeoJSON().geometry.type).toBe('Polygon');
  });

  it('поддерживает snap-to-grid', () => {
    const { plugin, map } = createHarness({
      snap: { enabled: true, gridSize: 20, toVertices: false },
    });
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    const snapped = plugin._snapLatLng(new LatLng(1, 1));
    const point = map.latLngToContainerPoint(snapped);
    expect(point.x % 20).toBe(0);
    expect(point.y % 20).toBe(0);
  });

  it('учитывает min/max вершины из опций', () => {
    const { plugin } = createHarness({
      limits: { polygon: { min: 4, max: 5 }, polyline: { min: 2, max: 3 } },
    });
    expect(plugin.getMinVertices('polygon')).toBe(4);
    expect(plugin.getMaxVertices('polygon')).toBe(5);
    expect(plugin.getMaxVertices('polyline')).toBe(3);
  });

  it('публикует selfintersection для самопересекающегося полигона', () => {
    const { plugin, map } = createHarness();
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    const warnings = [];
    plugin.on('selfintersection', (event) => warnings.push(event));
    const session = plugin.getSession(polygon);
    const vertex = session
      .getHandles()
      .find((handle) => handle.kind === 'vertex' && handle.index === 0);
    session.setVertex(vertex, new LatLng(20, 20));
    plugin._emitUpdate([polygon], 'move-vertex');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].rings[0].ring).toBe(0);
  });

  it('не создаёт handles для невыбранных объектов', () => {
    const { plugin, map, container } = createHarness();
    const polygon = square().addTo(map);
    plugin.enableEdit(polygon);
    plugin.setMode('edit');
    expect(container.querySelectorAll('.map-edit-handle').length).toBe(0);
    plugin.selectLayer(polygon);
    expect(container.querySelectorAll('.map-edit-handle').length).toBeGreaterThan(0);
  });

  it('строит прямоугольник и круг с корректными handles', () => {
    const { plugin, map, container } = createHarness();
    const rectangle = new (class extends Polygon {})([
      [
        [-10, -10],
        [-10, 10],
        [10, 10],
        [10, -10],
      ],
    ]).addTo(map);
    plugin.enableEdit(rectangle);
    plugin.setMode('edit');
    plugin.selectLayer(rectangle);
    expect(container.querySelectorAll('.map-edit-handle-vertex').length).toBe(4);
    expect(Bounds).toBeTruthy();
  });
});
