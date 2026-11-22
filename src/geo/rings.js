/**
 * Вложенность колец полигона.
 *
 * Набор колец в `Polygon` хранится плоско: внешние контуры и отверстия лежат в
 * одном массиве, а заливка работает по правилу чётности. Для GeoJSON такого
 * набора недостаточно: у `Polygon` внешний контур ровно один, остальные кольца —
 * его отверстия, а несколько несвязанных контуров описываются `MultiPolygon`.
 * Поэтому при экспорте кольца группируются по вложенности: кольцо чётной
 * глубины — внешнее, нечётной — отверстие ближайшего внешнего.
 *
 * Точки задаются в любых плоскостных координатах (обычно `{x: lng, y: lat}`):
 * классификации важна только взаимная вложенность, а не метрика.
 *
 * @module geo/rings
 */

const EPSILON = 1e-12;

/**
 * Попадание точки внутрь кольца (правило чётности).
 * @param {{x: number, y: number}} point
 * @param {Array<{x: number, y: number}>} ring
 * @returns {boolean}
 */
export function pointInRing(point, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Точка у самой границы кольца, но внутри него. Такая точка не попадает в
 * собственные отверстия, поэтому по ней корректно считается вложенность.
 * @param {Array<{x: number, y: number}>} ring
 * @returns {{x: number, y: number}|null}
 */
export function probePoint(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= EPSILON) continue;
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const normalX = -dy / length;
    const normalY = dx / length;
    for (const scale of [1e-4, 1e-3, 1e-2]) {
      for (const sign of [1, -1]) {
        const offset = length * scale * sign;
        const candidate = { x: midX + normalX * offset, y: midY + normalY * offset };
        if (pointInRing(candidate, ring)) return candidate;
      }
    }
  }
  return null;
}

/**
 * Группирует кольца в фигуры «внешнее кольцо + его отверстия».
 * @param {Array<Array<{x: number, y: number}>>} rings
 * @returns {Array<{outer: Array<{x: number, y: number}>, holes: Array<Array<{x: number, y: number}>>}>}
 */
export function groupRings(rings) {
  if (!Array.isArray(rings) || !rings.length) return [];
  const points = rings.map((ring) => probePoint(ring));
  const depths = rings.map((ring, index) => {
    const point = points[index];
    if (!point) return 0;
    let depth = 0;
    rings.forEach((other, otherIndex) => {
      if (otherIndex !== index && pointInRing(point, other)) depth += 1;
    });
    return depth;
  });

  const groups = [];
  rings.forEach((ring, index) => {
    if (depths[index] % 2 === 0)
      groups.push({ outer: ring, holes: [], depth: depths[index], index });
  });

  rings.forEach((ring, index) => {
    if (depths[index] % 2 === 0 || !points[index]) return;
    let parent = null;
    for (const group of groups) {
      if (group.index === index) continue;
      if (!pointInRing(points[index], rings[group.index])) continue;
      if (!parent || group.depth > parent.depth) parent = group;
    }
    if (parent) parent.holes.push(ring);
  });

  return groups.map(({ outer, holes }) => ({ outer, holes }));
}

export default groupRings;
