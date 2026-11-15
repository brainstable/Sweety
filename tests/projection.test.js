import { describe, expect, it } from 'vitest';
import {
  EPSG3857_PROJECTION,
  EPSG4326_PROJECTION,
  MERCATOR_MAX_LATITUDE,
  clampMercatorLatitude,
} from '../src/geo/Projection.js';
import { CRS, EPSG3857, EPSG4326, Transformation, resolveCRS } from '../src/geo/CRS.js';

describe('EPSG:3857 projection', () => {
  it('maps the origin and known extents', () => {
    expect(EPSG3857_PROJECTION.project([0, 0]).x).toBeCloseTo(0, 8);
    expect(EPSG3857_PROJECTION.project([0, 0]).y).toBeCloseTo(0, 8);
    const east = EPSG3857_PROJECTION.project([0, 180]);
    expect(east.x).toBeCloseTo(20037508.342789244, 6);
    expect(east.y).toBeCloseTo(0, 6);

    const north = EPSG3857_PROJECTION.project([MERCATOR_MAX_LATITUDE, 0]);
    expect(north.y).toBeCloseTo(20037508.342789244, 2);
  });

  it('clamps latitudes at the poles and remains invertible', () => {
    const projected = EPSG3857_PROJECTION.project([90, 0]);
    expect(projected.y).toBeCloseTo(20037508.342789244, 2);
    expect(EPSG3857_PROJECTION.unproject(projected).lat).toBeCloseTo(MERCATOR_MAX_LATITUDE, 6);

    const roundTrip = EPSG3857_PROJECTION.unproject(EPSG3857_PROJECTION.project([55.75, 37.61]));
    expect(roundTrip.lat).toBeCloseTo(55.75, 10);
    expect(roundTrip.lng).toBeCloseTo(37.61, 10);
    expect(Number.isFinite(roundTrip.lat)).toBe(true);
  });

  it('handles extremely large projected y without NaN', () => {
    const coordinate = EPSG3857_PROJECTION.unproject({ x: 0, y: 1e12 });
    expect(Number.isFinite(coordinate.lat)).toBe(true);
    expect(coordinate.lat).toBeLessThanOrEqual(90);
    expect(clampMercatorLatitude(100)).toBe(MERCATOR_MAX_LATITUDE);
    expect(clampMercatorLatitude(-100)).toBe(-MERCATOR_MAX_LATITUDE);
  });
});

describe('EPSG:4326 projection', () => {
  it('keeps degrees as plane coordinates', () => {
    expect(EPSG4326_PROJECTION.project([55.75, 37.61])).toEqual({ x: 37.61, y: 55.75 });
    expect(EPSG4326_PROJECTION.unproject({ x: 37.61, y: 55.75 })).toMatchObject({
      lat: 55.75,
      lng: 37.61,
    });
    expect(EPSG4326_PROJECTION.bounds).toEqual([
      [-90, -180],
      [90, 180],
    ]);
  });
});

describe('Transformation', () => {
  it('applies and reverses affine transforms', () => {
    const transformation = new Transformation(2, 10, -3, 5);
    const point = transformation.transform({ x: 4, y: 2 }, 2);
    expect(point).toEqual({ x: 36, y: -2 });
    expect(transformation.untransform(point, 2)).toEqual({ x: 4, y: 2 });
  });
});

describe('CRS', () => {
  it('maps coordinates to the standard 256px world at zoom 0', () => {
    expect(EPSG3857.latLngToPoint([0, 0], 0)).toEqual({ x: 128, y: 128 });
    expect(EPSG3857.latLngToPoint([0, 0], 1)).toEqual({ x: 256, y: 256 });
    expect(EPSG3857.latLngToPoint([0, 0], 2)).toEqual({ x: 512, y: 512 });

    const northWest = EPSG3857.latLngToPoint([MERCATOR_MAX_LATITUDE, -180], 0);
    expect(northWest.x).toBeCloseTo(0, 6);
    expect(northWest.y).toBeCloseTo(0, 6);

    const southEast = EPSG3857.latLngToPoint([-MERCATOR_MAX_LATITUDE, 180], 0);
    expect(southEast.x).toBeCloseTo(256, 6);
    expect(southEast.y).toBeCloseTo(256, 6);
  });

  it('round-trips points through any zoom', () => {
    for (const zoom of [0, 1.5, 5, 18]) {
      const point = EPSG3857.latLngToPoint([55.751244, 37.618423], zoom);
      const latlng = EPSG3857.pointToLatLng(point, zoom);
      expect(latlng.lat).toBeCloseTo(55.751244, 9);
      expect(latlng.lng).toBeCloseTo(37.618423, 9);
    }
  });

  it('supports EPSG:4326 map coordinates', () => {
    expect(EPSG4326.latLngToPoint([0, 0], 0)).toMatchObject({ x: 128, y: 128 });
    expect(EPSG4326.latLngToPoint([90, 180], 0)).toMatchObject({ x: 256, y: 0 });
    const origin = EPSG4326.pointToLatLng({ x: 128, y: 128 }, 0);
    expect(origin.lat).toBeCloseTo(0, 9);
    expect(origin.lng).toBeCloseTo(0, 9);
  });

  it('exposes projected bounds and resolves aliases', () => {
    const bounds = EPSG3857.projectedBounds();
    expect(bounds.min.x).toBeCloseTo(-20037508.342789244, 2);
    expect(bounds.max.y).toBeCloseTo(20037508.342789244, 2);
    expect(resolveCRS('EPSG:4326')).toBe(EPSG4326);
    expect(resolveCRS('EPSG:900913')).toBe(EPSG3857);
    expect(resolveCRS()).toBe(EPSG3857);
    expect(
      resolveCRS(
        new CRS({
          code: 'CUSTOM',
          projection: EPSG4326_PROJECTION,
          transformation: EPSG4326.transformation,
        }),
      ).code,
    ).toBe('CUSTOM');
    expect(() => resolveCRS('EPSG:9999')).toThrow('Unsupported CRS');
  });
});
