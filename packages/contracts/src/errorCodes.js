/**
 * Machine-readable error code constants.
 * Use these as the `code` field in error responses.
 */

'use strict';

const ErrorCodes = {
  /** Request payload failed schema / business validation */
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  /** Missing or invalid authentication credentials */
  UNAUTHORIZED: 'UNAUTHORIZED',

  /** Authenticated but not permitted to perform this action */
  FORBIDDEN: 'FORBIDDEN',

  /** Requested resource does not exist */
  NOT_FOUND: 'NOT_FOUND',

  /** Resource already exists (e.g. duplicate phone) */
  CONFLICT: 'CONFLICT',

  /** Operation violates a business rule (e.g. captain not available) */
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',

  /** Too many requests — caller should back off */
  RATE_LIMITED: 'RATE_LIMITED',

  /** Unexpected server-side failure */
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  /** A request with the same idempotency key but different payload was received */
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
};

module.exports = { ErrorCodes };
