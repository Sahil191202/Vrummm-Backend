'use strict';

const { addPaise, subtractPaise, percentOfPaise, formatInr } = require('../money');

describe('addPaise', () => {
  it('adds two positive paise amounts', () => {
    expect(addPaise(100, 50)).toBe(150);
  });

  it('adds zero to an amount', () => {
    expect(addPaise(500, 0)).toBe(500);
  });

  it('adds two large amounts', () => {
    expect(addPaise(1000000, 999999)).toBe(1999999);
  });

  it('throws if first argument is not an integer', () => {
    expect(() => addPaise(1.5, 10)).toThrow(TypeError);
  });

  it('throws if second argument is not an integer', () => {
    expect(() => addPaise(10, 2.7)).toThrow(TypeError);
  });

  it('handles negative paise (e.g. discounts)', () => {
    expect(addPaise(1000, -200)).toBe(800);
  });
});

describe('subtractPaise', () => {
  it('subtracts two amounts', () => {
    expect(subtractPaise(500, 200)).toBe(300);
  });

  it('returns zero when amounts are equal', () => {
    expect(subtractPaise(100, 100)).toBe(0);
  });

  it('returns a negative value when b > a', () => {
    expect(subtractPaise(100, 200)).toBe(-100);
  });

  it('throws if first argument is a float', () => {
    expect(() => subtractPaise(1.1, 1)).toThrow(TypeError);
  });

  it('throws if second argument is a float', () => {
    expect(() => subtractPaise(100, 0.5)).toThrow(TypeError);
  });

  it('subtracts zero from an amount', () => {
    expect(subtractPaise(750, 0)).toBe(750);
  });
});

describe('percentOfPaise', () => {
  it('calculates 5% (500 bps) of 10000 paise = 500 paise', () => {
    expect(percentOfPaise(10000, 500)).toBe(500);
  });

  it('calculates 10% (1000 bps) of 10000 paise = 1000 paise', () => {
    expect(percentOfPaise(10000, 1000)).toBe(1000);
  });

  it('calculates 1% (100 bps) of 10000 paise = 100 paise', () => {
    expect(percentOfPaise(10000, 100)).toBe(100);
  });

  it('rounds 0.5 to 1 (rounds half up)', () => {
    // 1 bp of 5000 = 5000/10000 = 0.5 → rounds to 1
    expect(percentOfPaise(5000, 1)).toBe(1);
  });

  it('rounds 0.4 to 0 (rounds half up, 0.4 → 0)', () => {
    // 1 bp of 4000 = 4000/10000 = 0.4 → rounds to 0
    expect(percentOfPaise(4000, 1)).toBe(0);
  });

  it('returns 0 for 0% of any amount', () => {
    expect(percentOfPaise(99999, 0)).toBe(0);
  });

  it('returns 0 for any % of 0', () => {
    expect(percentOfPaise(0, 500)).toBe(0);
  });

  it('throws if amountPaise is not an integer', () => {
    expect(() => percentOfPaise(100.5, 500)).toThrow(TypeError);
  });

  it('throws if basisPoints is not an integer', () => {
    expect(() => percentOfPaise(10000, 12.5)).toThrow(TypeError);
  });

  it('calculates platform commission (500 bps = 5%) on a large fare', () => {
    // ₹500 fare = 50000 paise; 5% commission = 2500 paise = ₹25
    expect(percentOfPaise(50000, 500)).toBe(2500);
  });
});

describe('formatInr', () => {
  it('formats 0 paise as ₹0.00', () => {
    expect(formatInr(0)).toBe('₹0.00');
  });

  it('formats 100 paise as ₹1.00', () => {
    expect(formatInr(100)).toBe('₹1.00');
  });

  it('formats 1250 paise as ₹12.50', () => {
    expect(formatInr(1250)).toBe('₹12.50');
  });

  it('formats 50000 paise as ₹500.00', () => {
    expect(formatInr(50000)).toBe('₹500.00');
  });

  it('formats 1 paise as ₹0.01', () => {
    expect(formatInr(1)).toBe('₹0.01');
  });

  it('formats large amounts', () => {
    expect(formatInr(1000000)).toBe('₹10000.00');
  });

  it('throws if paise is not an integer', () => {
    expect(() => formatInr(12.5)).toThrow(TypeError);
  });

  it('handles negative paise (refunds / credits)', () => {
    expect(formatInr(-500)).toBe('₹-5.00');
  });
});
