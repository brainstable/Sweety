import { describe, expect, it } from 'vitest';
import { EARTH_RADIUS, LatLng, MAX_MERCATOR_LATITUDE } from '../src/core/LatLng.js';

describe('LatLng', () => {
  it('parses tuple, object and LatLng inputs', () => {
    const tuple = new LatLng([55.75, 37.61, 120]);
    expect(tuple.lat).toBe(55.75);
    expect(tuple.lng).toBe(37.61);
    expect(tuple.alt).toBe(120);

    expect(new LatLng({ lat: -10, lng: 20 })).toMatchObject({ lat: -10, lng: 20 });
    expect(new LatLng(tuple)).not.toBe(tuple);
    expect(new LatLng(tuple).equals(tuple)).toBe(true);
    expect(tuple.clone()).not.toBe(tuple);
    expect(tuple.clone().equals(tuple)).toBe(true);
  });

  it('rejects non-finite coordinates', () => {
    expect(() => new LatLng(Number.NaN, 0)).toThrow(TypeError);
    expect(() => new LatLng(0, Infinity)).toThrow(TypeError);
    expect(() => new LatLng([0])).toThrow(TypeError);
  });

  it('wraps longitude into [-180, 180)', () => {
    expect(new LatLng(0, 190).wrap().lng).toBe(-170);
    expect(new LatLng(0, -190).wrap().lng).toBe(170);
    expect(new LatLng(0, 180).wrap().lng).toBe(-180);
    expect(new LatLng(0, 45).wrap()).toBeInstanceOf(LatLng);
  });

  it('computes great-circle distances', () => {
    const moscow = new LatLng(55.7558, 37.6173);
    const london = new LatLng(51.5074, -0.1278);
    expect(moscow.distanceTo(moscow)).toBe(0);
    expect(moscow.distanceTo(london)).toBeGreaterThan(2_400_000);
    expect(moscow.distanceTo(london)).toBeLessThan(2_600_000);

    const quarter = new LatLng(0, 0).distanceTo(new LatLng(0, 90));
    expect(quarter).toBeCloseTo((Math.PI / 2) * EARTH_RADIUS, 0);
  });

  it('compares with an explicit tolerance', () => {
    expect(new LatLng(10, 10).equals([10, 10.0000000001])).toBe(true);
    expect(new LatLng(10, 10).equals([10, 10.001])).toBe(false);
    expect(new LatLng(10, 10).equals(null)).toBe(false);
  });

  it('documents the Web Mercator latitude limit', () => {
    expect(MAX_MERCATOR_LATITUDE).toBeCloseTo(85.0511287798, 10);
    expect(new LatLng(MAX_MERCATOR_LATITUDE, 0).lat).toBeLessThan(90);
  });
});
