/**
 * JSDoc typedefs for shared API shapes and enumerations.
 * Import this file to get IDE auto-complete via JSDoc.
 */

'use strict';

// ── Response Shapes ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} SuccessResponse
 * @property {true}   success     - Always true for success responses
 * @property {*}      data        - Response payload
 * @property {Object} [meta]      - Optional metadata (pagination, etc.)
 * @property {string} [requestId] - Echo of X-Request-Id header
 */

/**
 * @typedef {Object} ErrorResponse
 * @property {false}   success     - Always false for error responses
 * @property {string}  code        - Machine-readable error code (see ErrorCodes)
 * @property {string}  message     - Human-readable description
 * @property {Array}   [errors]    - Field-level validation errors
 * @property {string}  [requestId] - Echo of X-Request-Id header
 */

/**
 * @typedef {Object} PaginatedResponse
 * @property {true}   success
 * @property {Array}  data
 * @property {Object} meta
 * @property {number} meta.page       - Current page (1-based)
 * @property {number} meta.limit      - Items per page
 * @property {number} meta.total      - Total matching items
 * @property {number} meta.totalPages - Total pages
 * @property {boolean} meta.hasNext   - Whether a next page exists
 * @property {boolean} meta.hasPrev   - Whether a previous page exists
 */

// ── Enumerations ─────────────────────────────────────────────────────────────

/**
 * @typedef {'pending'|'confirmed'|'driver_assigned'|'in_progress'|'completed'|'cancelled'|'failed'} BookingStatus
 */
const BookingStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  DRIVER_ASSIGNED: 'driver_assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
};

/**
 * @typedef {'searching'|'en_route_pickup'|'arrived_pickup'|'in_progress'|'completed'|'cancelled'} RideStatus
 */
const RideStatus = {
  SEARCHING: 'searching',
  EN_ROUTE_PICKUP: 'en_route_pickup',
  ARRIVED_PICKUP: 'arrived_pickup',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

/**
 * @typedef {'pending'|'under_review'|'approved'|'rejected'|'expired'} DocumentStatus
 */
const DocumentStatus = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
};

/**
 * @typedef {'offline'|'available'|'on_ride'|'suspended'} CaptainStatus
 */
const CaptainStatus = {
  OFFLINE: 'offline',
  AVAILABLE: 'available',
  ON_RIDE: 'on_ride',
  SUSPENDED: 'suspended',
};

/**
 * @typedef {'auto'|'bike'|'cab_economy'|'cab_premium'|'ev_cab'} VehicleType
 */
const VehicleType = {
  AUTO: 'auto',
  BIKE: 'bike',
  CAB_ECONOMY: 'cab_economy',
  CAB_PREMIUM: 'cab_premium',
  EV_CAB: 'ev_cab',
};

/**
 * @typedef {'instant'|'scheduled'} BookingMode
 */
const BookingMode = {
  INSTANT: 'instant',
  SCHEDULED: 'scheduled',
};

/**
 * @typedef {'pending'|'authorized'|'captured'|'refunded'|'failed'} PaymentStatus
 */
const PaymentStatus = {
  PENDING: 'pending',
  AUTHORIZED: 'authorized',
  CAPTURED: 'captured',
  REFUNDED: 'refunded',
  FAILED: 'failed',
};

/**
 * @typedef {'pending'|'sent'|'accepted'|'declined'|'expired'} OfferStatus
 */
const OfferStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
};

module.exports = {
  BookingStatus,
  RideStatus,
  DocumentStatus,
  CaptainStatus,
  VehicleType,
  BookingMode,
  PaymentStatus,
  OfferStatus,
};
