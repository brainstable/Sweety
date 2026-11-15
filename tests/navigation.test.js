import { describe, expect, it, vi } from 'vitest';
import { Map } from '../src/core/Map.js';
import { Bounds } from '../src/core/Bounds.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setup(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mockElementSize(container, 800, 600);
  const map = new Map(container, {
    center: [0, 0],
    zoom: 4,
    zoomControl: false,
    attributionControl: false,
    ...options,
  });
  return { map, container };
}

describe('navigation API', () => {
  it('computes a bounds zoom and fits with padding and maxZoom', () => {
    const { map } = setup();
    const bounds = new Bounds([55.7, 37.5], [55.8, 37.7]);
    const zoom = map.getBoundsZoom(bounds);
    expect(zoom).toBeGreaterThan(8);
    expect(zoom).toBeLessThanOrEqual(map.getMaxZoom());

    map.fitBounds(bounds, { padding: [30, 20], maxZoom: 9 });
    expect(map.getZoom()).toBeLessThanOrEqual(9);
    const view = map.getBounds();
    expect(view.contains(bounds.getNorthWest())).toBe(true);
    expect(view.contains(bounds.getSouthEast())).toBe(true);
    map.remove();
  });

  it('flies to a coordinate and emits lifecycle events', async () => {
    const { map } = setup();
    const start = vi.fn();
    const end = vi.fn();
    map.on('flystart', start);
    map.on('flyend', end);

    map.flyTo([20, 30], 7, { duration: 80 });
    expect(start).toHaveBeenCalledOnce();
    await wait(250);
    expect(map.getCenter().lat).toBeCloseTo(20, 6);
    expect(map.getCenter().lng).toBeCloseTo(30, 6);
    expect(map.getZoom()).toBe(7);
    expect(end).toHaveBeenCalledOnce();
    map.remove();
  });

  it('flies to bounds and respects maxZoom', async () => {
    const { map } = setup();
    const bounds = new Bounds([10, 10], [12, 14]);
    map.flyToBounds(bounds, { duration: 80, maxZoom: 6 });
    await wait(250);
    expect(map.getZoom()).toBeLessThanOrEqual(6);
    expect(map.getBounds().contains(bounds.getCenter())).toBe(true);
    map.remove();
  });

  it('cancels a flight when setView is called', async () => {
    const { map } = setup();
    const end = vi.fn();
    map.on('flyend', end);
    map.flyTo([40, 40], 8, { duration: 500 });
    map.setView([1, 2], 5);
    await wait(100);
    expect(map.getCenter().lat).toBeCloseTo(1);
    expect(map.getCenter().lng).toBeCloseTo(2);
    expect(map.getZoom()).toBe(5);
    expect(end).toHaveBeenCalled();
    map.remove();
  });

  it('pans a coordinate inside the padded viewport', () => {
    const { map } = setup();
    const latlng = [0, 60];
    map.panInside(latlng, { padding: [30, 30] });
    const point = map.latLngToContainerPoint(latlng);
    expect(point.x).toBeGreaterThanOrEqual(30);
    expect(point.x).toBeLessThanOrEqual(770);
    expect(point.y).toBeGreaterThanOrEqual(30);
    expect(point.y).toBeLessThanOrEqual(570);
    map.remove();
  });

  it('keeps the viewport inside arbitrary bounds', () => {
    const { map } = setup({ center: [50, 50], zoom: 4 });
    const bounds = new Bounds([-5, -5], [5, 5]);
    map.panInsideBounds(bounds);
    expect(map.getCenter().lat).toBeCloseTo(0);
    expect(map.getCenter().lng).toBeCloseTo(0);
    expect(() => map.panInsideBounds(new Bounds())).toThrow('valid bounds');
    map.remove();
  });

  it('clamps flyTo destinations to maxBounds', async () => {
    const { map } = setup({
      center: [0, 0],
      zoom: 4,
      maxBounds: [
        [-10, -10],
        [10, 10],
      ],
    });
    map.flyTo([50, 50], 5, { duration: 60 });
    await wait(200);
    expect(map.getCenter().lat).toBeCloseTo(0);
    expect(map.getCenter().lng).toBeCloseTo(0);
    map.remove();
  });
});
