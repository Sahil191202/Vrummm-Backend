/**
 * Socket.IO event name constants grouped by domain.
 * Use these on both server and client to avoid string typos.
 */

'use strict';

const SocketEvents = {
  // ── Offers ────────────────────────────────────────────────────────────────
  offers: {
    /** Server → Captain: a new ride offer is available */
    NEW_OFFER: 'offers:new_offer',
    /** Captain → Server: captain accepts the offer */
    ACCEPT: 'offers:accept',
    /** Captain → Server: captain declines the offer */
    DECLINE: 'offers:decline',
    /** Server → Captain: offer has expired or was taken */
    EXPIRED: 'offers:expired',
  },

  // ── Rides ─────────────────────────────────────────────────────────────────
  rides: {
    /** Server → Rider: captain is en-route to pickup */
    CAPTAIN_EN_ROUTE: 'rides:captain_en_route',
    /** Server → Rider/Captain: location update */
    LOCATION_UPDATE: 'rides:location_update',
    /** Server → Rider: captain has arrived at pickup */
    CAPTAIN_ARRIVED: 'rides:captain_arrived',
    /** Server → Rider/Captain: ride has started */
    STARTED: 'rides:started',
    /** Server → Rider/Captain: ride has ended */
    COMPLETED: 'rides:completed',
    /** Server → Rider/Captain: ride was cancelled */
    CANCELLED: 'rides:cancelled',
  },

  // ── Bookings ──────────────────────────────────────────────────────────────
  bookings: {
    /** Server → Rider: booking confirmed with captain details */
    CONFIRMED: 'bookings:confirmed',
    /** Server → Rider: no captain found, booking failed */
    FAILED: 'bookings:failed',
    /** Server → Rider: booking status changed */
    STATUS_CHANGED: 'bookings:status_changed',
  },

  // ── Payments ──────────────────────────────────────────────────────────────
  payments: {
    /** Server → Rider: payment captured successfully */
    CAPTURED: 'payments:captured',
    /** Server → Rider: payment failed */
    FAILED: 'payments:failed',
    /** Server → Captain: payout initiated */
    PAYOUT_INITIATED: 'payments:payout_initiated',
  },

  // ── Safety ────────────────────────────────────────────────────────────────
  safety: {
    /** Rider/Captain → Server: SOS triggered */
    SOS_TRIGGERED: 'safety:sos_triggered',
    /** Server → Admin room: SOS alert broadcast */
    SOS_ALERT: 'safety:sos_alert',
    /** Server → Rider/Captain: SOS acknowledged */
    SOS_ACKNOWLEDGED: 'safety:sos_acknowledged',
  },

  // ── Sessions ──────────────────────────────────────────────────────────────
  sessions: {
    /** Server → Client: session expired, re-authenticate */
    EXPIRED: 'sessions:expired',
    /** Server → Client: forced logout (e.g. account suspended) */
    FORCE_LOGOUT: 'sessions:force_logout',
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  admin: {
    /** Server → Admin room: real-time stats update */
    STATS_UPDATE: 'admin:stats_update',
    /** Server → Admin room: new captain KYC pending review */
    KYC_SUBMITTED: 'admin:kyc_submitted',
    /** Server → Admin room: surge pricing zone changed */
    SURGE_UPDATED: 'admin:surge_updated',
  },
};

module.exports = { SocketEvents };
