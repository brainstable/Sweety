import { LatLng } from './LatLng.js';
import { Point } from './Point.js';

/**
 * Axis-aligned geographic bounds. Corners are always normalised so that
 * `_southWest` is south-west of `_northEast`.
 */
export class Bounds {
  /**
   * Accepts `(corner1, corner2)`, `[[lat,lng], [lat,lng]]`, a single
   * `[lat,lng]`, or another Bounds instance.
   * @param {*} [corner1]
   * @param {*} [corner2]
   */
  constructor(corner1, corner2) {
    this._southWest = null;
    this._northEast = null;

    if (corner1 === undefined) return;

    if (corner1 instanceof Bounds) {
      if (corner1.isValid()) this.extend(corner1);
      return;
    }

    if (corner2 === undefined) {
      if (Array.isArray(corner1) && corner1.length === 2 && Array.isArray(corner1[0])) {
        this.extend(corner1[0]);
        this.extend(corner1[1]);
      } else {
        this.extend(corner1);
      }
      return;
    }

    this.extend(corner1);
    this.extend(corner2);
  }

  /**
   * Expand bounds to include a coordinate or another bounds object.
   * @param {LatLng|number[]|{lat:number,lng:number}|Bounds} object
   * @returns {Bounds} this
   */
  extend(object) {
    if (!object) return this;

    if (object instanceof Bounds) {
      if (!object.isValid()) return this;
      this.extend(object._southWest);
      this.extend(object._northEast);
      return this;
    }

    const latlng = object instanceof LatLng ? object : new LatLng(object);
    if (!this._southWest) {
      this._southWest = new LatLng(latlng.lat, latlng.lng, latlng.alt);
      this._northEast = new LatLng(latlng.lat, latlng.lng, latlng.alt);
      return this;
    }

    this._southWest.lat = Math.min(latlng.lat, this._southWest.lat);
    this._southWest.lng = Math.min(latlng.lng, this._southWest.lng);
    this._northEast.lat = Math.max(latlng.lat, this._northEast.lat);
    this._northEast.lng = Math.max(latlng.lng, this._northEast.lng);
    return this;
  }

  /** @returns {LatLng|null} */
  getSouthWest() {
    return this._southWest;
  }

  /** @returns {LatLng|null} */
  getNorthEast() {
    return this._northEast;
  }

  /** @returns {LatLng|null} */
  getNorthWest() {
    if (!this.isValid()) return null;
    return new LatLng(this.getNorth(), this.getWest());
  }

  /** @returns {LatLng|null} */
  getSouthEast() {
    if (!this.isValid()) return null;
    return new LatLng(this.getSouth(), this.getEast());
  }

  getWest() {
    return this._southWest ? this._southWest.lng : null;
  }

  getSouth() {
    return this._southWest ? this._southWest.lat : null;
  }

  getEast() {
    return this._northEast ? this._northEast.lng : null;
  }

  getNorth() {
    return this._northEast ? this._northEast.lat : null;
  }

  /** @returns {LatLng|null} centre of the box */
  getCenter() {
    if (!this.isValid()) return null;
    return new LatLng(
      (this._southWest.lat + this._northEast.lat) / 2,
      (this._southWest.lng + this._northEast.lng) / 2,
    );
  }

  /** @returns {Point|null} width and height in coordinate units */
  getSize() {
    if (!this.isValid()) return null;
    return new Point(
      Math.abs(this._northEast.lng - this._southWest.lng),
      Math.abs(this._northEast.lat - this._southWest.lat),
    );
  }

  /** Expand by a ratio of the current size on each side. */
  pad(bufferRatio) {
    if (!this.isValid()) return this;
    const latPadding = Math.abs(this._northEast.lat - this._southWest.lat) * bufferRatio;
    const lngPadding = Math.abs(this._northEast.lng - this._southWest.lng) * bufferRatio;
    this._southWest.lat = Math.max(-90, this._southWest.lat - latPadding);
    this._southWest.lng = Math.max(-180, this._southWest.lng - lngPadding);
    this._northEast.lat = Math.min(90, this._northEast.lat + latPadding);
    this._northEast.lng = Math.min(180, this._northEast.lng + lngPadding);
    return this;
  }

  /** Whether a coordinate or nested bounds lies entirely inside this box. */
  contains(object) {
    if (!this.isValid()) return false;
    if (object instanceof Bounds) {
      return (
        object.isValid() &&
        this._southWest.lat <= object.getSouth() &&
        object.getNorth() <= this._northEast.lat &&
        this._southWest.lng <= object.getWest() &&
        object.getEast() <= this._northEast.lng
      );
    }
    const latlng = object instanceof LatLng ? object : new LatLng(object);
    return (
      latlng.lat >= this._southWest.lat &&
      latlng.lat <= this._northEast.lat &&
      latlng.lng >= this._southWest.lng &&
      latlng.lng <= this._northEast.lng
    );
  }

  /** Whether a coordinate or bounds intersects this box. */
  intersects(object) {
    if (!this.isValid()) return false;
    if (object instanceof Bounds) {
      if (!object.isValid()) return false;
      return (
        object.getSouthWest().lng <= this._northEast.lng &&
        object.getNorthEast().lng >= this._southWest.lng &&
        object.getSouthWest().lat <= this._northEast.lat &&
        object.getNorthEast().lat >= this._southWest.lat
      );
    }
    const latlng = object instanceof LatLng ? object : new LatLng(object);
    return (
      latlng.lng >= this._southWest.lng &&
      latlng.lng <= this._northEast.lng &&
      latlng.lat >= this._southWest.lat &&
      latlng.lat <= this._northEast.lat
    );
  }

  /** Strict overlap test (edges touching are not an overlap). */
  overlaps(other) {
    if (!(other instanceof Bounds) || !this.isValid() || !other.isValid()) return false;
    const sw = other.getSouthWest();
    const ne = other.getNorthEast();
    const latOverlaps = ne.lat > this._southWest.lat && sw.lat < this._northEast.lat;
    const lngOverlaps = ne.lng > this._southWest.lng && sw.lng < this._northEast.lng;
    return latOverlaps && lngOverlaps;
  }

  /** @returns {Bounds} an independent copy */
  clone() {
    return new Bounds(this);
  }

  /** Whether both corners are set. */
  isValid() {
    return Boolean(this._southWest && this._northEast);
  }

  /** Approximate equality within a tolerance. */
  equals(other, maxMargin = 1e-9) {
    if (!(other instanceof Bounds)) return false;
    if (!this.isValid() || !other.isValid()) return this.isValid() === other.isValid();
    return (
      this._southWest.equals(other._southWest, maxMargin) &&
      this._northEast.equals(other._northEast, maxMargin)
    );
  }

  /** Clamp a coordinate to the nearest point inside the bounds. */
  clamp(latlng) {
    if (!this.isValid()) return new LatLng(latlng);
    const source = latlng instanceof LatLng ? latlng : new LatLng(latlng);
    return new LatLng(
      Math.max(this._southWest.lat, Math.min(this._northEast.lat, source.lat)),
      Math.max(this._southWest.lng, Math.min(this._northEast.lng, source.lng)),
      source.alt,
    );
  }

  /** @returns {string} `west,south,east,north` with six decimals */
  toBBoxString() {
    if (!this.isValid()) return '';
    return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()]
      .map((value) => value.toFixed(6))
      .join(',');
  }

  /** @returns {string} */
  toString() {
    return this.isValid() ? `Bounds(${this.toBBoxString()})` : 'Bounds(invalid)';
  }
}

/** Factory for {@link Bounds}. */
export function toBounds(corner1, corner2) {
  return corner1 instanceof Bounds ? corner1 : new Bounds(corner1, corner2);
}
