import { RideOffer } from './schemas/rideOffer.schema.js';
import { DispatchRound } from './schemas/dispatchRound.schema.js';
import { ScheduledDispatchJob } from './schemas/scheduledDispatchJob.schema.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { Captain } from '../captains/schemas/captain.schema.js';
import { runDispatchRound, acceptOffer, rejectOffer, expireRoundOffers } from './dispatch.engine.js';
import { errors } from '../../shared/AppError.js';

export function createDispatchService({ logger } = {}) {
  // Start dispatch for an instant booking. Called right after booking creation.
  async function startDispatch(bookingId) {
    return runDispatchRound(bookingId, logger);
  }

  // Advance to next round (called by offer expiry timer or manually by ops).
  async function advanceRound(bookingId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw errors.notFound('Booking not found');
    if (booking.status !== 'SEARCHING') {
      return { outcome: 'already_resolved', status: booking.status };
    }

    // Expire pending offers from the previous round.
    const lastRound = await DispatchRound.findOne({ bookingId, status: 'ACTIVE' });
    if (lastRound) await expireRoundOffers(lastRound._id);

    return runDispatchRound(bookingId, logger);
  }

  // Captain accepts an offer.
  async function captainAcceptOffer(offerId, captainUserId) {
    const captain = await Captain.findOne({ userId: captainUserId });
    if (!captain) throw errors.notFound('Captain profile not found');
    return acceptOffer(offerId, captain._id, captainUserId);
  }

  // Captain rejects an offer.
  async function captainRejectOffer(offerId, captainUserId) {
    const captain = await Captain.findOne({ userId: captainUserId });
    if (!captain) throw errors.notFound('Captain profile not found');
    return rejectOffer(offerId, captain._id);
  }

  // List pending offers for the current captain.
  async function listMyOffers(captainUserId) {
    const captain = await Captain.findOne({ userId: captainUserId });
    if (!captain) throw errors.notFound('Captain profile not found');

    const offers = await RideOffer.find({
      captainId: captain._id,
      status: 'PENDING',
      expiresAt: { $gt: new Date() },
    })
      .populate({
        path: 'bookingId',
        select: 'vehicleType pickup fareSnapshot mode scheduledFor',
      })
      .sort({ createdAt: -1 });

    // Strip drop location from offers — captains must not see the destination before accepting.
    return offers.map((o) => {
      const obj = o.toObject();
      if (obj.bookingId?.drop) delete obj.bookingId.drop;
      return obj;
    });
  }

  // Get dispatch status for a booking (for the customer's polling UI).
  async function getDispatchStatus(bookingId, userId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw errors.notFound('Booking not found');
    if (booking.userId.toString() !== userId) throw errors.forbidden('Access denied');

    const rounds = await DispatchRound.find({ bookingId }).sort({ roundNumber: 1 });
    return { bookingStatus: booking.status, rounds };
  }

  // Schedule dispatch for a future booking.
  async function scheduleDispatch(bookingId, runAt) {
    const existing = await ScheduledDispatchJob.findOne({ bookingId });
    if (existing) return existing;
    return ScheduledDispatchJob.create({ bookingId, runAt });
  }

  return {
    startDispatch,
    advanceRound,
    captainAcceptOffer,
    captainRejectOffer,
    listMyOffers,
    getDispatchStatus,
    scheduleDispatch,
  };
}