import { describe, expect, it } from 'vitest';
import {
  Circle,
  GeoJSONLayer,
  LatLng,
  Marker,
  Point,
  Polygon,
  Polyline,
  Rectangle,
} from 'sweety-map';
import {
  closestPointOnSegment,
  cloneLatLngs,
  findSelfIntersections,
  getLayerKind,
  getLayerVertices,
  getRings,
  insertVertexInSegment,
  isSelfIntersecting,
  midpointLatLng,
  pointInRing,
  removeVertexAt,
  restoreGeometry,
  ringArea,
  snapshotGeometry,
  translateSnapshot,
} from '../src/core/GeometryUtils.js';

const latlng = (lat, lng) => new LatLng(lat, lng);
const fakeMap = {
  project: (value) => new Point(value.lng * 10, -value.lat * 10),
  unproject: (value) => new LatLng(-value.y / 10, value.x / 10),
};

describe('GeometryUtils: определение типов', () => {
  it('различает marker/circle/rectangle/polyline/polygon/group', () => {
    expect(getLayerKind(new Marker([0, 0]))).toBe('marker');
    expect(getLayerKind(new Circle([0, 0], 100))).toBe('circle');
    expect(
      getLayerKind(
        new Rectangle([
          [-1, -1],
          [1, 1],
        ]),
      ),
    ).toBe('rectangle');
    expect(
      getLayerKind(
        new Polyline([
          [0, 0],
          [1, 1],
        ]),
      ),
    ).toBe('polyline');
    expect(
      getLayerKind(
        new Polygon([
          [
            [0, 0],
            [0, 1],
            [1, 1],
          ],
        ]),
      ),
    ).toBe('polygon');
    const group = new GeoJSONLayer({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ],
    });
    expect(getLayerKind(group)).toBe('group');
    expect(getLayerKind({})).toBeNull();
  });

  it('возвращает кольца и вершины', () => {
    const polygon = new Polygon([
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
    ]);
    expect(getRings(polygon)[0]).toHaveLength(3);
    expect(getLayerVertices(polygon)).toHaveLength(3);
    const rectangle = new Rectangle([
      [-1, -1],
      [1, 1],
    ]);
    expect(getRings(rectangle)[0]).toHaveLength(4);
    expect(getLayerVertices(rectangle)).toHaveLength(4);
    const circle = new Circle([0, 0], 100);
    expect(getLayerVertices(circle)).toHaveLength(2);
  });
});

describe('GeometryUtils: сегменты и вершины', () => {
  it('проецирует точку на отрезок и ограничивает параметр', () => {
    const inside = closestPointOnSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(inside).toMatchObject({ x: 5, y: 0, t: 0.5, distance: 5 });
    const outside = closestPointOnSegment({ x: 20, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(outside.t).toBe(1);
    expect(outside.distance).toBeCloseTo(Math.hypot(10, 3));
  });

  it('вставляет и удаляет вершины', () => {
    const ring = [latlng(0, 0), latlng(0, 2)];
    insertVertexInSegment(ring, 0, latlng(0, 1));
    expect(ring.map((value) => value.lng)).toEqual([0, 1, 2]);
    removeVertexAt(ring, 1);
    expect(ring).toHaveLength(2);
  });

  it('вычисляет середину сегмента в экранной проекции', () => {
    const middle = midpointLatLng(fakeMap, latlng(0, 0), latlng(2, 2));
    expect(middle.lat).toBeCloseTo(1);
    expect(middle.lng).toBeCloseTo(1);
  });
});

describe('GeometryUtils: самопересечения', () => {
  it('находит «бабочку» и не находит выпуклый полигон', () => {
    const bowtie = [latlng(0, 0), latlng(1, 1), latlng(1, 0), latlng(0, 1)];
    expect(isSelfIntersecting(bowtie)).toBe(true);
    expect(findSelfIntersections(bowtie)).toEqual([[0, 2]]);

    const convex = [latlng(0, 0), latlng(0, 2), latlng(2, 2), latlng(2, 0)];
    expect(isSelfIntersecting(convex)).toBe(false);
    expect(findSelfIntersections(convex)).toEqual([]);
  });

  it('не считает соседние сегменты пересечением', () => {
    const triangle = [latlng(0, 0), latlng(0, 2), latlng(2, 1)];
    expect(isSelfIntersecting(triangle)).toBe(false);
  });

  it('понимает незамкнутую линию', () => {
    const line = [latlng(0, 0), latlng(1, 1), latlng(0, 2), latlng(1, 0)];
    expect(findSelfIntersections(line, { closed: false })).not.toEqual([]);
  });
});

describe('GeometryUtils: полигоны', () => {
  it('считает площадь и попадание точки', () => {
    const ring = [latlng(0, 0), latlng(0, 2), latlng(2, 2), latlng(2, 0)];
    expect(ringArea(ring)).toBe(4);
    expect(pointInRing({ x: 1, y: 1 }, ring)).toBe(true);
    expect(pointInRing({ x: 3, y: 3 }, ring)).toBe(false);
  });
});

describe('GeometryUtils: снимки', () => {
  it('восстанавливает полигон и маркер', () => {
    const polygon = new Polygon([
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
    ]);
    const snapshot = snapshotGeometry(polygon);
    polygon.setLatLngs([
      [
        [5, 5],
        [5, 6],
        [6, 6],
      ],
    ]);
    restoreGeometry(polygon, snapshot);
    expect(polygon.getLatLngs()[0][0].lat).toBe(0);
    expect(polygon.getLatLngs()[0][0].lng).toBe(0);

    const marker = new Marker([1, 2]);
    const markerSnapshot = snapshotGeometry(marker);
    marker.setLatLng([0, 0]);
    restoreGeometry(marker, markerSnapshot);
    expect(marker.getLatLng().lat).toBe(1);
  });

  it('сдвигает снимок в экранной проекции', () => {
    const polygon = new Polygon([
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
    ]);
    const moved = translateSnapshot(fakeMap, snapshotGeometry(polygon), new Point(10, 0));
    expect(moved.latlngs[0][0].lng).toBeCloseTo(1);
    expect(moved.latlngs[0][0].lat).toBeCloseTo(0);
  });

  it('восстанавливает прямоугольник и круг', () => {
    const rectangle = new Rectangle([
      [0, 0],
      [1, 1],
    ]);
    const rectangleSnapshot = snapshotGeometry(rectangle);
    rectangle.setBounds([
      [5, 5],
      [6, 6],
    ]);
    restoreGeometry(rectangle, rectangleSnapshot);
    expect(rectangle.getBounds().getSouth()).toBe(0);

    const circle = new Circle([0, 0], 100);
    const circleSnapshot = snapshotGeometry(circle);
    circle.setRadius(500);
    circle.setLatLng([1, 1]);
    restoreGeometry(circle, circleSnapshot);
    expect(circle.getRadius()).toBe(100);
    expect(circle.getLatLng().lat).toBe(0);
  });
});

describe('GeometryUtils: clone', () => {
  it('клонирует вложенные координаты, не разделяя ссылки', () => {
    const source = [[latlng(0, 0)]];
    const copy = cloneLatLngs(source);
    copy[0][0].lat = 10;
    expect(source[0][0].lat).toBe(0);
  });
});
