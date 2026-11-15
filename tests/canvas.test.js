import { describe, expect, it, vi } from 'vitest';
import { Map } from '../src/core/Map.js';
import { Polygon } from '../src/layers/vector/Polygon.js';
import { Polyline } from '../src/layers/vector/Polyline.js';
import { Circle } from '../src/layers/vector/Circle.js';
import { Canvas } from '../src/layers/vector/Canvas.js';
import { Point } from '../src/core/Point.js';

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

const polygonRing = [
  [-5, -5],
  [-5, 5],
  [5, 5],
  [5, -5],
];

describe('Canvas renderer', () => {
  it('uses a single canvas when preferCanvas is enabled', () => {
    const { map } = setup({ preferCanvas: true });
    const polygon = new Polygon(polygonRing).addTo(map);
    expect(map._canvasRenderer).toBeInstanceOf(Canvas);
    expect(map._svgRenderer).toBeNull();
    expect(polygon._renderer).toBe(map._canvasRenderer);
    const canvas = map.getPane('overlay').querySelector('canvas.sweety-canvas-layer');
    expect(canvas).toBeTruthy();

    map._canvasRenderer._redraw();
    const calls = canvas.getContext('2d').__calls.map((call) => call.name);
    expect(calls).toContain('fill');
    expect(calls).toContain('stroke');
    map.remove();
  });

  it('hit-tests polygons, fires path events and blocks duplicate map clicks', () => {
    const { map } = setup({ preferCanvas: true });
    const polygon = new Polygon(polygonRing).addTo(map);
    const pathClick = vi.fn();
    const mapClick = vi.fn();
    polygon.on('click', pathClick);
    map.on('click', mapClick);
    const canvas = map._canvasRenderer._canvas;

    canvas.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 400, clientY: 300 }),
    );
    expect(pathClick).toHaveBeenCalledOnce();
    expect(mapClick).toHaveBeenCalledOnce();
    expect(mapClick.mock.calls[0][0].sourceTarget).toBe(polygon);

    canvas.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }),
    );
    expect(mapClick).toHaveBeenCalledTimes(2);
    expect(mapClick.mock.calls[1][0].sourceTarget).toBe(map);
    map.remove();
  });

  it('performs even-odd hit testing with holes and stroke tolerance', () => {
    const { map } = setup({ preferCanvas: true });
    const polygon = new Polygon([
      [
        [-5, -5],
        [-5, 5],
        [5, 5],
        [5, -5],
      ],
      [
        [-2, -2],
        [-2, 2],
        [2, 2],
        [2, -2],
      ],
    ]).addTo(map);
    const renderer = map._canvasRenderer;

    expect(polygon._containsPoint(new Point(400, 300))).toBe(false);
    expect(polygon._containsPoint(new Point(350, 300))).toBe(true);

    const line = new Polyline([
      [-5, 0],
      [5, 0],
    ]).addTo(map);
    expect(line._containsPoint(new Point(400, 300))).toBe(true);
    expect(line._containsPoint(new Point(400, 200))).toBe(false);
    expect(renderer._getInteractiveLayer(new Point(400, 300))).toBe(line);
    map.remove();
  });

  it('supports mouseover and mouseout on interactive canvas features', () => {
    const { map } = setup({ preferCanvas: true });
    const circle = new Circle([0, 0], 30000).addTo(map);
    const over = vi.fn();
    const out = vi.fn();
    circle.on('mouseover', over);
    circle.on('mouseout', out);
    const canvas = map._canvasRenderer._canvas;

    canvas.dispatchEvent(
      new MouseEvent('mousemove', { bubbles: true, clientX: 400, clientY: 300 }),
    );
    expect(over).toHaveBeenCalledOnce();
    canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 20, clientY: 20 }));
    expect(out).toHaveBeenCalledOnce();
    map.remove();
  });

  it('accepts an explicit Canvas renderer and thousands of features', () => {
    const { map } = setup();
    const renderer = new Canvas();
    const layers = [];
    for (let i = 0; i < 200; i += 1) {
      const x = (i % 20) * 0.2 - 2;
      const y = Math.floor(i / 20) * 0.2 - 2;
      layers.push(
        new Polyline(
          [
            [y, x],
            [y + 0.1, x + 0.1],
          ],
          { renderer },
        ).addTo(map),
      );
    }
    expect(map.hasLayer(renderer)).toBe(true);
    expect(renderer._layers && Object.keys(renderer._layers)).toHaveLength(200);
    map.remove();
  });
});
