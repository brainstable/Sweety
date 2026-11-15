import { Bounds, LatLng, Point } from 'sweety-map';

/**
 * Геометрические утилиты плагина. Работают с публичным API слоёв Sweety и не
 * импортируют внутренние поля ядра, кроме общедоступных `getLatLngs`,
 * `getLatLng`, `getRadius`, `getBounds`.
 *
 * @module GeometryUtils
 */

const EPSILON = 1e-9;

/** @typedef {'marker'|'circle'|'rectangle'|'polyline'|'polygon'|'group'} GeometryKind */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLatLngLike(value) {
  return (
    value instanceof LatLng ||
    (Array.isArray(value) &&
      value.length >= 2 &&
      typeof value[0] === 'number' &&
      typeof value[1] === 'number') ||
    (value !== null &&
      typeof value === 'object' &&
      'lat' in value &&
      'lng' in value &&
      Number.isFinite(/** @type {{lat:number}} */ (value).lat) &&
      Number.isFinite(/** @type {{lng:number}} */ (value).lng))
  );
}

/**
 * Определяет тип геометрии по публичному API слоя. Порядок проверок важен:
 * круг и прямоугольник тоже являются путями.
 * @param {any} layer
 * @returns {GeometryKind|null}
 */
export function getLayerKind(layer) {
  if (!layer || typeof layer !== 'object') return null;

  if (typeof layer.eachLayer === 'function' && typeof layer.getLayers === 'function') {
    return 'group';
  }
  if (typeof layer.getRadius === 'function' && typeof layer.getLatLng === 'function') {
    return 'circle';
  }
  if (typeof layer.setBounds === 'function' && typeof layer.getBounds === 'function') {
    return 'rectangle';
  }
  if (typeof layer.getLatLng === 'function' && typeof layer.setLatLng === 'function') {
    return 'marker';
  }
  if (typeof layer.getLatLngs === 'function') {
    const geoJSON = safeGeoJSON(layer);
    const type = geoJSON?.geometry?.type;
    if (type === 'Polygon' || type === 'MultiPolygon') return 'polygon';
    if (type === 'LineString' || type === 'MultiLineString') return 'polyline';
    // Фолбэк для совместимых слоёв без toGeoJSON.
    return layer.options?.fill ? 'polygon' : 'polyline';
  }
  return null;
}

/**
 * @param {any} layer
 * @returns {boolean}
 */
export function isEditableLayer(layer) {
  return getLayerKind(layer) !== null;
}

/**
 * @param {any} layer
 * @returns {boolean}
 */
export function isGroupLayer(layer) {
  return getLayerKind(layer) === 'group';
}

/** @param {any} layer */
function safeGeoJSON(layer) {
  if (typeof layer.toGeoJSON !== 'function') return null;
  try {
    return layer.toGeoJSON();
  } catch {
    return null;
  }
}

/**
 * @param {LatLng|number[]|{lat:number,lng:number}} latlng
 * @returns {LatLng}
 */
export function cloneLatLng(latlng) {
  return new LatLng(latlng);
}

/**
 * Глубокая копия вложенного массива координат.
 * @param {any} latlngs
 * @returns {any}
 */
export function cloneLatLngs(latlngs) {
  if (!Array.isArray(latlngs)) return latlngs;
  return latlngs.map((item) => (Array.isArray(item) ? cloneLatLngs(item) : cloneLatLng(item)));
}

/**
 * Возвращает кольца геометрии в едином формате `LatLng[][]`.
 * @param {any} layer
 * @returns {LatLng[][]}
 */
export function getRings(layer) {
  const kind = getLayerKind(layer);
  if (kind === 'rectangle') {
    const bounds = layer.getBounds();
    if (!bounds || !bounds.isValid()) return [];
    return [boundsToRing(bounds)];
  }
  if (kind !== 'polyline' && kind !== 'polygon') return [];
  const raw = layer.getLatLngs();
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (isLatLngLike(raw[0])) return [raw];
  return raw.filter((ring) => Array.isArray(ring));
}

/**
 * Углы прямоугольника в порядке SW, SE, NE, NW.
 * @param {Bounds} bounds
 * @returns {LatLng[]}
 */
export function boundsToRing(bounds) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  if (!sw || !ne) return [];
  return [
    new LatLng(sw.lat, sw.lng),
    new LatLng(sw.lat, ne.lng),
    new LatLng(ne.lat, ne.lng),
    new LatLng(ne.lat, sw.lng),
  ];
}

/**
 * Все вершины слоя, включая углы прямоугольника и центр круга.
 * @param {any} layer
 * @returns {LatLng[]}
 */
export function getLayerVertices(layer) {
  const kind = getLayerKind(layer);
  if (kind === 'group') {
    const result = [];
    layer.eachLayer((child) => result.push(...getLayerVertices(child)));
    return result;
  }
  if (kind === 'marker') return [cloneLatLng(layer.getLatLng())];
  if (kind === 'circle') {
    const center = layer.getLatLng();
    const edge = pointAtDistance(center, layer.getRadius(), 90);
    return [cloneLatLng(center), edge];
  }
  if (kind === 'rectangle') return getRings(layer)[0]?.map(cloneLatLng) ?? [];
  const rings = getRings(layer);
  return rings.flatMap((ring) => ring.map(cloneLatLng));
}

/**
 * Снимок геометрии для Command/undo-redo. Снимки не содержат DOM-ссылок.
 * @param {any} layer
 * @returns {object|null}
 */
export function snapshotGeometry(layer) {
  const kind = getLayerKind(layer);
  if (!kind) return null;
  if (kind === 'group') {
    return {
      kind,
      children: layer
        .getLayers()
        .map((child) => snapshotGeometry(child))
        .filter(Boolean),
    };
  }
  if (kind === 'marker') {
    return { kind, latlng: cloneLatLng(layer.getLatLng()) };
  }
  if (kind === 'circle') {
    return {
      kind,
      latlng: cloneLatLng(layer.getLatLng()),
      radius: layer.getRadius(),
    };
  }
  if (kind === 'rectangle') {
    return { kind, bounds: layer.getBounds().clone() };
  }
  return { kind, latlngs: cloneLatLngs(getRings(layer)) };
}

/**
 * Восстанавливает геометрию из снимка.
 * @param {any} layer
 * @param {object|null} snapshot
 */
export function restoreGeometry(layer, snapshot) {
  if (!layer || !snapshot) return;
  switch (snapshot.kind) {
    case 'marker':
      layer.setLatLng(cloneLatLng(snapshot.latlng));
      break;
    case 'circle':
      layer.setRadius(snapshot.radius);
      layer.setLatLng(cloneLatLng(snapshot.latlng));
      break;
    case 'rectangle':
      layer.setBounds(snapshot.bounds.clone());
      break;
    case 'polyline':
    case 'polygon':
      layer.setLatLngs(cloneLatLngs(snapshot.latlngs));
      break;
    case 'group': {
      const children = layer.getLayers();
      snapshot.children.forEach((childSnapshot, index) => {
        if (children[index]) restoreGeometry(children[index], childSnapshot);
      });
      break;
    }
    default:
      break;
  }
}

/**
 * Сдвигает координату на пиксельное смещение в текущей проекции карты.
 * @param {any} map
 * @param {LatLng} latlng
 * @param {Point|{x:number,y:number}} delta
 * @returns {LatLng}
 */
export function translateLatLng(map, latlng, delta) {
  const projected = map.project(latlng);
  return map.unproject(new Point(projected.x + delta.x, projected.y + delta.y));
}

/**
 * Возвращает снимок, сдвинутый на пиксельное смещение.
 * @param {any} map
 * @param {object} snapshot
 * @param {Point|{x:number,y:number}} delta
 * @returns {object}
 */
export function translateSnapshot(map, snapshot, delta) {
  if (!snapshot) return snapshot;
  switch (snapshot.kind) {
    case 'marker':
      return { ...snapshot, latlng: translateLatLng(map, snapshot.latlng, delta) };
    case 'circle':
      return { ...snapshot, latlng: translateLatLng(map, snapshot.latlng, delta) };
    case 'rectangle': {
      const sw = translateLatLng(map, snapshot.bounds.getSouthWest(), delta);
      const ne = translateLatLng(map, snapshot.bounds.getNorthEast(), delta);
      return { ...snapshot, bounds: new Bounds(sw, ne) };
    }
    case 'polyline':
    case 'polygon':
      return {
        ...snapshot,
        latlngs: snapshot.latlngs.map((ring) =>
          ring.map((latlng) => translateLatLng(map, latlng, delta)),
        ),
      };
    case 'group':
      return {
        ...snapshot,
        children: snapshot.children.map((child) => translateSnapshot(map, child, delta)),
      };
    default:
      return snapshot;
  }
}

/**
 * Середина сегмента в экранном пространстве. Такая середина визуально совпадает
 * с линией при любом уровне масштаба.
 * @param {any} map
 * @param {LatLng} a
 * @param {LatLng} b
 * @returns {LatLng}
 */
export function midpointLatLng(map, a, b) {
  const pa = map.project(a);
  const pb = map.project(b);
  return map.unproject(new Point((pa.x + pb.x) / 2, (pa.y + pb.y) / 2));
}

/**
 * Точка на окружности в метрах от центра.
 * @param {LatLng} center
 * @param {number} distance
 * @param {number} bearing
 * @returns {LatLng}
 */
export function pointAtDistance(center, distance, bearing) {
  // Формула большого круга; импорт destinationPoint из ядра здесь не нужен,
  // чтобы утилита оставалась тестируемой без карты.
  const radius = 6371000;
  const angular = distance / radius;
  const bearingRad = (bearing * Math.PI) / 180;
  const lat1 = (center.lat * Math.PI) / 180;
  const lng1 = (center.lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearingRad),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  let lng = (lng2 * 180) / Math.PI;
  lng = ((((lng + 180) % 360) + 360) % 360) - 180;
  return new LatLng((lat2 * 180) / Math.PI, lng);
}

/**
 * Проекция точки на отрезок в пиксельном пространстве.
 * @param {Point|{x:number,y:number}} point
 * @param {Point|{x:number,y:number}} start
 * @param {Point|{x:number,y:number}} end
 * @returns {{x:number,y:number,t:number,distance:number}}
 */
export function closestPointOnSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) {
    return {
      x: start.x,
      y: start.y,
      t: 0,
      distance: Math.hypot(point.x - start.x, point.y - start.y),
    };
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  const x = start.x + t * dx;
  const y = start.y + t * dy;
  return { x, y, t, distance: Math.hypot(point.x - x, point.y - y) };
}

/**
 * Вставляет вершину в сегмент `segmentIndex` (между `i` и `i + 1`).
 * @param {LatLng[]} ring
 * @param {number} segmentIndex
 * @param {LatLng} latlng
 * @returns {LatLng[]} тот же массив
 */
export function insertVertexInSegment(ring, segmentIndex, latlng) {
  const index = Math.max(0, Math.min(ring.length, segmentIndex + 1));
  ring.splice(index, 0, latlng);
  return ring;
}

/**
 * Удаляет вершину по индексу.
 * @param {LatLng[]} ring
 * @param {number} index
 * @returns {LatLng[]} тот же массив
 */
export function removeVertexAt(ring, index) {
  if (index >= 0 && index < ring.length) ring.splice(index, 1);
  return ring;
}

/**
 * Проверяет самопересечение кольца. По умолчанию используется плоскость
 * `(lng, lat)`; для карты можно передать `project`, чтобы учитывать проекцию.
 * @param {LatLng[]} ring
 * @param {{project?: (latlng: LatLng) => {x:number,y:number}, closed?: boolean}} [options]
 * @returns {boolean}
 */
export function isSelfIntersecting(ring, options = {}) {
  return findSelfIntersections(ring, options).length > 0;
}

/**
 * Возвращает пары индексов пересекающихся сегментов.
 * @param {LatLng[]} ring
 * @param {{project?: (latlng: LatLng) => {x:number,y:number}, closed?: boolean}} [options]
 * @returns {Array<[number, number]>}
 */
export function findSelfIntersections(ring, options = {}) {
  if (!Array.isArray(ring) || ring.length < 4) return [];
  const closed = options.closed !== false;
  const project = options.project;
  const points = ring.map((latlng) => {
    if (project) {
      const point = project(latlng);
      return { x: point.x, y: point.y };
    }
    return { x: latlng.lng, y: latlng.lat };
  });
  const n = points.length;
  const edgeCount = closed ? n : n - 1;
  const intersections = [];

  for (let i = 0; i < edgeCount; i += 1) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];
    for (let j = i + 1; j < edgeCount; j += 1) {
      // Соседние сегменты делят вершину — это не самопересечение.
      if (j === i + 1) continue;
      // Первый и последний сегменты замкнутого кольца тоже соседние.
      if (closed && i === 0 && j === edgeCount - 1) continue;
      const b1 = points[j];
      const b2 = points[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) intersections.push([i, j]);
    }
  }
  return intersections;
}

/**
 * Пересечение двух отрезков, включая касание и коллинеарное наложение.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @param {{x:number,y:number}} c
 * @param {{x:number,y:number}} d
 * @returns {boolean}
 */
export function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, b, c)) return true;
  if (o2 === 0 && onSegment(a, b, d)) return true;
  if (o3 === 0 && onSegment(c, d, a)) return true;
  if (o4 === 0 && onSegment(c, d, b)) return true;
  return false;
}

function orientation(a, b, c) {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(value) <= EPSILON) return 0;
  return value > 0 ? 1 : -1;
}

function onSegment(a, b, point) {
  return (
    point.x >= Math.min(a.x, b.x) - EPSILON &&
    point.x <= Math.max(a.x, b.x) + EPSILON &&
    point.y >= Math.min(a.y, b.y) - EPSILON &&
    point.y <= Math.max(a.y, b.y) + EPSILON
  );
}

/**
 * Попадание точки внутрь кольца (правило чётности).
 * @param {{x:number,y:number}} point
 * @param {LatLng[]} ring
 * @param {(latlng: LatLng) => {x:number,y:number}} [project]
 * @returns {boolean}
 */
export function pointInRing(point, ring, project) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  const points = project
    ? ring.map(project)
    : ring.map((latlng) => ({ x: latlng.lng, y: latlng.lat }));
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Площадь кольца по формуле шнуровки (в единицах координат).
 * @param {LatLng[]} ring
 * @returns {number}
 */
export function ringArea(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    area += (ring[j].lng + ring[i].lng) * (ring[j].lat - ring[i].lat);
  }
  return Math.abs(area / 2);
}

/**
 * Минимальное число вершин для типа геометрии.
 * @param {GeometryKind} kind
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function minimumVertices(kind, fallback = 0) {
  if (kind === 'polygon') return 3;
  if (kind === 'polyline') return 2;
  return fallback;
}
