'use strict';

/**
 * Application-wide constants.
 * These are business/operational values — not secrets (which live in env).
 */

// ── Authentication & PIN ──────────────────────────────────────────────────────

/** Maximum number of wrong PIN attempts before account is locked */
const MAX_PIN_ATTEMPTS = 5;

/** Duration (minutes) for which a PIN-locked account stays locked */
const PIN_LOCK_MINUTES = 15;

/** Length of OTP sent via SMS */
const OTP_LENGTH = 6;

/** OTP validity duration in minutes */
const OTP_EXPIRES_MINUTES = 10;

/** Maximum OTP send attempts per session */
const MAX_OTP_ATTEMPTS = 3;

// ── JWT ───────────────────────────────────────────────────────────────────────

/** Access token lifetime */
const JWT_ACCESS_EXPIRES_IN = '15m';

/** Refresh token lifetime */
const JWT_REFRESH_EXPIRES_IN = '30d';

// ── Ride / Booking ────────────────────────────────────────────────────────────

/** Radius (metres) within which to search for nearby captains */
const CAPTAIN_SEARCH_RADIUS_METRES = 5000;

/** How long (seconds) a captain has to accept a ride offer */
const OFFER_TIMEOUT_SECONDS = 30;

/** Maximum number of captains to offer a ride to concurrently */
const MAX_OFFER_TARGETS = 3;

/** How long (seconds) to wait before auto-cancelling a booking with no captain */
const BOOKING_SEARCH_TIMEOUT_SECONDS = 300;

/** Minimum cancellation window (minutes) for scheduled bookings */
const SCHEDULED_CANCELLATION_WINDOW_MINUTES = 15;

// ── Pricing ───────────────────────────────────────────────────────────────────

/** Platform commission in basis points (500 bp = 5%) */
const PLATFORM_COMMISSION_BPS = 500;

/** Minimum fare in paise (₹30) */
const MINIMUM_FARE_PAISE = 3000;

// ── Pagination ────────────────────────────────────────────────────────────────

/** Default page size */
const DEFAULT_PAGE_SIZE = 20;

/** Maximum allowed page size */
const MAX_PAGE_SIZE = 100;

// ── Storage ───────────────────────────────────────────────────────────────────

/** Maximum file size for document uploads (5 MB in bytes) */
const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;

/** Allowed MIME types for document uploads */
const ALLOWED_DOCUMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

/** Presigned URL expiry in seconds (1 hour) */
const PRESIGNED_URL_EXPIRY_SECONDS = 3600;

// ── API ───────────────────────────────────────────────────────────────────────

/** API version prefix */
const API_VERSION = 'v1';

/** JSON body size limit */
const BODY_LIMIT = '10kb';

module.exports = {
  MAX_PIN_ATTEMPTS,
  PIN_LOCK_MINUTES,
  OTP_LENGTH,
  OTP_EXPIRES_MINUTES,
  MAX_OTP_ATTEMPTS,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  CAPTAIN_SEARCH_RADIUS_METRES,
  OFFER_TIMEOUT_SECONDS,
  MAX_OFFER_TARGETS,
  BOOKING_SEARCH_TIMEOUT_SECONDS,
  SCHEDULED_CANCELLATION_WINDOW_MINUTES,
  PLATFORM_COMMISSION_BPS,
  MINIMUM_FARE_PAISE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_DOCUMENT_SIZE_BYTES,
  ALLOWED_DOCUMENT_MIME_TYPES,
  PRESIGNED_URL_EXPIRY_SECONDS,
  API_VERSION,
  BODY_LIMIT,
};
