'use strict';

/**
 * Monetary helper functions.
 *
 * All amounts are in integer paise (1 INR = 100 paise).
 * NEVER use floating-point for totals.
 */

/**
 * Assert that a value is a safe integer.
 * @param {*} value
 * @param {string} name
 */
function assertInt(value, name) {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${name} must be an integer, got: ${value}`);
  }
}

/**
 * Add two paise amounts.
 * @param {number} a - Paise (integer)
 * @param {number} b - Paise (integer)
 * @returns {number} Sum in paise
 */
function addPaise(a, b) {
  assertInt(a, 'a');
  assertInt(b, 'b');
  return a + b;
}

/**
 * Subtract b from a in paise.
 * @param {number} a - Paise (integer)
 * @param {number} b - Paise (integer)
 * @returns {number} Difference in paise
 */
function subtractPaise(a, b) {
  assertInt(a, 'a');
  assertInt(b, 'b');
  return a - b;
}

/**
 * Calculate a percentage of an amount using basis points.
 * Result is rounded to the nearest integer paise.
 *
 * @param {number} amountPaise  - Base amount in paise (integer)
 * @param {number} basisPoints  - Rate in basis points (1 bp = 0.01%)
 * @returns {number} Result in paise (integer, rounded)
 *
 * @example
 *   percentOfPaise(10000, 500)  // 5% of ₹100 = ₹5 = 500 paise
 *   percentOfPaise(10001, 500)  // rounds 500.05 → 500
 */
function percentOfPaise(amountPaise, basisPoints) {
  assertInt(amountPaise, 'amountPaise');
  assertInt(basisPoints, 'basisPoints');
  return Math.round((amountPaise * basisPoints) / 10000);
}

/**
 * Format a paise amount as an INR string.
 * @param {number} paise - Integer paise
 * @returns {string} e.g. "₹12.50"
 */
function formatInr(paise) {
  assertInt(paise, 'paise');
  const rupees = paise / 100;
  return `₹${rupees.toFixed(2)}`;
}

module.exports = { addPaise, subtractPaise, percentOfPaise, formatInr };
