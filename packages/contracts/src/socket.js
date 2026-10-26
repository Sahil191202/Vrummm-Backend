// Socket.IO event names. Names are fixed now so clients can start coding against them.
// Payload shapes are added in the phase that emits each event (Phase 6 onwards).
export const SOCKET_EVENTS = Object.freeze({
  OFFER_NEW: 'offer.new',
  OFFER_EXPIRED: 'offer.expired',
  OFFER_ACCEPTED: 'offer.accepted',
  ASSIGNMENT_LOST: 'assignment.lost',
  BOOKING_SEARCH_STATUS: 'booking.searchStatus',
  BOOKING_NO_CAPTAIN: 'booking.noCaptain',
  RIDE_STATE_CHANGED: 'ride.stateChanged',
  RIDE_LOCATION_SIMULATED: 'ride.locationSimulated',
  SCHEDULED_BOOKING_CHANGED: 'booking.scheduledChanged',
  PAYMENT_STATUS: 'payment.status',
  SAFETY_INCIDENT: 'safety.incident',
  SESSION_REVOKED: 'session.revoked',
  OPS_DASHBOARD_UPDATE: 'ops.dashboardUpdate',
});

// Every event carries these fields so clients can drop duplicates and stale events.
export const SOCKET_EVENT_ENVELOPE_FIELDS = Object.freeze(['eventId', 'version', 'emittedAt']);
