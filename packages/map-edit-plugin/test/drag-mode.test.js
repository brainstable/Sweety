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

function pointer(target, type, point) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
      button: 0,
    }),
  );
}

const frame = () => new Promise((resolve) => setTimeout(resolve, 40));

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    if (!harness.plugin._destroyed) harness.plugin.destroy();
    harness.map.remove();
  }
});

describe('Режим перетаскивания', () => {
  it('двигает объект без выделения и присылает события перетаскивания', async () => {
    const { plugin, map } = createHarness();
    const polygon = square().addTo(map);
    const events = [];
    plugin.on('drag:start', (event) => events.push(['start', event.layers.length]));
    plugin.on('drag', () => events.push(['drag']));
    plugin.on('drag:end', () => events.push(['end']));
    const changes = [];
    plugin.on('drag:enabled', (event) => changes.push(event.enabled));

    expect(plugin.isDragEnabled()).toBe(false);
    expect(plugin.toggleDrag()).toBe(true);
    expect(plugin.isDragEnabled()).toBe(true);
    expect(changes).toEqual([true]);

    const before = polygon.getLatLngs()[0][0].lng;
    const start = map.latLngToContainerPoint([0, 0]);
    pointer(polygon._path, 'pointerdown', start);
    pointer(document, 'pointermove', { x: start.x + 50, y: start.y });
    await frame();
    pointer(document, 'pointerup', { x: start.x + 50, y: start.y });

    expect(polygon.getLatLngs()[0][0].lng).toBeGreaterThan(before);
    expect(events[0]).toEqual(['start', 1]);
    expect(events.some(([name]) => name === 'drag')).toBe(true);
    expect(events.at(-1)).toEqual(['end']);
    expect(plugin.canUndo()).toBe(true);
    plugin.undo();
    expect(polygon.getLatLngs()[0][0].lng).toBeCloseTo(before, 9);
  });

  it('не двигает объект с draggable: false и уважает явные настройки слоя', async () => {
    const { plugin, map } = createHarness();
    const locked = square().addTo(map);
    locked.options.draggable = false;
    const free = new Polygon([
      [
        [30, 30],
        [30, 50],
        [50, 50],
        [50, 30],
      ],
    ]).addTo(map);

    plugin.enableDrag();
    expect(plugin.isLayerDragEnabled(locked)).toBe(false);
    expect(plugin.isLayerDragEnabled(free)).toBe(true);

    const lockedBefore = locked.getLatLngs()[0][0].lng;
    const lockedStart = map.latLngToContainerPoint([0, 0]);
    pointer(locked._path, 'pointerdown', lockedStart);
    pointer(document, 'pointermove', { x: lockedStart.x + 40, y: lockedStart.y });
    await frame();
    pointer(document, 'pointerup', { x: lockedStart.x + 40, y: lockedStart.y });
    expect(locked.getLatLngs()[0][0].lng).toBeCloseTo(lockedBefore, 9);

    plugin.disableDrag();
    expect(plugin.isDragEnabled()).toBe(false);

    // Явное разрешение работает и без общего режима.
    plugin.enableLayerDrag(free);
    const freeBefore = free.getLatLngs()[0][0].lng;
    const freeStart = map.latLngToContainerPoint([40, 40]);
    pointer(free._path, 'pointerdown', freeStart);
    pointer(document, 'pointermove', { x: freeStart.x + 40, y: freeStart.y });
    await frame();
    pointer(document, 'pointerup', { x: freeStart.x + 40, y: freeStart.y });
    expect(free.getLatLngs()[0][0].lng).toBeGreaterThan(freeBefore);

    plugin.undo();
    plugin.disableLayerDrag(free);
    expect(plugin.isLayerDragEnabled(free)).toBe(false);
  });

  it('кнопка панели включает режим и показывает активное состояние', () => {
    const { plugin, container, map } = createHarness();
    square().addTo(map);
    const button = container.querySelector('button[data-action="drag"]');
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(false);

    button.click();
    expect(plugin.isDragEnabled()).toBe(true);
    expect(button.classList.contains('is-active')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();
    expect(plugin.isDragEnabled()).toBe(false);
    expect(button.classList.contains('is-active')).toBe(false);
  });
});
