import { describe, expect, it } from 'vitest';
import { Bounds } from '../src/core/Bounds.js';
import { LatLng } from '../src/core/LatLng.js';
import { Point } from '../src/core/Point.js';

describe('Point', () => {
  it('supports all documented constructor shapes', () => {
    expect(new Point(1, 2)).toMatchObject({ x: 1, y: 2 });
    expect(new Point([3, 4])).toMatchObject({ x: 3, y: 4 });
    expect(new Point({ x: 5, y: 6 })).toMatchObject({ x: 5, y: 6 });
    expect(new Point(new Point(7, 8))).toMatchObject({ x: 7, y: 8 });
  });

  it('mutates in place and returns this for chaining', () => {
    const point = new Point(10, 20);
    expect(point.add([2, 3])).toBe(point);
    expect(point).toMatchObject({ x: 12, y: 23 });
    expect(point.subtract({ x: 2, y: 3 })).toMatchObject({ x: 10, y: 20 });
    expect(point.multiplyBy(2)).toMatchObject({ x: 20, y: 40 });
    expect(point.divideBy(4)).toMatchObject({ x: 5, y: 10 });
    expect(() => point.divideBy(0)).toThrow(RangeError);
  });

  it('rounds, measures and compares', () => {
    const point = new Point(1.6, 2.4);
    expect(point.round()).toMatchObject({ x: 2, y: 2 });
    expect(point.distanceTo([5, 6])).toBeCloseTo(5);
    expect(point.clone()).not.toBe(point);
    expect(point.equals([2, 2])).toBe(true);
    expect(point.equals(null)).toBe(false);
    expect(point.toString()).toBe('Point(2, 2)');
  });
});

describe('Bounds', () => {
  it('normalises arbitrary corners', () => {
    const bounds = new Bounds([60, 40], [50, 30]);
    expect(bounds.getSouth()).toBe(50);
    expect(bounds.getWest()).toBe(30);
    expect(bounds.getNorth()).toBe(60);
    expect(bounds.getEast()).toBe(40);
    expect(bounds.isValid()).toBe(true);
  });

  it('parses nested arrays and clones instances', () => {
    const bounds = new Bounds([
      [10, 20],
      [30, 40],
    ]);
    expect(bounds.getCenter()).toEqual({ lat: 20, lng: 30, alt: 0 });
    expect(new Bounds(bounds).equals(bounds)).toBe(true);
    expect(new Bounds().isValid()).toBe(false);
  });

  it('extends, pads and clamps', () => {
    const bounds = new Bounds([0, 0], [10, 10]).extend([20, 5]);
    expect(bounds.getNorth()).toBe(20);
    expect(bounds.getCenter()).toEqual({ lat: 10, lng: 5, alt: 0 });

    bounds.pad(0.1);
    expect(bounds.getNorth()).toBeCloseTo(22);
    expect(bounds.getSouth()).toBeCloseTo(-2);
    expect(bounds.clamp([30, 30])).toMatchObject({ lat: 22, lng: 11 });
    expect(bounds.clamp(new LatLng(-30, -30))).toMatchObject({ lat: -2, lng: -1 });
  });

  it('checks containment, intersection and strict overlap', () => {
    const outer = new Bounds([0, 0], [10, 10]);
    const inner = new Bounds([2, 2], [8, 8]);
    const touching = new Bounds([10, 10], [20, 20]);
    const outside = new Bounds([20, 20], [30, 30]);

    expect(outer.contains([5, 5])).toBe(true);
    expect(outer.contains([11, 5])).toBe(false);
    expect(outer.intersects(inner)).toBe(true);
    expect(outer.overlaps(inner)).toBe(true);
    expect(outer.overlaps(touching)).toBe(false);
    expect(outer.intersects(touching)).toBe(true);
    expect(outer.intersects(outside)).toBe(false);
  });

  it('serialises, returns a size and handles invalid bounds', () => {
    const bounds = new Bounds([0, 0], [2, 4]);
    expect(bounds.toBBoxString()).toBe('0.000000,0.000000,4.000000,2.000000');
    expect(bounds.getSize()).toMatchObject({ x: 4, y: 2 });
    expect(bounds.toString()).toBe('Bounds(0.000000,0.000000,4.000000,2.000000)');

    const invalid = new Bounds();
    expect(invalid.toString()).toBe('Bounds(invalid)');
    expect(invalid.getCenter()).toBeNull();
    expect(invalid.getSize()).toBeNull();
    expect(invalid.getNorthWest()).toBeNull();
    expect(invalid.intersects(new Bounds([2, 2], [8, 8]))).toBe(false);
    expect(invalid.toBBoxString()).toBe('');
  });

  it('captures corners including altitude', () => {
    const bounds = new Bounds([1, 2, 3], [4, 5, 6]);
    expect(bounds.getSouthWest()).toEqual({ lat: 1, lng: 2, alt: 3 });
    expect(bounds.getNorthWest()).toMatchObject({ lat: 4, lng: 2 });
    expect(bounds.getSouthEast()).toMatchObject({ lat: 1, lng: 5 });
  });
});
