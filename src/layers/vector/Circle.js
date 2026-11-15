import { Path } from './Path.js';
import { Bounds } from '../../core/Bounds.js';
import { toLatLng } from '../../core/LatLng.js';
import { destinationPoint } from '../../geo/destination.js';
import { extend } from '../../util/index.js';

const SEGMENTS = 64;

/**
 * Геодезическая окружность с радиусом в метрах, аппроксимируемая полигоном
 * из 64 сегментов в экранном пространстве.
 */
export class Circle extends Path {
  /**
   * @param {LatLng|number[]} latlng
   * @param {number} radius радиус в метрах
   * @param {object} [options]
   */
  constructor(latlng, radius, options = {}) {
    super(extend({ fill: true, fillOpacity: 0.2 }, options));
    if (!Number.isFinite(radius) || radius < 0) {
      throw new RangeError('Circle radius must be a non-negative number');
    }
    this._latlng = toLatLng(latlng);
    this._radius = radius;
    this._closed = true;
  }

  /** @protected */
  _project() {
    if (!this._map) return [];
    const ring = [];
    for (let i = 0; i < SEGMENTS; i += 1) {
      const destination = destinationPoint(this._latlng, this._radius, (i / SEGMENTS) * 360);
      ring.push(this._map.latLngToLayerPoint(destination));
    }
    return [ring];
  }

  /** @returns {LatLng} */
  getLatLng() {
    return this._latlng.clone();
  }

  /**
   * @param {LatLng|number[]} latlng
   * @returns {this}
   */
  setLatLng(latlng) {
    this._latlng = toLatLng(latlng);
    this.redraw();
    return this;
  }

  /** @returns {number} */
  getRadius() {
    return this._radius;
  }

  /**
   * @param {number} radius радиус в метрах
   * @returns {this}
   */
  setRadius(radius) {
    if (!Number.isFinite(radius) || radius < 0) {
      throw new RangeError('Circle radius must be a non-negative number');
    }
    this._radius = radius;
    this.redraw();
    return this;
  }

  /** @returns {LatLng} */
  getCenter() {
    return this.getLatLng();
  }

  /** @returns {Bounds} */
  getBounds() {
    const bounds = new Bounds();
    bounds.extend(this._latlng);
    for (let i = 0; i < 8; i += 1) {
      bounds.extend(destinationPoint(this._latlng, this._radius, i * 45));
    }
    return bounds;
  }

  /** @returns {object} */
  toGeoJSON() {
    return {
      type: 'Feature',
      properties: {
        ...(this.feature?.properties || {}),
        radius: this._radius,
      },
      geometry: {
        type: 'Point',
        coordinates: [this._latlng.lng, this._latlng.lat],
      },
    };
  }
}
