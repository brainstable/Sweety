import { Path } from './Path.js';
import { Bounds } from '../../core/Bounds.js';
import { LatLng, toLatLng } from '../../core/LatLng.js';
import { extend } from '../../util/index.js';

const isLatLngLike = (value) =>
  value instanceof LatLng ||
  (Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number') ||
  (value !== null && typeof value === 'object' && 'lat' in value && 'lng' in value);

/**
 * Normalise flexible latlng input into an array of rings.
 * @param {Array} latlngs
 * @returns {LatLng[][]}
 */
export function normalizeLatLngs(latlngs) {
  if (!Array.isArray(latlngs) || latlngs.length === 0) return [];
  if (isLatLngLike(latlngs[0])) return [latlngs.map((latlng) => toLatLng(latlng))];
  return latlngs.map((ring) => (Array.isArray(ring) ? ring.map((latlng) => toLatLng(latlng)) : []));
}

/**
 * A polyline, optionally composed of multiple disconnected parts.
 */
export class Polyline extends Path {
  /**
   * @param {Array} latlngs
   * @param {object} [options]
   */
  constructor(latlngs = [], options = {}) {
    super(extend({ fill: false }, options));
    /** @type {LatLng[][]} */
    this._latlngs = normalizeLatLngs(latlngs);
    this._closed = false;
  }

  /**
   * Replace geometry.
   * @param {Array} latlngs
   * @returns {this}
   */
  setLatLngs(latlngs) {
    this._latlngs = normalizeLatLngs(latlngs);
    this.redraw();
    return this;
  }

  /** @returns {LatLng[][]} */
  getLatLngs() {
    return this._latlngs;
  }

  /**
   * Append a point to a ring.
   * @param {LatLng|number[]} latlng
   * @param {number} [ring=0]
   * @returns {this}
   */
  addLatLng(latlng, ring = 0) {
    if (!this._latlngs[ring]) this._latlngs[ring] = [];
    this._latlngs[ring].push(toLatLng(latlng));
    this.redraw();
    return this;
  }

  /** @returns {Bounds} */
  getBounds() {
    const bounds = new Bounds();
    for (const part of this._latlngs) {
      for (const latlng of part) bounds.extend(latlng);
    }
    return bounds;
  }

  /**
   * GeoJSON geometry for this path.
   * @returns {object}
   */
  toGeoJSON() {
    const rings = this._latlngs.map((ring) => ring.map((latlng) => [latlng.lng, latlng.lat]));
    const geometry =
      rings.length === 1
        ? { type: 'LineString', coordinates: rings[0] }
        : { type: 'MultiLineString', coordinates: rings };
    return {
      type: 'Feature',
      properties: this.feature?.properties ? { ...this.feature.properties } : {},
      geometry,
    };
  }
}
