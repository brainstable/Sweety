import { LatLng } from '../core/LatLng.js';
import { Point } from '../core/Point.js';
import { toRad, toDeg } from '../util/index.js';

/** Радиус Земли, используемый в EPSG:3857, в метрах. */
export const MERCATOR_RADIUS = 6378137;

/** Предельная широта, при которой Web Mercator становится квадратным. */
export const MERCATOR_MAX_LATITUDE =
  (2 * Math.atan(Math.exp(Math.PI)) - Math.PI / 2) * (180 / Math.PI);

/**
 * Интерфейс проекции. Проекция переводит географические координаты
 * (в градусах) в плоскую систему координат (обычно в метры) и обратно.
 *
 * Пользовательские проекции могут наследовать этот класс и переопределять
 * {@link project} и {@link unproject}; {@link bounds} должен описывать
 * допустимый плоский экстент.
 */
export class Projection {
  /**
   * @param {object} definition
   * @param {string} definition.code
   * @param {(latlng: LatLng) => Point} definition.project
   * @param {(point: Point) => LatLng} definition.unproject
   * @param {[[number, number], [number, number]]} definition.bounds углы `[lat, lng]`
   */
  constructor({ code, project, unproject, bounds }) {
    /** @type {string} */
    this.code = code;
    /** @type {[[number, number], [number, number]]} */
    this.bounds = bounds;
    this._project = project;
    this._unproject = unproject;
  }

  /**
   * Проецирует географическую координату в метры.
   * @param {LatLng|number[]|{lat:number,lng:number}} latlng
   * @returns {Point}
   */
  project(latlng) {
    return this._project(latlng instanceof LatLng ? latlng : new LatLng(latlng));
  }

  /**
   * Переводит спроецированную точку обратно в географические координаты.
   * @param {Point|{x:number,y:number}|number[]} point
   * @returns {LatLng}
   */
  unproject(point) {
    return this._unproject(point instanceof Point ? point : new Point(point));
  }
}

/**
 * Сферическая проекция Меркатора (EPSG:3857). Широта ограничивается
 * стандартным пределом ±85.0511287798°, поэтому мир остаётся квадратным
 * и конечным на полюсах.
 */
export const EPSG3857_PROJECTION = new Projection({
  code: 'EPSG:3857',
  bounds: [
    [-MERCATOR_MAX_LATITUDE, -180],
    [MERCATOR_MAX_LATITUDE, 180],
  ],
  project(latlng) {
    const lat = Math.max(-MERCATOR_MAX_LATITUDE, Math.min(MERCATOR_MAX_LATITUDE, latlng.lat));
    return new Point(
      MERCATOR_RADIUS * toRad(latlng.lng),
      MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2)),
    );
  },
  unproject(point) {
    const lat =
      (2 * Math.atan(Math.exp(point.y / MERCATOR_RADIUS)) - Math.PI / 2) * (180 / Math.PI);
    return new LatLng(lat, (point.x / MERCATOR_RADIUS) * (180 / Math.PI));
  },
});

/**
 * Равнопромежуточная (географическая) проекция (EPSG:4326).
 * Координаты остаются в градусах и поэтому линейно отображаются на плоскость.
 */
export const EPSG4326_PROJECTION = new Projection({
  code: 'EPSG:4326',
  bounds: [
    [-90, -180],
    [90, 180],
  ],
  project(latlng) {
    return new Point(latlng.lng, latlng.lat);
  },
  unproject(point) {
    return new LatLng(point.y, point.x);
  },
});

/** Ограничивает широту областью допустимых значений Web Mercator. */
export function clampMercatorLatitude(latitude) {
  return Math.max(-MERCATOR_MAX_LATITUDE, Math.min(MERCATOR_MAX_LATITUDE, latitude));
}

/**
 * Переводит градусы в метры на заданной широте с использованием масштабного
 * коэффициента сферического Меркатора. Полезно для масштабных линеек и
 * расчёта допусков попадания.
 */
export function metersPerDegree(latitude) {
  return (Math.PI / 180) * MERCATOR_RADIUS * Math.cos(toRad(latitude));
}

export { toDeg, toRad };
