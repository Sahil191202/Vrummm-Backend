'use strict';

const { z } = require('zod');

// ── Pagination ────────────────────────────────────────────────────────────────

/**
 * Pagination query schema.
 * page: 1-based, default 1
 * limit: items per page, default 20, max 100
 */
const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : 1))
    .pipe(z.number().int().min(1, 'page must be at least 1')),
  limit: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1, 'limit must be at least 1').max(100, 'limit must not exceed 100')),
});

// ── Coordinates ───────────────────────────────────────────────────────────────

/**
 * GeoJSON coordinate pair [longitude, latitude].
 * Longitude: -180 to 180
 * Latitude:  -90 to 90
 */
const coordinatesSchema = z
  .tuple([
    z.number().min(-180, 'longitude must be >= -180').max(180, 'longitude must be <= 180'),
    z.number().min(-90, 'latitude must be >= -90').max(90, 'latitude must be <= 90'),
  ])
  .describe('GeoJSON coordinate pair [longitude, latitude]');

// ── Money ─────────────────────────────────────────────────────────────────────

/**
 * Monetary amount in paise (integer, non-negative).
 */
const moneyPaiseSchema = z
  .number()
  .int('amount must be an integer number of paise')
  .nonnegative('amount must be non-negative');

// ── Phone ─────────────────────────────────────────────────────────────────────

/**
 * Indian mobile number: 10 digits starting with 6-9.
 */
const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'must be a valid Indian mobile number (10 digits, starting with 6-9)');

// ── ObjectId ─────────────────────────────────────────────────────────────────

/**
 * MongoDB ObjectId: 24-character lowercase hexadecimal string.
 */
const objectIdSchema = z
  .string()
  .length(24, 'must be a 24-character ObjectId')
  .regex(/^[0-9a-f]{24}$/, 'must be a valid hexadecimal ObjectId');

// ── Date Range ────────────────────────────────────────────────────────────────

/**
 * Date range with optional from/to ISO 8601 strings.
 * Validates that `from` is not after `to` when both are provided.
 */
const dateRangeSchema = z
  .object({
    from: z.string().datetime({ message: 'from must be a valid ISO 8601 datetime' }).optional(),
    to: z.string().datetime({ message: 'to must be a valid ISO 8601 datetime' }).optional(),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return new Date(data.from) <= new Date(data.to);
      }
      return true;
    },
    { message: 'from must not be after to', path: ['from'] }
  );

// ── Search Query ──────────────────────────────────────────────────────────────

/**
 * Generic full-text search query parameter.
 * Minimum 1 char, maximum 200 chars.
 */
const searchQuerySchema = z
  .string()
  .trim()
  .min(1, 'search query must not be empty')
  .max(200, 'search query must not exceed 200 characters');

module.exports = {
  paginationSchema,
  coordinatesSchema,
  moneyPaiseSchema,
  phoneSchema,
  objectIdSchema,
  dateRangeSchema,
  searchQuerySchema,
};
