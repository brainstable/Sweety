import { EARTH_RADIUS, LatLng } from '../core/LatLng.js';
import { toDeg, toRad } from '../util/index.js';

/**
 * Destination point along a great circle.
 * @param {LatLng|number[]} start
 * @param {number} distance metres
 * @param {number} bearing degrees clockwise from north
 * @returns {LatLng}
 */
export function destinationPoint(start, distance, bearing) {
  const latlng = start instanceof LatLng ? start : new LatLng(start);
  const angularDistance = distance / EARTH_RADIUS;
  const bearingRad = toRad(bearing);
  const lat1 = toRad(latlng.lat);
  const lng1 = toRad(latlng.lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  let lng = toDeg(lng2);
  lng = ((((lng + 180) % 360) + 360) % 360) - 180;
  return new LatLng(toDeg(lat2), lng);
}
