import { toRad } from '../util/index.js';

/** Средний радиус Земли в метрах (IUGG). */
export const EARTH_RADIUS = 6371000;

/** Максимальная абсолютная широта, допустимая в Web Mercator. */
export const MAX_MERCATOR_LATITUDE = 85.0511287798;

/**
 * Географическая координата.
 *
 * Конструктор принимает `(lat, lng, alt)`, `[lat, lng, alt]` или
 * `{ lat, lng, alt }`, что удобно на границах API.
 */
export class LatLng {
  /**
   * @param {number|number[]|{lat:number,lng:number,alt?:number}|LatLng} lat
   * @param {number} [lng]
   * @param {number} [alt=0]
   */
  constructor(lat, lng, alt = 0) {
    let latitude = lat;
    let longitude = lng;
    let altitude = alt;

    if (lat instanceof LatLng) {
      latitude = lat.lat;
      longitude = lat.lng;
      altitude = lat.alt;
    } else if (Array.isArray(lat)) {
      latitude = lat[0];
      longitude = lat[1];
      altitude = lat.length > 2 ? lat[2] : alt;
    } else if (lat && typeof lat === 'object' && 'lat' in lat) {
      latitude = lat.lat;
      longitude = lat.lng;
      altitude = lat.alt ?? alt;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new TypeError('LatLng requires finite numeric latitude and longitude');
    }
    if (!Number.isFinite(altitude)) altitude = 0;

    /** @type {number} */
    this.lat = latitude;
    /** @type {number} */
    this.lng = longitude;
    /** @type {number} */
    this.alt = altitude;
  }

  /**
   * @returns {LatLng} независимая копия
   */
  clone() {
    return new LatLng(this.lat, this.lng, this.alt);
  }

  /**
   * Долгота, приведённая к диапазону `[-180, 180)`.
   * @returns {LatLng}
   */
  wrap() {
    let lng = this.lng;
    if (lng >= -180 && lng < 180) return this;
    lng = ((((lng + 180) % 360) + 360) % 360) - 180;
    return new LatLng(this.lat, lng, this.alt);
  }

  /**
   * Расстояние по большому кругу в метрах по формуле гаверсинусов.
   * @param {LatLng|number[]|{lat:number,lng:number}} other
   * @returns {number}
   */
  distanceTo(other) {
    const target = other instanceof LatLng ? other : new LatLng(other);
    if (this.equals(target, 0)) return 0;

    const dLat = toRad(target.lat - this.lat);
    const dLng = toRad(target.lng - this.lng);
    const lat1 = toRad(this.lat);
    const lat2 = toRad(target.lat);

    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    return EARTH_RADIUS * c;
  }

  /**
   * Сравнивает координаты с небольшим допуском.
   * @param {LatLng|number[]|{lat:number,lng:number}} other
   * @param {number} [maxMargin=1e-9]
   */
  equals(other, maxMargin = 1e-9) {
    if (!other) return false;
    const target = other instanceof LatLng ? other : new LatLng(other);
    return (
      Math.abs(this.lat - target.lat) <= maxMargin &&
      Math.abs(this.lng - target.lng) <= maxMargin &&
      Math.abs(this.alt - target.alt) <= maxMargin
    );
  }

  /** @returns {string} */
  toString() {
    return `LatLng(${this.lat}, ${this.lng}${this.alt ? `, ${this.alt}` : ''})`;
  }
}

/**
 * Фабрика, которая также клонирует существующие координаты.
 * @param {number|number[]|{lat:number,lng:number}|LatLng} lat
 * @param {number} [lng]
 * @param {number} [alt]
 * @returns {LatLng}
 */
export function toLatLng(lat, lng, alt) {
  if (lat instanceof LatLng) return lat;
  return new LatLng(lat, lng, alt);
}
