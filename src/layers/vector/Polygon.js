import { Polyline, normalizeLatLngs } from './Polyline.js';
import { Bounds } from '../../core/Bounds.js';
import { groupRings } from '../../geo/rings.js';
import { extend } from '../../util/index.js';

/**
 * Полигон с заливкой. Несколько колец трактуются как один полигон с отверстиями
 * и отрисовываются по правилу заливки even-odd.
 *
 * Кольца хранятся плоско, поэтому при экспорте в GeoJSON они группируются по
 * вложенности: несколько несвязанных контуров дают `MultiPolygon`, а вложенные —
 * `Polygon` с отверстиями.
 */
export class Polygon extends Polyline {
  /**
   * @param {Array} latlngs
   * @param {object} [options]
   */
  constructor(latlngs = [], options = {}) {
    super(latlngs, extend({ fill: true, fillOpacity: 0.25 }, options));
    if (this._latlngs.length === 1 && this._latlngs[0].length > 0) {
      // Приводим распространённый входной формат с одним кольцом к вложенной структуре GeoJSON.
      this._latlngs = [this._latlngs[0]];
    }
    this._closed = true;
  }

  /** @returns {LatLng[]} */
  getLatLngs() {
    return this._latlngs;
  }

  /**
   * @param {Array} latlngs
   * @returns {this}
   */
  setLatLngs(latlngs) {
    this._latlngs = normalizeLatLngs(latlngs);
    this._closed = true;
    this.redraw();
    return this;
  }

  /** @returns {Bounds} */
  getBounds() {
    const bounds = new Bounds();
    for (const ring of this._latlngs) {
      for (const latlng of ring) bounds.extend(latlng);
    }
    return bounds;
  }

  /** @returns {LatLng|null} */
  getCenter() {
    return this.getBounds().getCenter();
  }

  /** @returns {object} */
  toGeoJSON() {
    const rings = this._latlngs.map((ring) =>
      ring.map((latlng) => ({ x: latlng.lng, y: latlng.lat })),
    );
    const groups = groupRings(rings);
    const coordinates = (group) =>
      [group.outer, ...group.holes].map((ring) => ring.map(({ x, y }) => [x, y]));

    const geometry =
      groups.length > 1
        ? { type: 'MultiPolygon', coordinates: groups.map(coordinates) }
        : { type: 'Polygon', coordinates: groups.length ? coordinates(groups[0]) : [] };

    return {
      type: 'Feature',
      properties: this.feature?.properties ? { ...this.feature.properties } : {},
      geometry,
    };
  }
}
