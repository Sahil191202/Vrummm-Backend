import { describe, it, expect } from 'vitest';
import {
  paiseSchema,
  geoPointSchema,
  objectIdSchema,
  paginationQuerySchema,
  vehicleTypeSchema,
} from './index.js';

describe('paiseSchema', () => {
  it('accepts whole numbers', () => {
    expect(paiseSchema.safeParse(15050).success).toBe(true);
    expect(paiseSchema.safeParse(0).success).toBe(true);
  });
  it('rejects decimals, negatives and strings', () => {
    expect(paiseSchema.safeParse(150.5).success).toBe(false);
    expect(paiseSchema.safeParse(-1).success).toBe(false);
    expect(paiseSchema.safeParse('100').success).toBe(false);
  });
});

describe('geoPointSchema', () => {
  it('accepts a Mumbai point as [lng, lat]', () => {
    expect(
      geoPointSchema.safeParse({ type: 'Point', coordinates: [72.8777, 19.076] }).success,
    ).toBe(true);
  });
  it('rejects swapped order when latitude would be out of range', () => {
    // latitude 190 is impossible
    expect(geoPointSchema.safeParse({ type: 'Point', coordinates: [72.8, 190] }).success).toBe(
      false,
    );
  });
  it('rejects out-of-range values and wrong length', () => {
    expect(geoPointSchema.safeParse({ type: 'Point', coordinates: [181, 0] }).success).toBe(false);
    expect(geoPointSchema.safeParse({ type: 'Point', coordinates: [72.8] }).success).toBe(false);
  });
});

describe('other primitives', () => {
  it('validates ids', () => {
    expect(objectIdSchema.safeParse('507f1f77bcf86cd799439011').success).toBe(true);
    expect(objectIdSchema.safeParse('nope').success).toBe(false);
  });
  it('validates vehicle types', () => {
    expect(vehicleTypeSchema.safeParse('BIKE').success).toBe(true);
    expect(vehicleTypeSchema.safeParse('TRUCK').success).toBe(false);
  });
  it('applies pagination defaults and caps limit', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(paginationQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });
});
