import { LatLng } from '../core/LatLng.js';
import { Point } from '../core/Point.js';
import { EPSG3857_PROJECTION, EPSG4326_PROJECTION, MERCATOR_RADIUS } from './Projection.js';

/**
 * Аффинное преобразование, переводящее спроецированные координаты в пиксельные.
 * Сдвиг задаётся в единицах масштабированной системы координат и соответствует
 * определению `(a, b, c, d)` в стиле Leaflet.
 */
export class Transformation {
  /**
   * @param {number} a
   * @param {number} b
   * @param {number} c
   * @param {number} d
   */
  constructor(a, b, c, d) {
    this._a = a;
    this._b = b;
    this._c = c;
    this._d = d;
  }

  /**
   * Применяет преобразование после умножения на `scale`.
   * @param {Point} point
   * @param {number} scale
   * @returns {Point}
   */
  transform(point, scale) {
    return new Point(scale * (this._a * point.x + this._b), scale * (this._c * point.y + this._d));
  }

  /**
   * Обратное преобразование.
   * @param {Point} point
   * @param {number} scale
   * @returns {Point}
   */
  untransform(point, scale) {
    return new Point((point.x / scale - this._b) / this._a, (point.y / scale - this._d) / this._c);
  }
}

/**
 * Система координат (CRS). Объединяет проекцию, аффинное преобразование
 * и функцию перевода зума в масштаб.
 *
 * Код карты зависит только от этого интерфейса, поэтому пользовательские
 * экземпляры CRS можно передавать через опцию карты `crs`.
 */
export class CRS {
  /**
   * @param {object} definition
   * @param {string} definition.code
   * @param {import('./Projection.js').Projection} definition.projection
   * @param {Transformation} definition.transformation
   * @param {(zoom:number) => number} [definition.scale]
   */
  constructor({ code, projection, transformation, scale }) {
    /** @type {string} */
    this.code = code;
    /** @type {import('./Projection.js').Projection} */
    this.projection = projection;
    /** @type {Transformation} */
    this.transformation = transformation;
    this._scale = scale || ((zoom) => 256 * 2 ** zoom);
  }

  /**
   * Масштаб пикселей для зума (возможно, дробного).
   * @param {number} zoom
   * @returns {number}
   */
  scale(zoom) {
    if (!Number.isFinite(zoom)) throw new TypeError('CRS.scale expects a finite zoom');
    return this._scale(zoom);
  }

  /**
   * Проецирует географические координаты в метры.
   * @param {LatLng|number[]} latlng
   * @returns {Point}
   */
  project(latlng) {
    return this.projection.project(latlng instanceof LatLng ? latlng : new LatLng(latlng));
  }

  /**
   * Переводит метры обратно в географические координаты.
   * @param {Point|{x:number,y:number}} point
   * @returns {LatLng}
   */
  unproject(point) {
    return this.projection.unproject(point instanceof Point ? point : new Point(point));
  }

  /**
   * Переводит координату в мировые пиксели на зуме `zoom`.
   * @param {LatLng|number[]} latlng
   * @param {number} zoom
   * @returns {Point}
   */
  latLngToPoint(latlng, zoom) {
    const projected = this.project(latlng);
    return this.transformation.transform(projected, this.scale(zoom));
  }

  /**
   * Переводит мировые пиксели на зуме `zoom` в координату.
   * @param {Point|{x:number,y:number}} point
   * @param {number} zoom
   * @returns {LatLng}
   */
  pointToLatLng(point, zoom) {
    const projected = this.transformation.untransform(
      point instanceof Point ? point : new Point(point),
      this.scale(zoom),
    );
    return this.unproject(projected);
  }

  /**
   * Спроецированные границы мира в метрах.
   * @returns {{min: Point, max: Point}}
   */
  projectedBounds() {
    const [southWest, northEast] = this.projection.bounds;
    return {
      min: this.project(southWest),
      max: this.project(northEast),
    };
  }
}

/** CRS Web Mercator, используемая OpenStreetMap и большинством сервисов XYZ-тайлов. */
export const EPSG3857 = new CRS({
  code: 'EPSG:3857',
  projection: EPSG3857_PROJECTION,
  transformation: new Transformation(
    0.5 / (Math.PI * MERCATOR_RADIUS),
    0.5,
    -0.5 / (Math.PI * MERCATOR_RADIUS),
    0.5,
  ),
});

/** Географическая CRS с линейным отображением градусов в пиксели. */
export const EPSG4326 = new CRS({
  code: 'EPSG:4326',
  projection: EPSG4326_PROJECTION,
  transformation: new Transformation(1 / 360, 0.5, -1 / 180, 0.5),
});

/** Таблица поиска по распространённым идентификаторам EPSG. */
export const CRS_BY_CODE = {
  'EPSG:3857': EPSG3857,
  'EPSG:900913': EPSG3857,
  'EPSG:4326': EPSG4326,
};

/**
 * Определяет CRS по экземпляру или коду, иначе возвращает Web Mercator.
 * @param {CRS|string|undefined} crs
 * @returns {CRS}
 */
export function resolveCRS(crs) {
  if (crs instanceof CRS) return crs;
  if (typeof crs === 'string' && CRS_BY_CODE[crs]) return CRS_BY_CODE[crs];
  if (crs) throw new Error(`Unsupported CRS: ${String(crs)}`);
  return EPSG3857;
}
