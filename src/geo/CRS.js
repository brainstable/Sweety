import { LatLng } from '../core/LatLng.js';
import { Point } from '../core/Point.js';
import { EPSG3857_PROJECTION, EPSG4326_PROJECTION, MERCATOR_RADIUS } from './Projection.js';

/**
 * Affine transformation used to turn projected coordinates into pixel
 * coordinates. Translation is expressed in units of the scaled coordinate
 * system, matching the Leaflet-style `(a, b, c, d)` definition.
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
   * Apply the transformation after multiplying by `scale`.
   * @param {Point} point
   * @param {number} scale
   * @returns {Point}
   */
  transform(point, scale) {
    return new Point(scale * (this._a * point.x + this._b), scale * (this._c * point.y + this._d));
  }

  /**
   * Inverse transform.
   * @param {Point} point
   * @param {number} scale
   * @returns {Point}
   */
  untransform(point, scale) {
    return new Point((point.x / scale - this._b) / this._a, (point.y / scale - this._d) / this._c);
  }
}

/**
 * Coordinate reference system. A CRS combines a projection, an affine
 * transformation and a zoom-to-scale function.
 *
 * Map code only depends on this interface, so custom CRS instances can be
 * passed through the `crs` map option.
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
   * Pixel scale at a (possibly fractional) zoom.
   * @param {number} zoom
   * @returns {number}
   */
  scale(zoom) {
    if (!Number.isFinite(zoom)) throw new TypeError('CRS.scale expects a finite zoom');
    return this._scale(zoom);
  }

  /**
   * Project geographic coordinates to metres.
   * @param {LatLng|number[]} latlng
   * @returns {Point}
   */
  project(latlng) {
    return this.projection.project(latlng instanceof LatLng ? latlng : new LatLng(latlng));
  }

  /**
   * Unproject metres to geographic coordinates.
   * @param {Point|{x:number,y:number}} point
   * @returns {LatLng}
   */
  unproject(point) {
    return this.projection.unproject(point instanceof Point ? point : new Point(point));
  }

  /**
   * Convert a coordinate to world pixels at `zoom`.
   * @param {LatLng|number[]} latlng
   * @param {number} zoom
   * @returns {Point}
   */
  latLngToPoint(latlng, zoom) {
    const projected = this.project(latlng);
    return this.transformation.transform(projected, this.scale(zoom));
  }

  /**
   * Convert world pixels at `zoom` to a coordinate.
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
   * The projected world extent in metres.
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

/** Web Mercator CRS used by OpenStreetMap and most XYZ tile services. */
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

/** Geographic CRS with a linear degree-to-pixel mapping. */
export const EPSG4326 = new CRS({
  code: 'EPSG:4326',
  projection: EPSG4326_PROJECTION,
  transformation: new Transformation(1 / 360, 0.5, -1 / 180, 0.5),
});

/** Lookup table for common EPSG identifiers. */
export const CRS_BY_CODE = {
  'EPSG:3857': EPSG3857,
  'EPSG:900913': EPSG3857,
  'EPSG:4326': EPSG4326,
};

/**
 * Resolve a CRS from an instance, code, or fall back to Web Mercator.
 * @param {CRS|string|undefined} crs
 * @returns {CRS}
 */
export function resolveCRS(crs) {
  if (crs instanceof CRS) return crs;
  if (typeof crs === 'string' && CRS_BY_CODE[crs]) return CRS_BY_CODE[crs];
  if (crs) throw new Error(`Unsupported CRS: ${String(crs)}`);
  return EPSG3857;
}
