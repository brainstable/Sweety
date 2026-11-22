import { describe, expect, it, vi } from 'vitest';
import { Map } from '../src/core/Map.js';
import { Bounds } from '../src/core/Bounds.js';
import { Polyline } from '../src/layers/vector/Polyline.js';
import { Polygon } from '../src/layers/vector/Polygon.js';
import { Circle } from '../src/layers/vector/Circle.js';
import { Rectangle } from '../src/layers/vector/Rectangle.js';
import { SVG } from '../src/layers/vector/SVG.js';

function setup() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mockElementSize(container, 800, 600);
  const map = new Map(container, {
    center: [0, 0],
    zoom: 4,
    zoomControl: false,
    attributionControl: false,
  });
  return { map, container };
}

describe('SVG vector rendering', () => {
  it('draws a polyline, updates style and redraws on pan', () => {
    const { map } = setup();
    const line = new Polyline(
      [
        [-1, -1],
        [0, 0],
        [1, 1],
      ],
      { color: '#ff0000', weight: 5 },
    ).addTo(map);

    expect(line._path).toBeTruthy();
    expect(line._path.parentNode).toBe(map._svgRenderer._rootGroup);
    expect(line._path.getAttribute('d')).toMatch(/^M/);
    expect(line._path.getAttribute('stroke')).toBe('#ff0000');
    expect(line._path.getAttribute('stroke-width')).toBe('5');
    expect(line.getBounds().isValid()).toBe(true);

    const before = line._path.getAttribute('d');
    map.panBy([120, 80]);
    expect(line._path.getAttribute('d')).not.toBe(before);

    line.setStyle({ color: '#00ff00', dashArray: '4 2' });
    expect(line._path.getAttribute('stroke')).toBe('#00ff00');
    expect(line._path.getAttribute('stroke-dasharray')).toBe('4 2');
    map.remove();
  });

  it('shares an SVG renderer and supports an explicit renderer', () => {
    const { map } = setup();
    const first = new Polyline([
      [0, 0],
      [1, 1],
    ]).addTo(map);
    const second = new Circle([0, 0], 1000).addTo(map);
    expect(first._renderer).toBe(second._renderer);
    expect(first._renderer).toBeInstanceOf(SVG);

    const custom = new SVG();
    const third = new Polyline(
      [
        [0, 0],
        [2, 2],
      ],
      { renderer: custom },
    ).addTo(map);
    expect(third._renderer).toBe(custom);
    expect(map.hasLayer(custom)).toBe(true);
    map.remove();
  });

  it('fires path events once and bubbles them to the map', () => {
    const { map } = setup();
    const line = new Polyline([
      [-1, 0],
      [1, 0],
    ]).addTo(map);
    const pathClick = vi.fn();
    const mapClick = vi.fn();
    line.on('click', pathClick);
    map.on('click', mapClick);

    line._path.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 400, clientY: 300 }),
    );
    expect(pathClick).toHaveBeenCalledOnce();
    expect(mapClick).toHaveBeenCalledOnce();
    expect(mapClick.mock.calls[0][0].sourceTarget).toBe(line);
    map.remove();
  });

  it('supports popup bindings on vector paths', () => {
    const { map } = setup();
    const line = new Polyline([
      [-1, 0],
      [1, 0],
    ]).addTo(map);
    line.bindPopup('Line popup');
    line._path.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(line.isPopupOpen()).toBe(true);
    expect(map.getPane('popup').textContent).toContain('Line popup');
    map.remove();
  });
});

describe('Polygon', () => {
  it('renders a polygon with a hole and computes bounds', () => {
    const { map } = setup();
    const polygon = new Polygon([
      [
        [-2, -2],
        [-2, 2],
        [2, 2],
        [2, -2],
      ],
      [
        [-1, -1],
        [-1, 1],
        [1, 1],
        [1, -1],
      ],
    ]).addTo(map);

    const d = polygon._path.getAttribute('d');
    expect((d.match(/M/g) || []).length).toBe(2);
    expect(polygon._path.getAttribute('fill-rule')).toBe('evenodd');
    const bounds = polygon.getBounds();
    expect(bounds.contains([0, 0])).toBe(true);
    expect(bounds.getNorth()).toBeCloseTo(2);
    expect(polygon.getCenter().lat).toBeCloseTo(0);

    polygon.setLatLngs([
      [0, 0],
      [0, 1],
      [1, 1],
    ]);
    expect(polygon._path.getAttribute('d')).toContain('Z');
    expect(polygon.toGeoJSON().geometry.type).toBe('Polygon');
    map.remove();
  });

  it('exports disjoint rings as MultiPolygon and nested rings as holes', () => {
    const polygon = new Polygon([
      [
        [0, 0],
        [0, 10],
        [10, 10],
        [10, 0],
      ],
      [
        [2, 2],
        [2, 4],
        [4, 4],
        [4, 2],
      ],
      [
        [20, 20],
        [20, 30],
        [30, 30],
        [30, 20],
      ],
    ]);

    const json = polygon.toGeoJSON();
    expect(json.geometry.type).toBe('MultiPolygon');
    expect(json.geometry.coordinates).toHaveLength(2);
    // Первый контур — с отверстием, второй — самостоятельный.
    expect(json.geometry.coordinates[0]).toHaveLength(2);
    expect(json.geometry.coordinates[1]).toHaveLength(1);

    // Одно внешнее кольцо остаётся обычным Polygon.
    const simple = new Polygon([
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
    ]);
    expect(simple.toGeoJSON().geometry.type).toBe('Polygon');
  });
});

describe('Circle and Rectangle', () => {
  it('creates a geodesic circle with bounds and editable geometry', () => {
    const { map } = setup();
    const circle = new Circle([0, 0], 50000, { color: '#123456' }).addTo(map);
    expect(circle.getRadius()).toBe(50000);
    expect(circle._path.getAttribute('d')).toMatch(/^M/);
    const bounds = circle.getBounds();
    expect(bounds.contains([0, 0])).toBe(true);
    expect(bounds.getNorth()).toBeGreaterThan(0);
    expect(bounds.getEast()).toBeGreaterThan(0);

    const before = circle._path.getAttribute('d');
    circle.setRadius(100000);
    expect(circle._path.getAttribute('d')).not.toBe(before);
    circle.setLatLng([10, 10]);
    expect(circle.getLatLng()).toMatchObject({ lat: 10, lng: 10 });
    expect(() => circle.setRadius(-1)).toThrow(RangeError);
    expect(circle.toGeoJSON().properties.radius).toBe(100000);
    map.remove();
  });

  it('renders a rectangle from bounds and updates it', () => {
    const { map } = setup();
    const rectangle = new Rectangle(new Bounds([-1, -2], [1, 2]), { color: '#654321' }).addTo(map);
    expect(rectangle._path.getAttribute('d')).toContain('Z');
    expect(rectangle.getBounds().toBBoxString()).toBe('-2.000000,-1.000000,2.000000,1.000000');
    expect(rectangle.getCenter()).toMatchObject({ lat: 0, lng: 0 });

    rectangle.setBounds([
      [-2, -4],
      [2, 4],
    ]);
    expect(rectangle.getBounds().getEast()).toBe(4);
    expect(rectangle.toGeoJSON().geometry.coordinates[0]).toHaveLength(5);
    expect(() => new Rectangle(new Bounds())).toThrow('valid bounds');
    map.remove();
  });
});
