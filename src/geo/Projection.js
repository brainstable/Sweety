import { LatLng } from '../core/LatLng.js';
import { Point } from '../core/Point.js';
import { toRad, toDeg } from '../util/index.js';

/** Earth radius used by EPSG:3857 in metres. */
export const MERCATOR_RADIUS = 6378137;

/** Latitude limit where Web Mercator becomes square. */
export const MERCATOR_MAX_LATITUDE =
  (2 * Math.atan(Math.exp(Math.PI)) - Math.PI / 2) * (180 / Math.PI);

/**
 * Projection interface. A projection converts geographic coordinates
 * (degrees) to a planar coordinate system (usually metres) and back.
 *
 * Custom projections can extend this class and override {@link project} and
 * {@link unproject}; {@link bounds} should describe the valid planar extent.
 */
export class Projection {
  /**
   * @param {object} definition
   * @param {string} definition.code
   * @param {(latlng: LatLng) => Point} definition.project
   * @param {(point: Point) => LatLng} definition.unproject
   * @param {[[number, number], [number, number]]} definition.bounds `[lat, lng]` corners
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
   * Project a geographic coordinate into metres.
   * @param {LatLng|number[]|{lat:number,lng:number}} latlng
   * @returns {Point}
   */
  project(latlng) {
    return this._project(latlng instanceof LatLng ? latlng : new LatLng(latlng));
  }

  /**
   * Convert a projected point back to geographic coordinates.
   * @param {Point|{x:number,y:number}|number[]} point
   * @returns {LatLng}
   */
  unproject(point) {
    return this._unproject(point instanceof Point ? point : new Point(point));
  }
}

/**
 * Spherical Mercator (EPSG:3857). Latitude is clamped to the standard
 * ±85.0511287798° limit, which keeps the world square and finite at the poles.
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
 * Equirectangular / geographic projection (EPSG:4326).
 * Coordinates are kept in degrees and therefore map linearly to the plane.
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

/** Clamp a latitude into the Web Mercator domain. */
export function clampMercatorLatitude(latitude) {
  return Math.max(-MERCATOR_MAX_LATITUDE, Math.min(MERCATOR_MAX_LATITUDE, latitude));
}

/**
 * Convert degrees to metres at a given latitude using the spherical Mercator
 * scale factor. Useful for scale bars and hit tolerance calculations.
 */
export function metersPerDegree(latitude) {
  return (Math.PI / 180) * MERCATOR_RADIUS * Math.cos(toRad(latitude));
}

export { toDeg, toRad };
