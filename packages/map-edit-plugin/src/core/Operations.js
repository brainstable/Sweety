/**
 * Планарные операции над геометрией: разрезание линией, объединение по общим
 * границам, вложенность колец и отверстия.
 *
 * Модуль ничего не знает о карте и о слоях: все функции работают с массивами
 * `{x, y}` в одной плоскостной системе координат (плагин передаёт сюда
 * `map.project`, чтобы операции не зависели от широты). Это делает их
 * тестируемыми без карты и предсказуемыми на любом зуме.
 *
 * @module Operations
 */

const EPSILON = 1e-9;

/** @typedef {{x: number, y: number}} XY */
/** @typedef {XY[]} XYRing */

/**
 * Пересечение двух отрезков. Возвращает параметры `t` и `u` вдоль первого и
 * второго отрезка и точку пересечения. Параллельные и коллинеарные отрезки
 * пересечением не считаются: для разрезания и объединения важны только
 * настоящие пересечения.
 * @param {XY} p1
 * @param {XY} p2
 * @param {XY} p3
 * @param {XY} p4
 * @returns {{t: number, u: number, point: XY}|null}
 */
export function segmentIntersection(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denominator = d1x * d2y - d1y * d2x;
  if (Math.abs(denominator) <= EPSILON) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denominator;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denominator;
  return {
    t,
    u,
    point: { x: p1.x + t * d1x, y: p1.y + t * d1y },
  };
}

/**
 * Попадание точки внутрь кольца (правило чётности).
 * @param {XY} point
 * @param {XYRing} ring
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
 * Площадь кольца по формуле шнуровки (без знака).
 * @param {XYRing} ring
 * @returns {number}
 */
export function ringArea(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    area += (ring[j].x + ring[i].x) * (ring[j].y - ring[i].y);
  }
  return Math.abs(area / 2);
}

/**
 * Точка, гарантированно лежащая внутри кольца. Нужна для проверки вложенности:
 * центроид вершин может оказаться снаружи у вогнутой фигуры, поэтому при
 * неудаче перебираются середины рёбер со сдвигом по нормали.
 * @param {XYRing} ring
 * @returns {XY|null}
 */
export function interiorPoint(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  let sumX = 0;
  let sumY = 0;
  for (const point of ring) {
    sumX += point.x;
    sumY += point.y;
  }
  const centroid = { x: sumX / ring.length, y: sumY / ring.length };
  if (pointInRing(centroid, ring)) return centroid;

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
    for (const scale of [1e-3, 1e-2, 0.1, 1]) {
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
 * Точка у самой границы кольца, но внутри него. В отличие от центроида такая
 * точка не попадает в собственные отверстия, поэтому по ней корректно
 * считается вложенность: кольцо лежит внутри только у своих контейнеров.
 * @param {XYRing} ring
 * @returns {XY|null}
 */
export function ringProbePoint(ring) {
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
  return interiorPoint(ring);
}

/**
 * Проверяет, что кольцо `inner` лежит внутри `outer`.
 * @param {XYRing} outer
 * @param {XYRing} inner
 * @returns {boolean}
 */
export function ringContainsRing(outer, inner) {
  const point = ringProbePoint(inner);
  return Boolean(point && pointInRing(point, outer));
}

/**
 * Глубина вложенности кольца: 0 — внешнее, 1 — отверстие, 2 — остров внутри
 * отверстия и далее. Считается по чётности числа контейнеров.
 * @param {XYRing[]} rings
 * @returns {number[]}
 */
export function ringDepths(rings) {
  const points = rings.map((ring) => ringProbePoint(ring));
  return rings.map((ring, index) => {
    const point = points[index];
    if (!point) return 0;
    let depth = 0;
    rings.forEach((other, otherIndex) => {
      if (otherIndex === index) return;
      if (pointInRing(point, other)) depth += 1;
    });
    return depth;
  });
}

/**
 * Разбирает набор колец на отдельные фигуры: внешнее кольцо и его отверстия.
 * Используется при разъединении мультиобъекта и при экспорте GeoJSON.
 * @param {XYRing[]} rings
 * @returns {Array<{outer: XYRing, holes: XYRing[], depth: number}>}
 */
export function classifyRings(rings) {
  if (!Array.isArray(rings) || !rings.length) return [];
  const points = rings.map((ring) => ringProbePoint(ring));
  const depths = rings.map((ring, index) => {
    const point = points[index];
    if (!point) return 0;
    let depth = 0;
    rings.forEach((other, otherIndex) => {
      if (otherIndex === index) return;
      if (pointInRing(point, other)) depth += 1;
    });
    return depth;
  });

  const groups = [];
  rings.forEach((ring, index) => {
    if (depths[index] % 2 === 0) {
      groups.push({ outer: ring, holes: [], depth: depths[index], index });
    }
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

/**
 * Проверяет, что из кольца получится корректное отверстие: оно лежит внутри
 * полигона и не пересекает его границы.
 * @param {XYRing[]} rings кольца полигона
 * @param {XYRing} hole новое отверстие
 * @returns {'empty'|'self-intersection'|'outside'|'crosses'|null} причина отказа
 */
export function validateHole(rings, hole) {
  if (!Array.isArray(hole) || hole.length < 3) return 'empty';
  if (!pointInPolygonRings(interiorPoint(hole) || hole[0], rings)) return 'outside';

  for (let index = 0; index < hole.length; index += 1) {
    const start = hole[index];
    const end = hole[(index + 1) % hole.length];
    if (Math.hypot(end.x - start.x, end.y - start.y) <= EPSILON) continue;
    for (const ring of rings) {
      for (let edge = 0; edge < ring.length; edge += 1) {
        const otherStart = ring[edge];
        const otherEnd = ring[(edge + 1) % ring.length];
        const hit = segmentIntersection(start, end, otherStart, otherEnd);
        if (!hit) continue;
        const inside = (value) => value > 1e-6 && value < 1 - 1e-6;
        if (inside(hit.t) && inside(hit.u)) return 'crosses';
      }
    }
  }
  return null;
}

/**
 * Попадание точки в полигон по правилу чётности для всех его колец.
 * @param {XY|XYRing} point
 * @param {XYRing[]} rings
 * @returns {boolean}
 */
export function pointInPolygonRings(point, rings) {
  const target = Array.isArray(point) ? point[0] : point;
  if (!target) return false;
  let inside = false;
  for (const ring of rings) {
    if (pointInRing(target, ring)) inside = !inside;
  }
  return inside;
}

/**
 * Путь по режущей линии между двумя пересечениями. Возвращает точки линии без
 * дублей концов: первая и последняя точка — сами пересечения.
 * @param {XYRing} cutter
 * @param {{seg: number, u: number, point: XY}} from
 * @param {{seg: number, u: number, point: XY}} to
 * @returns {XY[]}
 */
function cutterPath(cutter, from, to) {
  const path = [from.point];
  if (from.seg < to.seg || (from.seg === to.seg && from.u <= to.u)) {
    for (let index = from.seg + 1; index <= to.seg; index += 1) path.push(cutter[index]);
  } else {
    for (let index = from.seg; index > to.seg; index -= 1) path.push(cutter[index]);
  }
  path.push(to.point);
  return path;
}

/**
 * Расстояние от точки до отрезка.
 * @param {XY} point
 * @param {XY} start
 * @param {XY} end
 * @returns {number}
 */
function distanceToSegmentXY(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.min(
    1,
    Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

/**
 * Знак, с какой стороны от прямой `a → b` лежит точка.
 * @param {XY} point
 * @param {XY} a
 * @param {XY} b
 * @returns {-1|0|1}
 */
function sideOfLine(point, a, b) {
  const value = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
  if (Math.abs(value) <= EPSILON) return 0;
  return value > 0 ? 1 : -1;
}

/**
 * Ближайший отрезок режущей линии к точке.
 * @param {XYRing} cutter
 * @param {XY} point
 * @returns {{seg: number, distance: number}|null}
 */
function nearestCutterSegment(cutter, point) {
  let best = null;
  for (let seg = 0; seg < cutter.length - 1; seg += 1) {
    const distance = distanceToSegmentXY(point, cutter[seg], cutter[seg + 1]);
    if (!best || distance < best.distance) best = { seg, distance };
  }
  return best;
}

/**
 * Все пересечения замкнутого кольца с открытой линией, включая проход через
 * вершину кольца. Касание вершины (кольцо лежит по одну сторону линии) не
 * считается пересечением: такой разрез ничего не делит.
 * @param {XYRing} ring
 * @param {XYRing} cutter
 * @returns {Array<{edge: number, t: number, seg: number, u: number, point: XY, vertex?: boolean}>}
 */
function ringCrossings(ring, cutter) {
  const crossings = [];
  for (let edge = 0; edge < ring.length; edge += 1) {
    const start = ring[edge];
    const end = ring[(edge + 1) % ring.length];
    for (let seg = 0; seg < cutter.length - 1; seg += 1) {
      const hit = segmentIntersection(start, end, cutter[seg], cutter[seg + 1]);
      if (!hit) continue;
      // Пересечение ровно в вершине кольца обрабатывается ниже, отдельно.
      if (hit.t <= 1e-9 || hit.t >= 1 - 1e-9) continue;
      if (hit.u < -1e-9 || hit.u > 1 + 1e-9) continue;
      const duplicate = crossings.some(
        (item) => Math.hypot(item.point.x - hit.point.x, item.point.y - hit.point.y) <= 1e-9,
      );
      if (duplicate) continue;
      crossings.push({
        edge,
        t: hit.t,
        seg,
        u: Math.min(1, Math.max(0, hit.u)),
        point: hit.point,
      });
    }
  }

  // Проход через вершину: линия должна пересекать её насквозь, а не касаться.
  for (let index = 0; index < ring.length; index += 1) {
    const point = ring[index];
    const near = nearestCutterSegment(cutter, point);
    if (!near || near.distance > 1e-6) continue;
    const previous = ring[(index - 1 + ring.length) % ring.length];
    const next = ring[(index + 1) % ring.length];
    const start = cutter[near.seg];
    const end = cutter[near.seg + 1];
    const sidePrevious = sideOfLine(previous, start, end);
    const sideNext = sideOfLine(next, start, end);
    if (sidePrevious === 0 || sideNext === 0 || sidePrevious === sideNext) continue;
    const duplicate = crossings.some(
      (item) => Math.hypot(item.point.x - point.x, item.point.y - point.y) <= 1e-9,
    );
    if (duplicate) continue;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const u =
      lengthSquared <= EPSILON
        ? 0
        : Math.min(
            1,
            Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
          );
    crossings.push({
      edge: index,
      t: 0,
      seg: near.seg,
      u,
      point: { x: point.x, y: point.y },
      vertex: true,
    });
  }

  crossings.sort((a, b) => a.edge - b.edge || a.t - b.t);
  return crossings;
}

/**
 * Число пересечений кольца с линией. Плагин использует его для диагностики.
 * @param {XYRing} ring
 * @param {XYRing} cutter
 * @returns {number}
 */
export function countCrossings(ring, cutter) {
  return ringCrossings(ring, cutter).length;
}

/**
 * Разрезает замкнутое кольцо открытой линией на две части.
 *
 * Линия должна пересекать кольцо ровно в двух точках — это обычный разрез
 * «насквозь». В результате получаются два замкнутых кольца: дуга исходной
 * границы плюс отрезок разреза.
 *
 * @param {XYRing} ring
 * @param {XYRing} cutter
 * @returns {{rings: [XYRing, XYRing]}|null}
 */
export function splitRingByLine(ring, cutter) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  if (!Array.isArray(cutter) || cutter.length < 2) return null;
  const crossings = ringCrossings(ring, cutter);
  if (crossings.length !== 2) return null;

  const [first, second] = crossings;
  const augmented = [];
  /** @type {Map<object, number>} */
  const positions = new Map();
  for (let edge = 0; edge < ring.length; edge += 1) {
    augmented.push(ring[edge]);
    // Пересечение ровно в вершине: точка уже есть в кольце, дублировать не нужно.
    const atVertex = crossings.find((item) => item.vertex && item.edge === edge);
    if (atVertex) positions.set(atVertex, augmented.length - 1);
    const onEdge = crossings.filter((item) => !item.vertex && item.edge === edge);
    for (const item of onEdge) {
      positions.set(item, augmented.length);
      augmented.push(item.point);
    }
  }

  const start = positions.get(first);
  const end = positions.get(second);
  if (start === undefined || end === undefined || start === end) return null;

  const arcForward = augmented.slice(start, end + 1);
  const arcBackward = [...augmented.slice(end), ...augmented.slice(0, start + 1)];

  const returnPath = cutterPath(cutter, second, first);
  const forwardPath = cutterPath(cutter, first, second);

  const firstRing = [...arcForward, ...returnPath.slice(1, -1)];
  const secondRing = [...arcBackward, ...forwardPath.slice(1, -1)];
  if (firstRing.length < 3 || secondRing.length < 3) return null;
  return { rings: [firstRing, secondRing] };
}

/**
 * Пересечения внешнего кольца, упорядоченные вдоль режущей линии.
 * @param {XYRing} ring
 * @param {XYRing} cutter
 * @returns {Array<{edge: number, t: number, seg: number, u: number, point: XY}>}
 */
function cutterOrderedCrossings(ring, cutter) {
  return ringCrossings(ring, cutter).sort((a, b) => a.seg - b.seg || a.u - b.u);
}

/**
 * Середина пути — точка, по которой ищется часть, которую надо разрезать.
 * @param {XY[]} path
 * @returns {XY}
 */
function pathMidpoint(path) {
  const index = Math.max(0, Math.floor((path.length - 1) / 2));
  const start = path[index];
  const end = path[index + 1] || path[index];
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

/**
 * Разрезает одну часть (внешнее кольцо и отверстия) путём, который пересекает
 * её внешнее кольцо ровно дважды. Отверстия, задетые разрезом, тоже делятся
 * пополам и попадают в ту часть, внутри которой оказалась половина.
 * @param {XYRing[]} rings кольца полигона; первое — внешнее
 * @param {XYRing} cutter
 * @returns {[XYRing[], XYRing[]]|null}
 */
function splitPartByPath(rings, cutter) {
  const outerSplit = splitRingByLine(rings[0], cutter);
  if (!outerSplit) return null;
  const parts = [[outerSplit.rings[0]], [outerSplit.rings[1]]];

  for (let index = 1; index < rings.length; index += 1) {
    const hole = rings[index];
    const holeSplit = splitRingByLine(hole, cutter);
    const candidates = holeSplit ? holeSplit.rings : [hole];
    for (const candidate of candidates) {
      const point = interiorPoint(candidate);
      if (!point) {
        // Не удалось найти внутреннюю точку — относим отверстие к первой части.
        parts[0].push(candidate);
        continue;
      }
      const target = pointInRing(point, parts[0][0]) ? parts[0] : parts[1];
      target.push(candidate);
    }
  }
  return parts;
}

/**
 * Разрезает полигон линией. Пара пересечений с внешним кольцом — обычный
 * разрез на две части. Если линия пересекает кольцо несколько раз (зигзаг),
 * пары пересечений вдоль линии применяются по очереди, и полигон делится на
 * несколько частей.
 * @param {XYRing[]} rings кольца полигона; первое — внешнее
 * @param {XYRing} cutter
 * @returns {Array<XYRing[]>|null}
 */
export function splitPolygonByLine(rings, cutter) {
  if (!Array.isArray(rings) || !rings.length) return null;
  if (!Array.isArray(cutter) || cutter.length < 2) return null;
  const crossings = cutterOrderedCrossings(rings[0], cutter);
  if (crossings.length < 2 || crossings.length % 2 !== 0) return null;

  if (crossings.length === 2) {
    return splitPartByPath(rings, cutterPath(cutter, crossings[0], crossings[1]));
  }

  /** @type {Array<XYRing[]>} */
  let parts = [rings.map((ring) => ring.map((point) => ({ x: point.x, y: point.y })))];
  for (let index = 0; index + 1 < crossings.length; index += 2) {
    const path = cutterPath(cutter, crossings[index], crossings[index + 1]);
    const middle = pathMidpoint(path);
    const target = parts.findIndex((part) => pointInPolygonRings(middle, part));
    if (target === -1) return null;
    const split = splitPartByPath(parts[target], path);
    if (!split) return null;
    parts = [...parts.slice(0, target), split[0], split[1], ...parts.slice(target + 1)];
  }
  return parts;
}

/**
 * Разрезает части незамкнутой линии (полилинии) секущей.
 * @param {XYRing[]} parts
 * @param {XYRing} cutter
 * @returns {XYRing[]|null} новые части или `null`, если разрез не задел линию
 */
export function splitPolylineByLine(parts, cutter) {
  if (!Array.isArray(parts) || !parts.length) return null;
  if (!Array.isArray(cutter) || cutter.length < 2) return null;
  const result = [];
  let changed = false;

  for (const part of parts) {
    if (!Array.isArray(part) || part.length < 2) continue;
    const cuts = [];
    for (let edge = 0; edge < part.length - 1; edge += 1) {
      for (let seg = 0; seg < cutter.length - 1; seg += 1) {
        const hit = segmentIntersection(part[edge], part[edge + 1], cutter[seg], cutter[seg + 1]);
        if (!hit) continue;
        if (hit.t <= 1e-9 || hit.t >= 1 - 1e-9) continue;
        if (hit.u < -1e-9 || hit.u > 1 + 1e-9) continue;
        const duplicate = cuts.some(
          (item) => Math.hypot(item.point.x - hit.point.x, item.point.y - hit.point.y) <= 1e-9,
        );
        if (duplicate) continue;
        cuts.push({ edge, t: hit.t, point: hit.point });
      }
    }
    if (!cuts.length) {
      result.push(part);
      continue;
    }
    changed = true;
    cuts.sort((a, b) => a.edge - b.edge || a.t - b.t);
    let current = [part[0]];
    let cursor = 0;
    for (const cut of cuts) {
      for (let index = cursor + 1; index <= cut.edge; index += 1) current.push(part[index]);
      current.push(cut.point);
      result.push(current);
      current = [cut.point];
      cursor = cut.edge;
    }
    for (let index = cursor + 1; index < part.length; index += 1) current.push(part[index]);
    result.push(current);
  }

  if (!changed) return null;
  return result.filter((part) => part.length >= 2);
}

/**
 * Объединяет полигоны по общим границам (операция dissolve): общие участки
 * границ взаимно уничтожаются, из оставшихся рёбер собираются новые кольца.
 *
 * Полигоны передаются группами колец, первое кольцо — внешнее. Это важно:
 * объект, целиком лежащий внутри другого, не должен превращаться в отверстие —
 * его контур отбрасывается, потому что заливка есть с обеих сторон. Плоский
 * список колец тоже принимается: каждое кольцо считается отдельным полигоном.
 *
 * Подходит именно для примыкающих объектов. Если полигоны накладываются друг
 * на друга (их границы пересекаются), вернётся `{ error: 'overlap' }`: такой
 * случай требует логических операций над областями, а не растворения границ.
 *
 * @param {XYRing[]|XYRing[][]} polygons кольца объединяемых полигонов
 * @param {{tolerance?: number}} [options]
 * @returns {{rings: XYRing[], error?: undefined}|{error: 'overlap'|'open-boundary'|'empty'}}
 */
export function dissolveRings(polygons, options = {}) {
  const tolerance = Number(options.tolerance) > 0 ? Number(options.tolerance) : 1e-6;
  const cellSize = Math.max(tolerance, 1e-9);
  const groups = normalizePolygons(polygons);
  const rings = groups.flat();
  if (!rings.length) return { error: 'empty' };
  /** @type {XY[]} */
  const vertices = [];
  /** @type {Map<string, number[]>} */
  const grid = new Map();

  /**
   * Приводит координату к общему индексу вершины: общая граница у разных
   * объектов должна стать одним и тем же ребром.
   * @param {XY} point
   * @returns {number}
   */
  const vertexId = (point) => {
    const cx = Math.round(point.x / cellSize);
    const cy = Math.round(point.y / cellSize);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const bucket = grid.get(`${cx + dx}:${cy + dy}`);
        if (!bucket) continue;
        for (const id of bucket) {
          const candidate = vertices[id];
          if (Math.hypot(candidate.x - point.x, candidate.y - point.y) <= tolerance) return id;
        }
      }
    }
    const id = vertices.length;
    vertices.push({ x: point.x, y: point.y });
    const key = `${cx}:${cy}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(id);
    else grid.set(key, [id]);
    return id;
  };

  const idRings = rings
    .map((ring) => (Array.isArray(ring) ? ring.map(vertexId) : []))
    .filter((ring) => ring.length >= 3);
  if (!idRings.length) return { error: 'empty' };

  /** @type {Array<{a: number, b: number, ring: number}>} */
  const edges = [];
  idRings.forEach((ring, ringIndex) => {
    for (let index = 0; index < ring.length; index += 1) {
      const a = ring[index];
      const b = ring[(index + 1) % ring.length];
      if (a === b) continue;
      edges.push({ a, b, ring: ringIndex });
    }
  });

  const isInner = (value) => value > 1e-6 && value < 1 - 1e-6;

  // Наложение полигонов растворением границ не решается — сообщаем об этом.
  for (let first = 0; first < edges.length; first += 1) {
    for (let second = first + 1; second < edges.length; second += 1) {
      if (edges[first].ring === edges[second].ring) continue;
      const hit = segmentIntersection(
        vertices[edges[first].a],
        vertices[edges[first].b],
        vertices[edges[second].a],
        vertices[edges[second].b],
      );
      if (hit && isInner(hit.t) && isInner(hit.u)) return { error: 'overlap' };
    }
  }

  // T-образные стыки: вершина одного полигона делит ребро другого.
  const splitEdges = [];
  for (const edge of edges) {
    const start = vertices[edge.a];
    const end = vertices[edge.b];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= EPSILON) continue;
    const splits = [];
    for (let id = 0; id < vertices.length; id += 1) {
      if (id === edge.a || id === edge.b) continue;
      const point = vertices[id];
      const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
      if (t <= 1e-9 || t >= 1 - 1e-9) continue;
      const projection = { x: start.x + t * dx, y: start.y + t * dy };
      if (Math.hypot(point.x - projection.x, point.y - projection.y) > tolerance) continue;
      splits.push({ id, t });
    }
    splits.sort((a, b) => a.t - b.t);
    let previous = edge.a;
    for (const split of splits) {
      splitEdges.push({ a: previous, b: split.id, ring: edge.ring });
      previous = split.id;
    }
    splitEdges.push({ a: previous, b: edge.b, ring: edge.ring });
  }

  // Общие рёбра встречаются в двух направлениях — они и есть внутренняя граница.
  /** @type {Map<string, Array<{a: number, b: number}>>} */
  const byPair = new Map();
  for (const edge of splitEdges) {
    const key = edge.a > edge.b ? `${edge.b}|${edge.a}` : `${edge.a}|${edge.b}`;
    const bucket = byPair.get(key);
    if (bucket) bucket.push(edge);
    else byPair.set(key, [edge]);
  }

  /** @type {Array<{a: number, b: number}>} */
  const boundary = [];
  for (const bucket of byPair.values()) {
    const forward = bucket.filter((edge) => edge.a < edge.b);
    const backward = bucket.filter((edge) => edge.a > edge.b);
    const difference = forward.length - backward.length;
    if (difference === 0) continue;
    // Ребро границы нужно один раз: дубликаты в одном направлении — это
    // наложившиеся друг на друга объекты, а не два разных участка границы.
    boundary.push(difference > 0 ? forward[0] : backward[0]);
  }
  if (!boundary.length) return { error: 'empty' };

  /** @type {Map<number, Array<{to: number, used: boolean}>>} */
  const outgoing = new Map();
  for (const edge of boundary) {
    const bucket = outgoing.get(edge.a);
    const item = { to: edge.b, used: false };
    if (bucket) bucket.push(item);
    else outgoing.set(edge.a, [item]);
  }

  /**
   * Следующее ребро на развилке: максимальный поворот по часовой стрелке, чтобы
   * контур обходил свою область и не «перепрыгивал» на соседнюю.
   * @param {number} vertex
   * @param {number} previous
   * @param {Array<{to: number, used: boolean}>} candidates
   * @returns {{to: number, used: boolean}|null}
   */
  const chooseNext = (vertex, previous, candidates) => {
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];
    const from = vertices[previous];
    const at = vertices[vertex];
    const incoming = Math.atan2(at.y - from.y, at.x - from.x);
    let best = null;
    let bestTurn = -Infinity;
    for (const candidate of candidates) {
      const to = vertices[candidate.to];
      const outgoingAngle = Math.atan2(to.y - at.y, to.x - at.x);
      let turn = incoming - outgoingAngle;
      turn = ((turn + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (turn > bestTurn) {
        bestTurn = turn;
        best = candidate;
      }
    }
    return best;
  };

  /** @type {number[][]} */
  const loops = [];
  for (const [start, bucket] of outgoing) {
    for (const first of bucket) {
      if (first.used) continue;
      first.used = true;
      const loop = [start];
      let current = first.to;
      let previous = start;
      let guard = 0;
      while (current !== start) {
        loop.push(current);
        guard += 1;
        if (guard > boundary.length + 4) return { error: 'open-boundary' };
        const candidates = (outgoing.get(current) || []).filter((item) => !item.used);
        const next = chooseNext(current, previous, candidates);
        if (!next) return { error: 'open-boundary' };
        next.used = true;
        previous = current;
        current = next.to;
      }
      if (loop.length >= 3) loops.push(loop);
    }
  }
  if (!loops.length) return { error: 'open-boundary' };

  // Петля, проходящая через одну вершину дважды, — это два объекта, касающихся
  // углом: разводим их, чтобы кольца не оказались самокасающимися.
  const simpleLoops = loops.flatMap((loop) => splitLoopAtRepeatedVertices(loop));
  const loopsXY = simpleLoops.map((loop) =>
    loop.map((id) => ({ x: vertices[id].x, y: vertices[id].y })),
  );
  const boundaryLoops = loopsXY.filter((loop) => isBoundaryLoop(loop, groups));
  if (!boundaryLoops.length) return { error: 'empty' };

  const classified = classifyRings(boundaryLoops);
  /** @type {XYRing[]} */
  const ordered = [];
  for (const group of classified) {
    ordered.push(group.outer);
    for (const hole of group.holes) ordered.push(hole);
  }
  return { rings: ordered };
}

/**
 * Приводит вход к списку полигонов. Каждый полигон — массив колец, где первое
 * кольцо внешнее. Плоский список колец трактуется как набор односвязных
 * полигонов, поэтому обе формы записи допустимы.
 * @param {XYRing[]|XYRing[][]} input
 * @returns {XYRing[][]}
 */
function normalizePolygons(input) {
  if (!Array.isArray(input)) return [];
  /** @type {XYRing[][]} */
  const polygons = [];
  for (const item of input) {
    if (!Array.isArray(item) || !item.length) continue;
    if (Array.isArray(item[0])) {
      const rings = item.filter((ring) => Array.isArray(ring) && ring.length >= 3);
      if (rings.length) polygons.push(rings);
      continue;
    }
    const point = item[0];
    if (point && typeof point.x === 'number' && typeof point.y === 'number' && item.length >= 3) {
      polygons.push([item]);
    }
  }
  return polygons;
}

/**
 * Лежит ли точка внутри объединения исходных полигонов.
 * @param {XYRing[][]} groups
 * @param {XY} point
 * @returns {boolean}
 */
function pointInPolygons(groups, point) {
  for (const rings of groups) {
    if (pointInPolygonRings(point, rings)) return true;
  }
  return false;
}

/**
 * Настоящая ли граница у петли. Петля, целиком лежащая внутри заливки, границей
 * не является: у неё заливка с обеих сторон, и её нужно отбросить (например,
 * контур объекта, который целиком находится внутри другого объединённого).
 * @param {XYRing} loop
 * @param {XYRing[][]} groups исходные полигоны
 * @returns {boolean}
 */
function isBoundaryLoop(loop, groups) {
  if (!Array.isArray(loop) || loop.length < 3) return false;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of loop) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const diagonal = Math.hypot(maxX - minX, maxY - minY) || 1;

  let tested = 0;
  let boundaries = 0;
  const limit = Math.min(loop.length, 64);
  for (let index = 0; index < limit; index += 1) {
    const start = loop[index];
    const end = loop[(index + 1) % loop.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= EPSILON) continue;
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const normalX = -dy / length;
    const normalY = dx / length;
    const distance = Math.max(1e-9, Math.min(length, diagonal) * 1e-4);
    const left = { x: midX + normalX * distance, y: midY + normalY * distance };
    const right = { x: midX - normalX * distance, y: midY - normalY * distance };
    tested += 1;
    if (pointInPolygons(groups, left) !== pointInPolygons(groups, right)) boundaries += 1;
  }
  if (!tested) return false;
  // У настоящей границы почти все рёбра разделяют заливку; у внутренней петли
  // не разделяет ни одно. Порог в половину рёбер устойчив к численному шуму.
  return boundaries * 2 >= tested;
}

/**
 * Разводит петлю, проходящую через вершину дважды, на простые петли. Так
 * полигоны, касающиеся углом, остаются двумя кольцами, а не одним
 * самокасающимся контуром.
 * @param {number[]} loop индексы вершин
 * @returns {number[][]}
 */
function splitLoopAtRepeatedVertices(loop) {
  /** @type {number[][]} */
  const result = [];
  /** @type {number[][]} */
  const queue = [loop];
  let guard = 0;
  while (queue.length) {
    guard += 1;
    const current = queue.pop();
    if (guard > 64 || !current || current.length < 3) continue;
    /** @type {Map<number, number>} */
    const seen = new Map();
    let start = -1;
    let end = -1;
    for (let index = 0; index < current.length; index += 1) {
      const id = current[index];
      const previous = seen.get(id);
      if (previous === undefined) {
        seen.set(id, index);
        continue;
      }
      start = previous;
      end = index;
      break;
    }
    if (start === -1) {
      result.push(current);
      continue;
    }
    const firstPart = current.slice(start, end);
    const secondPart = [...current.slice(end), ...current.slice(0, start)];
    if (firstPart.length >= 3) queue.push(firstPart);
    if (secondPart.length >= 3) queue.push(secondPart);
    if (firstPart.length < 3 && secondPart.length < 3) result.push(current);
  }
  return result;
}
