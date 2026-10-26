'use strict';

const {
  paginationSchema,
  coordinatesSchema,
  moneyPaiseSchema,
  phoneSchema,
  objectIdSchema,
  dateRangeSchema,
  searchQuerySchema,
} = require('../common');

// ── paginationSchema ──────────────────────────────────────────────────────────

describe('paginationSchema', () => {
  it('uses defaults when no params provided', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('parses string page and limit to numbers', () => {
    const result = paginationSchema.parse({ page: '3', limit: '50' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('rejects page < 1', () => {
    expect(() => paginationSchema.parse({ page: '0' })).toThrow();
  });

  it('rejects limit > 100', () => {
    expect(() => paginationSchema.parse({ limit: '101' })).toThrow();
  });

  it('accepts limit of exactly 100', () => {
    const result = paginationSchema.parse({ limit: '100' });
    expect(result.limit).toBe(100);
  });

  it('accepts page of 1', () => {
    const result = paginationSchema.parse({ page: '1' });
    expect(result.page).toBe(1);
  });
});

// ── coordinatesSchema ─────────────────────────────────────────────────────────

describe('coordinatesSchema', () => {
  it('accepts valid [lon, lat] pair', () => {
    const result = coordinatesSchema.parse([72.8777, 19.076]);
    expect(result).toEqual([72.8777, 19.076]);
  });

  it('accepts boundary values [180, 90]', () => {
    const result = coordinatesSchema.parse([180, 90]);
    expect(result).toEqual([180, 90]);
  });

  it('accepts boundary values [-180, -90]', () => {
    const result = coordinatesSchema.parse([-180, -90]);
    expect(result).toEqual([-180, -90]);
  });

  it('rejects longitude > 180', () => {
    expect(() => coordinatesSchema.parse([181, 0])).toThrow();
  });

  it('rejects longitude < -180', () => {
    expect(() => coordinatesSchema.parse([-181, 0])).toThrow();
  });

  it('rejects latitude > 90', () => {
    expect(() => coordinatesSchema.parse([0, 91])).toThrow();
  });

  it('rejects latitude < -90', () => {
    expect(() => coordinatesSchema.parse([0, -91])).toThrow();
  });

  it('rejects non-array', () => {
    expect(() => coordinatesSchema.parse({ lon: 72, lat: 19 })).toThrow();
  });
});

// ── moneyPaiseSchema ──────────────────────────────────────────────────────────

describe('moneyPaiseSchema', () => {
  it('accepts 0', () => {
    expect(moneyPaiseSchema.parse(0)).toBe(0);
  });

  it('accepts positive integers', () => {
    expect(moneyPaiseSchema.parse(50000)).toBe(50000);
  });

  it('rejects negative amounts', () => {
    expect(() => moneyPaiseSchema.parse(-1)).toThrow();
  });

  it('rejects floats', () => {
    expect(() => moneyPaiseSchema.parse(12.5)).toThrow();
  });

  it('rejects strings', () => {
    expect(() => moneyPaiseSchema.parse('100')).toThrow();
  });
});

// ── phoneSchema ───────────────────────────────────────────────────────────────

describe('phoneSchema', () => {
  it('accepts a valid Indian mobile starting with 9', () => {
    expect(phoneSchema.parse('9876543210')).toBe('9876543210');
  });

  it('accepts a valid Indian mobile starting with 6', () => {
    expect(phoneSchema.parse('6543219870')).toBe('6543219870');
  });

  it('accepts a valid Indian mobile starting with 7', () => {
    expect(phoneSchema.parse('7001234567')).toBe('7001234567');
  });

  it('accepts a valid Indian mobile starting with 8', () => {
    expect(phoneSchema.parse('8123456789')).toBe('8123456789');
  });

  it('rejects number starting with 5', () => {
    expect(() => phoneSchema.parse('5123456789')).toThrow();
  });

  it('rejects number starting with 0', () => {
    expect(() => phoneSchema.parse('0123456789')).toThrow();
  });

  it('rejects 9-digit number', () => {
    expect(() => phoneSchema.parse('987654321')).toThrow();
  });

  it('rejects 11-digit number', () => {
    expect(() => phoneSchema.parse('98765432101')).toThrow();
  });

  it('rejects number with country code prefix', () => {
    expect(() => phoneSchema.parse('+919876543210')).toThrow();
  });

  it('rejects non-numeric string', () => {
    expect(() => phoneSchema.parse('abcdefghij')).toThrow();
  });
});

// ── objectIdSchema ────────────────────────────────────────────────────────────

describe('objectIdSchema', () => {
  it('accepts a valid 24-char hex ObjectId', () => {
    const id = '507f1f77bcf86cd799439011';
    expect(objectIdSchema.parse(id)).toBe(id);
  });

  it('rejects a 23-char string', () => {
    expect(() => objectIdSchema.parse('507f1f77bcf86cd79943901')).toThrow();
  });

  it('rejects a 25-char string', () => {
    expect(() => objectIdSchema.parse('507f1f77bcf86cd7994390111')).toThrow();
  });

  it('rejects a string with uppercase letters', () => {
    expect(() => objectIdSchema.parse('507F1F77BCF86CD799439011')).toThrow();
  });

  it('rejects a string with non-hex characters', () => {
    expect(() => objectIdSchema.parse('507f1f77bcf86cd79943901g')).toThrow();
  });
});

// ── dateRangeSchema ───────────────────────────────────────────────────────────

describe('dateRangeSchema', () => {
  it('accepts empty object (both optional)', () => {
    const result = dateRangeSchema.parse({});
    expect(result).toEqual({});
  });

  it('accepts only from', () => {
    const result = dateRangeSchema.parse({ from: '2024-01-01T00:00:00.000Z' });
    expect(result.from).toBe('2024-01-01T00:00:00.000Z');
  });

  it('accepts only to', () => {
    const result = dateRangeSchema.parse({ to: '2024-12-31T23:59:59.000Z' });
    expect(result.to).toBe('2024-12-31T23:59:59.000Z');
  });

  it('accepts valid from < to range', () => {
    const result = dateRangeSchema.parse({
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-12-31T23:59:59.000Z',
    });
    expect(result.from).toBeDefined();
    expect(result.to).toBeDefined();
  });

  it('accepts from === to (same instant)', () => {
    const iso = '2024-06-15T12:00:00.000Z';
    const result = dateRangeSchema.parse({ from: iso, to: iso });
    expect(result.from).toBe(iso);
  });

  it('rejects from > to', () => {
    expect(() =>
      dateRangeSchema.parse({
        from: '2024-12-31T23:59:59.000Z',
        to: '2024-01-01T00:00:00.000Z',
      })
    ).toThrow();
  });

  it('rejects invalid datetime string', () => {
    expect(() => dateRangeSchema.parse({ from: 'not-a-date' })).toThrow();
  });
});

// ── searchQuerySchema ─────────────────────────────────────────────────────────

describe('searchQuerySchema', () => {
  it('accepts a valid search string', () => {
    expect(searchQuerySchema.parse('Mumbai Central')).toBe('Mumbai Central');
  });

  it('trims whitespace', () => {
    expect(searchQuerySchema.parse('  hello  ')).toBe('hello');
  });

  it('rejects empty string', () => {
    expect(() => searchQuerySchema.parse('')).toThrow();
  });

  it('rejects whitespace-only string (after trim becomes empty)', () => {
    expect(() => searchQuerySchema.parse('   ')).toThrow();
  });

  it('rejects string longer than 200 chars', () => {
    expect(() => searchQuerySchema.parse('a'.repeat(201))).toThrow();
  });

  it('accepts exactly 200 chars', () => {
    const s = 'a'.repeat(200);
    expect(searchQuerySchema.parse(s)).toBe(s);
  });
});
