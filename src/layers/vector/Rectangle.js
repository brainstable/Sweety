import { Path } from './Path.js';
import { Bounds } from '../../core/Bounds.js';
import { LatLng } from '../../core/LatLng.js';
import { extend } from '../../util/index.js';

/**
 * A bounding-box rectangle rendered as a closed path.
 */
export class Rectangle extends Path {
  /**
   * @param {Bounds|number[][]} bounds
   * @param {object} [options]
   */
  constructor(bounds, options = {}) {
    super(extend({ fill: true, fillOpacity: 0.2 }, options));
    this._bounds = bounds instanceof Bounds ? bounds.clone() : new Bounds(bounds);
    if (!this._bounds.isValid()) throw new Error('Rectangle requires valid bounds');
    this._closed = true;
    this._latlngs = [this._boundsToRing()];
  }

  /** @private */
  _boundsToRing() {
    return [
      new LatLng(this._bounds.getSouth(), this._bounds.getWest()),
      new LatLng(this._bounds.getSouth(), this._bounds.getEast()),
      new LatLng(this._bounds.getNorth(), this._bounds.getEast()),
      new LatLng(this._bounds.getNorth(), this._bounds.getWest()),
    ];
  }

  /**
   * @param {Bounds|number[][]} bounds
   * @returns {this}
   */
  setBounds(bounds) {
    this._bounds = bounds instanceof Bounds ? bounds.clone() : new Bounds(bounds);
    if (!this._bounds.isValid()) throw new Error('Rectangle requires valid bounds');
    this._latlngs = [this._boundsToRing()];
    this.redraw();
    return this;
  }

  /** @returns {Bounds} */
  getBounds() {
    return this._bounds.clone();
  }

  /** @returns {LatLng} */
  getCenter() {
    return this._bounds.getCenter();
  }

  /** @returns {object} */
  toGeoJSON() {
    return {
      type: 'Feature',
      properties: this.feature?.properties ? { ...this.feature.properties } : {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [this._bounds.getWest(), this._bounds.getSouth()],
            [this._bounds.getEast(), this._bounds.getSouth()],
            [this._bounds.getEast(), this._bounds.getNorth()],
            [this._bounds.getWest(), this._bounds.getNorth()],
            [this._bounds.getWest(), this._bounds.getSouth()],
          ],
        ],
      },
    };
  }
}
