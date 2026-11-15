import { describe, expect, it, vi } from 'vitest';
import { Evented } from '../src/core/Evented.js';
import { Map } from '../src/core/Map.js';
import { Bounds } from '../src/core/Bounds.js';
import { Point } from '../src/core/Point.js';

class TestLayer extends Evented {
  constructor() {
    super();
    this.updates = 0;
    this.added = 0;
    this.removed = 0;
  }

  onAdd(map) {
    this.added += 1;
    this.container = document.createElement('div');
    this.container.className = 'test-layer';
    map.getPane('overlay').appendChild(this.container);
  }

  onRemove() {
    this.removed += 1;
    this.container?.remove();
  }

  _update() {
    this.updates += 1;
  }
}

function createMap(options = {}, size = [800, 600]) {
  const container = document.createElement('div');
  container.id = 'map';
  document.body.appendChild(container);
  mockElementSize(container, size[0], size[1]);
  return { map: new Map(container, options), container };
}

describe('Map', () => {
  it('initialises from a container id, creates panes and centres the view', () => {
    const container = document.createElement('div');
    container.id = 'map';
    document.body.appendChild(container);
    mockElementSize(container, 800, 600);

    const map = new Map('map', { center: [55.75, 37.61], zoom: 10 });
    expect(map.getContainer()).toBe(container);
    expect(map.getSize()).toEqual({ x: 800, y: 600 });
    expect(map.getCenter()).toMatchObject({ lat: 55.75, lng: 37.61 });
    expect(map.getZoom()).toBe(10);
    expect(container.classList.contains('sweety-container')).toBe(true);
    expect(container.querySelector('.sweety-map-pane')).toBeTruthy();
    expect(map.getPane('tile')).toBeTruthy();
    expect(map.getPane('marker')).toBeTruthy();
    expect(map.getPane('custom')).toBeTruthy();

    const centerPoint = map.latLngToContainerPoint(map.getCenter());
    expect(centerPoint.x).toBeCloseTo(400);
    expect(centerPoint.y).toBeCloseTo(300);
    map.remove();
  });

  it('validates the container and zoom inputs', () => {
    expect(() => new Map('missing')).toThrow('Map container not found');
    expect(() => new Map(document.createElement('div'), { zoom: Number.NaN })).toThrow(
      'finite zoom',
    );

    const { map, container } = createMap();
    expect(() => new Map(container)).toThrow('already initialized');
    map.remove();
    expect(() => new Map(container)).not.toThrow();
  });

  it('moves and zooms while emitting a coherent event sequence', () => {
    const { map } = createMap({ center: [0, 0], zoom: 3 });
    const events = [];
    for (const type of [
      'movestart',
      'zoomstart',
      'viewreset',
      'move',
      'zoom',
      'moveend',
      'zoomend',
    ]) {
      map.on(type, () => events.push(type));
    }

    map.setView([10, 20], 5);
    expect(map.getCenter()).toMatchObject({ lat: 10, lng: 20 });
    expect(map.getZoom()).toBe(5);
    expect(events).toEqual([
      'movestart',
      'zoomstart',
      'viewreset',
      'move',
      'zoom',
      'moveend',
      'zoomend',
    ]);

    map.setView([10, 20], 5);
    expect(events.slice(-4)).toEqual(['movestart', 'viewreset', 'move', 'moveend']);
    map.remove();
  });

  it('converts between coordinates, layer pixels and container pixels', () => {
    const { map } = createMap({ center: [55.75, 37.61], zoom: 10 });
    const latlng = map.getCenter();
    const layerPoint = map.latLngToLayerPoint(latlng);
    expect(layerPoint.x).toBeCloseTo(400);
    expect(layerPoint.y).toBeCloseTo(300);
    expect(map.layerPointToLatLng(layerPoint).lat).toBeCloseTo(55.75, 9);
    expect(map.containerPointToLatLng({ x: 400, y: 300 }).lng).toBeCloseTo(37.61, 9);

    const projected = map.project(latlng);
    const unprojected = map.unproject(projected);
    expect(unprojected.lat).toBeCloseTo(55.75, 9);
    expect(map.distance([0, 0], [0, 1])).toBeGreaterThan(111000);
    map.remove();
  });

  it('fires DOM-backed click events with all coordinate spaces', () => {
    const { map, container } = createMap({ center: [0, 0], zoom: 2 });
    const listener = vi.fn();
    map.on('click', listener);
    container.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 400, clientY: 300 }),
    );

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0];
    expect(event.latlng.lat).toBeCloseTo(0);
    expect(event.latlng.lng).toBeCloseTo(0);
    expect(event.containerPoint).toMatchObject({ x: 400, y: 300 });
    expect(event.layerPoint).toMatchObject({ x: 400, y: 300 });
    map.remove();
  });

  it('keeps a screen anchor fixed during setZoomAround', () => {
    const { map } = createMap({ center: [0, 0], zoom: 2 });
    const anchor = map.containerPointToLatLng(new Point(200, 120));
    map.setZoomAround(anchor, 4);
    const after = map.latLngToContainerPoint(anchor);
    expect(after.x).toBeCloseTo(200, 6);
    expect(after.y).toBeCloseTo(120, 6);
    map.remove();
  });

  it('enforces zoom limits and maxBounds', () => {
    const { map } = createMap({
      center: [0, 0],
      zoom: 3,
      minZoom: 2,
      maxZoom: 5,
      maxBounds: [
        [-10, -10],
        [10, 10],
      ],
    });

    map.setZoom(20);
    expect(map.getZoom()).toBe(5);
    map.setZoom(-20);
    expect(map.getZoom()).toBe(2);
    map.setView([50, 50], 3);
    expect(map.getCenter().lat).toBeCloseTo(0);
    expect(map.getCenter().lng).toBeCloseTo(0);
    map.remove();
  });

  it('fits bounds and respects padding and maxZoom', () => {
    const { map } = createMap({ center: [0, 0], zoom: 2 });
    const bounds = new Bounds([55.7, 37.5], [55.8, 37.7]);
    map.fitBounds(bounds, { padding: [20, 20] });
    const visible = map.getBounds();
    expect(visible.contains(bounds.getCenter())).toBe(true);
    expect(visible.contains(bounds.getNorthWest())).toBe(true);
    expect(visible.contains(bounds.getSouthEast())).toBe(true);

    map.fitBounds(bounds, { maxZoom: 6 });
    expect(map.getZoom()).toBeLessThanOrEqual(6);
    expect(() => map.fitBounds(new Bounds())).toThrow('valid bounds');
    map.remove();
  });

  it('pans by pixels and responds to container resizes', () => {
    const { map, container } = createMap({ center: [10, 20], zoom: 4 });
    const before = map.getCenter();
    map.panBy([50, 0]);
    expect(map.getCenter().lng).not.toBeCloseTo(before.lng);

    const center = map.getCenter();
    mockElementSize(container, 500, 400);
    map.invalidateSize();
    expect(map.getSize()).toEqual({ x: 500, y: 400 });
    expect(map.getCenter().lat).toBeCloseTo(center.lat, 9);
    expect(map.getCenter().lng).toBeCloseTo(center.lng, 9);
    map.remove();
  });

  it('manages layer lifecycle and event bubbling', () => {
    const { map } = createMap();
    const layer = new TestLayer();
    const listener = vi.fn();
    map.on('custom', listener);
    map.addLayer(layer);
    expect(map.hasLayer(layer)).toBe(true);
    expect(layer.added).toBe(1);
    expect(map.getLayers()).toContain(layer);

    layer.fire('custom', { value: 1 });
    expect(listener).toHaveBeenCalledOnce();
    expect(map.getPane('overlay').contains(layer.container)).toBe(true);

    map.removeLayer(layer);
    expect(map.hasLayer(layer)).toBe(false);
    expect(layer.removed).toBe(1);
    map.remove();
  });

  it('removes its DOM and detaches the container', () => {
    const { map, container } = createMap();
    const layer = new TestLayer();
    map.addLayer(layer);
    map.remove();
    expect(layer.removed).toBe(1);
    expect(container._sweetyMap).toBeNull();
    expect(container.querySelector('.sweety-map-pane')).toBeNull();
  });
});
