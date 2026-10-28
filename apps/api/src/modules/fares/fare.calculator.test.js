import { describe, it, expect } from 'vitest';
import { calculateFare } from './fare.calculator.js';

const baseConfig = {
  _id: 'cfg1',
  version: 1,
  baseFarePaise: 2500,       // ₹25
  perKmPaise: 1200,          // ₹12/km
  perMinutePaise: 150,       // ₹1.50/min
  minimumFarePaise: 3500,    // ₹35
  minimumBillableDistanceMetres: 1000,
  taxes: [{ label: 'GST', basisPoints: 500 }], // 5%
};

describe('calculateFare', () => {
  it('applies base + distance + time charges correctly', () => {
    const result = calculateFare({
      config: baseConfig,
      distanceMetres: 5000,  // 5 km
      durationMinutes: 10,
    });
    // base 2500 + dist 6000 (5*1200) + time 1500 (10*150) = 10000
    // tax 5% = 500
    // total = 10500
    expect(result.breakdown.baseFarePaise).toBe(2500);
    expect(result.breakdown.distanceCharge.amountPaise).toBe(6000);
    expect(result.breakdown.timeCharge.amountPaise).toBe(1500);
    expect(result.breakdown.subtotalPaise).toBe(10000);
    expect(result.breakdown.taxes[0].amountPaise).toBe(500);
    expect(result.totalPaise).toBe(10500);
    expect(result.breakdown.minimumApplied).toBe(false);
  });

  it('applies minimum fare when trip is too short', () => {
    const result = calculateFare({
      config: baseConfig,
      distanceMetres: 500, // below minimumBillableDistanceMetres
      durationMinutes: 2,
    });
    // base 2500 + dist 1200 (1km min billable) + time 300 = 4000 > 3500 minimum
    // so minimum NOT applied here — let us use a shorter trip
    const result2 = calculateFare({
      config: baseConfig,
      distanceMetres: 200,
      durationMinutes: 0,
    });
    // base 2500 + dist 1200 (1km min) + time 0 = 3700 > 3500 minimum
    // still no minimum. Use zero distance config.
    const tinyConfig = { ...baseConfig, perKmPaise: 0, perMinutePaise: 0, baseFarePaise: 1000 };
    const result3 = calculateFare({ config: tinyConfig, distanceMetres: 0, durationMinutes: 0 });
    // base 1000 + dist 0 + time 0 = 1000 < minimum 3500
    expect(result3.breakdown.minimumApplied).toBe(true);
    expect(result3.breakdown.subtotalPaise).toBe(3500);
  });

  it('enforces minimum billable distance', () => {
    const result = calculateFare({
      config: baseConfig,
      distanceMetres: 300, // below 1000m minimum
      durationMinutes: 0,
    });
    expect(result.breakdown.distanceCharge.distanceMetres).toBe(1000);
  });

  it('calculates correctly with no taxes', () => {
    const noTaxConfig = { ...baseConfig, taxes: [] };
    const result = calculateFare({ config: noTaxConfig, distanceMetres: 5000, durationMinutes: 0 });
    expect(result.breakdown.totalTaxPaise).toBe(0);
    expect(result.totalPaise).toBe(result.breakdown.subtotalPaise);
  });

  it('rounds paise to integers — never produces decimals', () => {
    const result = calculateFare({
      config: baseConfig,
      distanceMetres: 3333, // 3.333 km
      durationMinutes: 7,
    });
    expect(Number.isInteger(result.totalPaise)).toBe(true);
    expect(Number.isInteger(result.breakdown.distanceCharge.amountPaise)).toBe(true);
    expect(Number.isInteger(result.breakdown.taxes[0].amountPaise)).toBe(true);
  });

  it('returns the config version and id in the result', () => {
    const result = calculateFare({ config: baseConfig, distanceMetres: 3000, durationMinutes: 5 });
    expect(result.fareConfigVersion).toBe(1);
    expect(result.fareConfigId).toBe('cfg1');
  });
});