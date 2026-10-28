import mongoose from 'mongoose';
import { Captain } from '../captains/schemas/captain.schema.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { RideOffer } from './schemas/rideOffer.schema.js';
import { DispatchRound } from './schemas/dispatchRound.schema.js';
import { evaluateCaptainEligibility } from './distance.rules.js';
import { DISPATCH_CONFIG } from './dispatch.config.js';
import { errors } from '../../shared/AppError.js';

// ── Find eligible captains in radius ──────────────────────────────────────────
async function findEligibleCaptains(booking, searchRadiusMetres) {
  const pickupCoords = booking.pickup.location.coordinates;
  const dropCoords = booking.drop.location.coordinates;

  // Geo query: captains within radius, online, approved, correct vehicle type.
  const nearbyCaptains = await Captain.find({
    isOnline: true,
    approvalStatus: 'APPROVED',
    vehicleType: booking.vehicleType,
    location: {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: pickupCoords },
        $maxDistance: searchRadiusMetres,
      },
    },
  }).select('_id userId location');

  const eligible = [];
  const skipped = [];

  for (const captain of nearbyCaptains) {
    const captainCoords = captain.location.coordinates;
    const evaluation = evaluateCaptainEligibility(
      captainCoords,
      pickupCoords,
      dropCoords,
      booking.vehicleType,
      searchRadiusMetres,
    );

    if (evaluation.eligible) {
      eligible.push({ captain, evaluation });
    } else {
      skipped.push({
        captainId: captain._id,
        reason: evaluation.reason,
      });
    }
  }

  return { eligible, skipped };
}

// ── Create offers for one round ───────────────────────────────────────────────
async function createOffers(booking, round, eligibleCaptains, session) {
  const expiresAt = new Date(Date.now() + round.offerDurationSeconds * 1000);

  const offerDocs = eligibleCaptains.map(({ captain, evaluation }) => ({
    bookingId: booking._id,
    roundId: round._id,
    captainId: captain._id,
    userId: captain.userId,
    status: 'PENDING',
    expiresAt,
    distanceToPickupMetres: evaluation.distanceToPickupMetres,
    distanceToDropMetres: evaluation.distanceToDropMetres,
  }));

  if (offerDocs.length === 0) return [];
  return RideOffer.insertMany(offerDocs, { session });
}

// ── Run one dispatch round ────────────────────────────────────────────────────
export async function runDispatchRound(bookingId, logger) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw errors.notFound('Booking not found');
  if (booking.status !== 'SEARCHING') return { outcome: 'already_resolved', booking };

  // Find the last completed round to determine radius.
  const lastRound = await DispatchRound.findOne({ bookingId })
    .sort({ roundNumber: -1 });

  const roundNumber = lastRound ? lastRound.roundNumber + 1 : 1;
  const initialRadius = DISPATCH_CONFIG.initialRadiusMetres[booking.vehicleType];
  const expansion = DISPATCH_CONFIG.radiusExpansionMetres[booking.vehicleType];
  const maxRadius = DISPATCH_CONFIG.maxRadiusMetres[booking.vehicleType];
  const searchRadiusMetres = Math.min(
    initialRadius + (roundNumber - 1) * expansion,
    maxRadius,
  );

  if (roundNumber > DISPATCH_CONFIG.maxRounds) {
    // Exhausted all rounds.
    await Booking.updateOne({ _id: bookingId }, { $set: { status: 'NO_CAPTAIN' } });
    logger?.info({ bookingId, roundNumber }, 'dispatch exhausted');
    return { outcome: 'no_captain' };
  }

  const { eligible, skipped } = await findEligibleCaptains(booking, searchRadiusMetres);

  const expiresAt = new Date(Date.now() + DISPATCH_CONFIG.offerDurationSeconds * 1000);

  const session = await mongoose.startSession();
  let round;
  try {
    await session.withTransaction(async () => {
      [round] = await DispatchRound.create(
        [
          {
            bookingId,
            roundNumber,
            searchRadiusMetres,
            offerDurationSeconds: DISPATCH_CONFIG.offerDurationSeconds,
            expiresAt,
            skippedCaptains: skipped,
            offeredCaptainIds: eligible.map((e) => e.captain._id),
            status: 'ACTIVE',
          },
        ],
        { session },
      );

      if (eligible.length > 0) {
        await createOffers(booking, round, eligible, session);
      }
    });
  } finally {
    await session.endSession();
  }

  if (eligible.length === 0) {
    logger?.info({ bookingId, roundNumber, skipped: skipped.length }, 'no eligible captains this round');
    return { outcome: 'no_eligible', round };
  }

  logger?.info({ bookingId, roundNumber, offered: eligible.length }, 'offers sent');
  return { outcome: 'offers_sent', round };
}

// ── Atomic acceptance ─────────────────────────────────────────────────────────
// Two simultaneous accepts must never produce two assigned captains.
// We use findOneAndUpdate with state conditions as a compare-and-swap.
export async function acceptOffer(offerId, captainId, userId) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      // Step 1: atomically claim the offer — only if it is still PENDING.
      const offer = await RideOffer.findOneAndUpdate(
        { _id: offerId, captainId, status: 'PENDING' },
        { $set: { status: 'ACCEPTED', respondedAt: new Date() } },
        { new: true, session },
      );

      if (!offer) {
        throw errors.conflict('Offer is no longer available');
      }

      // Step 2: atomically assign the captain to the booking — only if it is still SEARCHING.
      const booking = await Booking.findOneAndUpdate(
        { _id: offer.bookingId, status: 'SEARCHING' },
        { $set: { status: 'ACCEPTED', captainId } },
        { new: true, session },
      );

      if (!booking) {
        // Booking was already accepted by another captain — roll back the offer claim.
        await RideOffer.updateOne(
          { _id: offerId },
          { $set: { status: 'SUPERSEDED' } },
          { session },
        );
        throw errors.conflict('Booking was already accepted by another captain');
      }

      // Step 3: expire all other pending offers for this booking.
      await RideOffer.updateMany(
        { bookingId: offer.bookingId, _id: { $ne: offerId }, status: 'PENDING' },
        { $set: { status: 'SUPERSEDED' } },
        { session },
      );

      // Step 4: close the dispatch round.
      await DispatchRound.updateOne(
        { _id: offer.roundId },
        { $set: { status: 'COMPLETED', acceptedCaptainId: captainId, completedAt: new Date() } },
        { session },
      );

      result = { offer, booking };
    });
  } finally {
    await session.endSession();
  }

  return result;
}

// ── Captain rejects an offer ──────────────────────────────────────────────────
export async function rejectOffer(offerId, captainId) {
  const offer = await RideOffer.findOneAndUpdate(
    { _id: offerId, captainId, status: 'PENDING' },
    { $set: { status: 'REJECTED', respondedAt: new Date() } },
    { new: true },
  );
  if (!offer) throw errors.conflict('Offer not found or already responded to');
  return offer;
}

// ── Expire offers for a round ─────────────────────────────────────────────────
export async function expireRoundOffers(roundId) {
  await RideOffer.updateMany(
    { roundId, status: 'PENDING' },
    { $set: { status: 'EXPIRED' } },
  );
  await DispatchRound.updateOne(
    { _id: roundId, status: 'ACTIVE' },
    { $set: { status: 'FAILED', completedAt: new Date() } },
  );
}