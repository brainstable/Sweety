import { describe, expect, it } from 'vitest';
import {
  classifyRings,
  countCrossings,
  dissolveRings,
  interiorPoint,
  pointInRing,
  ringArea,
  segmentIntersection,
  splitPolygonByLine,
  splitPolylineByLine,
  splitRingByLine,
  validateHole,
} from '../src/core/Operations.js';

const box = (x, y, size = 4) => [
  { x, y },
  { x: x + size, y },
  { x: x + size, y: y + size },
  { x, y: y + size },
];

const area = (ring) => ringArea(ring);

describe('Operations: базовые предикаты', () => {
  it('находит пересечение отрезков и не считает параллельные', () => {
    const hit = segmentIntersection(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: -5 },
      { x: 5, y: 5 },
    );
    expect(hit).toMatchObject({ t: 0.5, u: 0.5 });
    expect(hit.point).toEqual({ x: 5, y: 0 });
    expect(
      segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 4 }, { x: 10, y: 4 }),
    ).toBeNull();
  });

  it('проверяет попадание точки в кольцо и площадь', () => {
    const ring = box(0, 0, 10);
    expect(pointInRing({ x: 5, y: 5 }, ring)).toBe(true);
    expect(pointInRing({ x: 15, y: 5 }, ring)).toBe(false);
    expect(area(ring)).toBeCloseTo(100, 9);
    expect(area([ring[0], ring[1]])).toBe(0);
  });

  it('находит внутреннюю точку у вогнутой фигуры', () => {
    const lShape = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 6 },
      { x: 0, y: 6 },
    ];
    const point = interiorPoint(lShape);
    expect(point).toBeTruthy();
    expect(pointInRing(point, lShape)).toBe(true);
  });
});

describe('Operations: разрезание', () => {
  it('делит квадрат на равные половины', () => {
    const square = box(0, 0);
    const cutter = [
      { x: 2, y: -2 },
      { x: 2, y: 6 },
    ];
    expect(countCrossings(square, cutter)).toBe(2);
    const split = splitRingByLine(square, cutter);
    expect(split).toBeTruthy();
    expect(split.rings).toHaveLength(2);
    expect(area(split.rings[0])).toBeCloseTo(8, 6);
    expect(area(split.rings[1])).toBeCloseTo(8, 6);
  });

  it('возвращает null, если линия не пересекает кольцо дважды', () => {
    const square = box(0, 0);
    expect(
      splitRingByLine(square, [
        { x: -2, y: -2 },
        { x: -1, y: -1 },
      ]),
    ).toBeNull();
    expect(
      splitRingByLine(square, [
        { x: 1, y: 2 },
        { x: 3, y: 2 },
      ]),
    ).toBeNull();
  });

  it('делит полигон с отверстием и распределяет отверстия по частям', () => {
    const rings = [box(0, 0, 10), box(6, 6, 2)];
    const parts = splitPolygonByLine(rings, [
      { x: 1, y: -2 },
      { x: 1, y: 12 },
    ]);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(2);
    expect(parts[1]).toHaveLength(1);
    expect(area(parts[0][0]) + area(parts[1][0])).toBeCloseTo(100, 6);
  });

  it('обрезает отверстие, через которое проходит линия', () => {
    const rings = [box(0, 0, 10), box(3, 3, 4)];
    const parts = splitPolygonByLine(rings, [
      { x: 5, y: -2 },
      { x: 5, y: 12 },
    ]);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(2);
    expect(parts[1]).toHaveLength(2);
    // Площадь отверстия 16 делится пополам.
    expect(area(parts[0][1]) + area(parts[1][1])).toBeCloseTo(16, 6);
  });

  it('делит полилинию по точкам пересечения', () => {
    const parts = splitPolylineByLine(
      [
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
      ],
      [
        { x: 4, y: -2 },
        { x: 4, y: 2 },
      ],
    );
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]);
    expect(parts[1]).toEqual([
      { x: 4, y: 0 },
      { x: 10, y: 0 },
    ]);
    expect(
      splitPolylineByLine(
        [
          [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ],
        ],
        [
          { x: 0, y: 4 },
          { x: 10, y: 4 },
        ],
      ),
    ).toBeNull();
  });
});

describe('Operations: объединение по общим границам', () => {
  it('растворяет общую границу двух квадратов', () => {
    const result = dissolveRings([box(0, 0), box(4, 0)]);
    expect(result.error).toBeUndefined();
    expect(result.rings).toHaveLength(1);
    expect(area(result.rings[0])).toBeCloseTo(32, 6);
  });

  it('обрабатывает T-образный стык и три фигуры углом', () => {
    const tShape = dissolveRings([
      box(0, 0, 6),
      [
        { x: 6, y: 0 },
        { x: 9, y: 0 },
        { x: 9, y: 3 },
        { x: 6, y: 3 },
      ],
    ]);
    expect(tShape.error).toBeUndefined();
    expect(area(tShape.rings[0])).toBeCloseTo(45, 6);

    const corner = dissolveRings([box(0, 0), box(4, 0), box(0, 4)]);
    expect(corner.error).toBeUndefined();
    expect(corner.rings).toHaveLength(1);
    expect(area(corner.rings[0])).toBeCloseTo(48, 6);
  });

  it('сохраняет отверстие при растворении границ', () => {
    const result = dissolveRings([[box(0, 0), box(1, 1, 1)]]);
    expect(result.error).toBeUndefined();
    expect(result.rings).toHaveLength(2);
    const areas = result.rings.map(area).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(1, 6);
    expect(areas[1]).toBeCloseTo(16, 6);
  });

  it('не превращает вложенный объект в отверстие', () => {
    // Объект целиком внутри другого при объединении ничего не добавляет.
    const nested = dissolveRings([box(0, 0, 10), box(2, 2, 2)]);
    expect(nested.error).toBeUndefined();
    expect(nested.rings).toHaveLength(1);
    expect(area(nested.rings[0])).toBeCloseTo(100, 6);

    // Остров внутри отверстия остаётся отдельным контуром.
    const island = dissolveRings([[box(0, 0, 10), box(2, 2, 6)], box(4, 4, 2)]);
    expect(island.error).toBeUndefined();
    expect(island.rings).toHaveLength(3);
    const areas = island.rings.map(area).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(4, 6);
    expect(areas[1]).toBeCloseTo(36, 6);
    expect(areas[2]).toBeCloseTo(100, 6);
  });

  it('разводит касание углом на два кольца', () => {
    const touch = dissolveRings([box(0, 0), box(4, 4)]);
    expect(touch.error).toBeUndefined();
    expect(touch.rings).toHaveLength(2);
    expect(touch.rings.every((ring) => ring.length === 4)).toBe(true);
  });

  it('сообщает о наложении и схлопывает совпадающие объекты', () => {
    expect(dissolveRings([box(0, 0), box(2, 2)])).toEqual({ error: 'overlap' });

    const duplicate = dissolveRings([box(0, 0), box(0, 0)]);
    expect(duplicate.error).toBeUndefined();
    expect(duplicate.rings).toHaveLength(1);
    expect(area(duplicate.rings[0])).toBeCloseTo(16, 6);

    expect(dissolveRings([])).toEqual({ error: 'empty' });
  });
});

describe('Operations: вложенность и отверстия', () => {
  it('делит кольца на фигуры с отверстиями', () => {
    const groups = classifyRings([box(0, 0, 10), box(3, 3, 4)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].holes).toHaveLength(1);

    const disjoint = classifyRings([box(0, 0), box(10, 0)]);
    expect(disjoint).toHaveLength(2);
    expect(disjoint.every((group) => group.holes.length === 0)).toBe(true);

    const island = classifyRings([box(0, 0, 20), box(4, 4, 12), box(8, 8, 4)]);
    expect(island).toHaveLength(2);
    expect(island[0].holes).toHaveLength(1);
    expect(island[1].holes).toHaveLength(0);
  });

  it('проверяет корректность отверстия', () => {
    expect(validateHole([box(0, 0, 10)], box(2, 2, 2))).toBeNull();
    expect(validateHole([box(0, 0, 10)], box(20, 20, 2))).toBe('outside');
    expect(validateHole([box(0, 0, 10)], box(8, 2, 3))).toBe('crosses');
    expect(validateHole([box(0, 0, 10)], [])).toBe('empty');
  });
});
