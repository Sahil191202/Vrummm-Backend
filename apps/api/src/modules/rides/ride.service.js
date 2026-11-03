import { randomInt } from 'node:crypto';
import bcrypt from 'bcrypt';
import { Ride } from './schemas/ride.schema.js';
import { RideLocationSample } from './schemas/rideLocationSample.schema.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { Captain } from '../captains/schemas/captain.schema.js';
import { errors } from '../../shared/AppError.js';
import { haversineMetres } from '../../shared/haversine.js';
import { emit } from '../socket/socket.service.js';
import { SOCKET_EVENTS } from '@vrumm/contracts';

const PIN_BCRYPT_ROUNDS = 10;
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;
const IMPLAUSIBLE_SPEED_KMH = 150;

function generatePin() {
  return String(randomInt(0, 9999)).padStart(4, '0');
}

export function createRideService({ io } = {}) {
  // Called by dispatch after captain acceptance to create the Ride record.
  async function createRide({ bookingId, captainId, captainUserId }, session) {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) throw errors.notFound('Booking not found');

    const pin = generatePin();
    const tripPinHash = await bcrypt.hash(pin, PIN_BCRYPT_ROUNDS);

    const [ride] = await Ride.create(
      [
        {
          bookingId: booking._id,
          customerId: booking.customerId,
          captainId,
          customerUserId: booking.userId,
          captainUserId,
          vehicleType: booking.vehicleType,
          pickup: booking.pickup,
          drop: booking.drop,
          fareSnapshot: booking.fareSnapshot,
          tripPinHash,
        },
      ],
      { session },
    );

    await Booking.updateOne({ _id: bookingId }, { $set: { rideId: ride._id } }, { session });

    await emit.toUser(io, booking.userId, SOCKET_EVENTS.RIDE_STATE_CHANGED, {
      rideId: ride._id,
      status: 'ACCEPTED',
      bookingId,
    }, session);

    // PIN returned once to the captain — never stored plaintext.
    return { ride, pin };
  }

  // Captain signals arrival at the pickup location.
  async function captainArrived(rideId, captainUserId) {
    const ride = await _requireRideForCaptain(rideId, captainUserId, 'ACCEPTED');
    const updated = await Ride.findOneAndUpdate(
      { _id: rideId, status: 'ACCEPTED' },
      { $set: { status: 'ARRIVED', arrivedAt: new Date() } },
      { new: true },
    );
    if (!updated) throw errors.conflict('Ride state changed concurrently');

    await emit.toRide(io, rideId, SOCKET_EVENTS.RIDE_STATE_CHANGED, {
      rideId,
      status: 'ARRIVED',
    });
    await emit.toUser(io, String(ride.customerUserId), SOCKET_EVENTS.RIDE_STATE_CHANGED, {
      rideId,
      status: 'ARRIVED',
    });
    return updated;
  }

  // Customer submits PIN — starts the ride when correct.
  async function verifyPinAndStart(rideId, customerUserId, pin) {
    // Use projection second argument to include the select:false tripPinHash field.
    const ride = await Ride.findOne({ _id: rideId, customerUserId }, '+tripPinHash');
    if (!ride) throw errors.notFound('Ride not found');

    if (ride.status !== 'ARRIVED') {
      throw errors.businessRule('PIN can only be submitted once the captain has arrived', {
        currentStatus: ride.status,
      });
    }

    if (ride.pinLockedUntil && ride.pinLockedUntil > new Date()) {
      const waitSecs = Math.ceil((ride.pinLockedUntil - Date.now()) / 1000);
      throw errors.businessRule(`PIN entry is locked. Try again in ${waitSecs} seconds.`, {
        lockedUntilIso: ride.pinLockedUntil.toISOString(),
      });
    }

    const match = await bcrypt.compare(pin, ride.tripPinHash);

    if (!match) {
      const attempts = ride.pinAttempts + 1;
      const update = { pinAttempts: attempts };
      if (attempts >= MAX_PIN_ATTEMPTS) {
        update.pinLockedUntil = new Date(Date.now() + PIN_LOCK_MINUTES * 60 * 1000);
      }
      await Ride.updateOne({ _id: rideId }, { $set: update });
      throw errors.businessRule(
        `Incorrect PIN. ${MAX_PIN_ATTEMPTS - attempts} attempt(s) remaining.`,
        { attemptsRemaining: MAX_PIN_ATTEMPTS - attempts },
      );
    }

    const updated = await Ride.findOneAndUpdate(
      { _id: rideId, status: 'ARRIVED' },
      {
        $set: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          pinAttempts: 0,
          pinVerifiedAt: new Date(),
        },
      },
      { new: true },
    );
    if (!updated) throw errors.conflict('Ride state changed concurrently');

    await emit.toRide(io, rideId, SOCKET_EVENTS.RIDE_STATE_CHANGED, {
      rideId,
      status: 'IN_PROGRESS',
      startedAt: updated.startedAt,
    });
    await emit.toUser(io, String(ride.captainUserId), SOCKET_EVENTS.RIDE_STATE_CHANGED, {
      rideId,
      status: 'IN_PROGRESS',
    });
    return updated;
  }

  // Captain submits a simulated location sample.
  async function addLocationSample(rideId, captainUserId, { coordinates, recordedAt }) {
    const ride = await _requireRideForCaptain(rideId, captainUserId, 'IN_PROGRESS');

    const prevSample = await RideLocationSample.findOne({ rideId }).sort({ recordedAt: -1 });

    let speedKmh = null;
    let implausible = false;

    if (prevSample) {
      const distMetres = haversineMetres(prevSample.coordinates, coordinates);
      const timeDiffMs = new Date(recordedAt) - new Date(prevSample.recordedAt);
      if (timeDiffMs > 0) {
        speedKmh = distMetres / 1000 / (timeDiffMs / 3_600_000);
        implausible = speedKmh > IMPLAUSIBLE_SPEED_KMH;
      }
    }

    const sample = await RideLocationSample.create({
      rideId,
      captainId: ride.captainId,
      coordinates,
      speedKmh: speedKmh !== null ? Math.round(speedKmh * 10) / 10 : null,
      implausible,
      recordedAt: new Date(recordedAt),
    });

    if (implausible) {
      await Ride.updateOne(
        { _id: rideId },
        {
          $set: {
            locationFlagged: true,
            locationFlagReason: `Speed ${Math.round(speedKmh)} km/h detected`,
          },
        },
      );
    }

    await Captain.updateOne(
      { _id: ride.captainId },
      { $set: { location: { type: 'Point', coordinates } } },
    );

    await emit.toRide(io, rideId, SOCKET_EVENTS.RIDE_LOCATION_SIMULATED, {
      rideId,
      coordinates,
      speedKmh: sample.speedKmh,
      implausible,
      recordedAt,
    });

    return sample;
  }

  // Captain completes the ride.
  async function completeRide(rideId, captainUserId, { coordinates }) {
    const ride = await _requireRideForCaptain(rideId, captainUserId, 'IN_PROGRESS');

    const samples = await RideLocationSample.find({ rideId }).sort({ recordedAt: 1 });
    let actualDistanceMetres = 0;
    for (let i = 1; i < samples.length; i++) {
      actualDistanceMetres += haversineMetres(samples[i - 1].coordinates, samples[i].coordinates);
    }

    const actualDurationMinutes = ride.startedAt
      ? Math.round((Date.now() - ride.startedAt.getTime()) / 60_000)
      : null;

    const updated = await Ride.findOneAndUpdate(
      { _id: rideId, status: 'IN_PROGRESS' },
      {
        $set: {
          status: 'COMPLETED',
          completedAt: new Date(),
          actualDistanceMetres: Math.round(actualDistanceMetres),
          actualDurationMinutes,
        },
      },
      { new: true },
    );
    if (!updated) throw errors.conflict('Ride state changed concurrently');

    await Booking.updateOne({ _id: ride.bookingId }, { $set: { status: 'COMPLETED' } });
    await Captain.updateOne(
      { _id: ride.captainId },
      { $set: { isOnline: false, location: { type: 'Point', coordinates } } },
    );

    await emit.toRide(io, rideId, SOCKET_EVENTS.RIDE_STATE_CHANGED, {
      rideId,
      status: 'COMPLETED',
      completedAt: updated.completedAt,
      actualDistanceMetres: updated.actualDistanceMetres,
      fareSnapshot: ride.fareSnapshot,
    });
    await emit.toUser(io, String(ride.customerUserId), SOCKET_EVENTS.RIDE_STATE_CHANGED, {
      rideId,
      status: 'COMPLETED',
    });
    return updated;
  }

  async function cancelRide(rideId, userId, role, { reason } = {}) {
    const ride = await Ride.findById(rideId);
    if (!ride) throw errors.notFound('Ride not found');

    const cancellableStatuses = ['ACCEPTED', 'ARRIVED'];
    if (!cancellableStatuses.includes(ride.status)) {
      throw errors.businessRule(`Cannot cancel a ride with status ${ride.status}`, {
        currentStatus: ride.status,
      });
    }

    const isCaptain = role === 'CAPTAIN' && String(ride.captainUserId) === userId;
    const isCustomer = role === 'CUSTOMER' && String(ride.customerUserId) === userId;
    if (!isCaptain && !isCustomer) throw errors.forbidden('You are not part of this ride');

    const updated = await Ride.findOneAndUpdate(
      { _id: rideId, status: { $in: cancellableStatuses } },
      {
        $set: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: role,
          cancellationReason: reason,
        },
      },
      { new: true },
    );
    if (!updated) throw errors.conflict('Ride state changed concurrently');

    await Booking.updateOne(
      { _id: ride.bookingId },
      {
        $set: {
          status: 'CANCELLED',
          cancelledBy: role,
          cancellationReason: reason,
          cancelledAt: new Date(),
        },
      },
    );

    await emit.toRide(io, rideId, SOCKET_EVENTS.RIDE_STATE_CHANGED, {
      rideId,
      status: 'CANCELLED',
      cancelledBy: role,
    });
    return updated;
  }

  async function getRide(rideId, userId, role) {
    const ride = await Ride.findById(rideId);
    if (!ride) throw errors.notFound('Ride not found');
    const allowed =
      String(ride.customerUserId) === userId ||
      String(ride.captainUserId) === userId ||
      ['SUPER_ADMIN', 'OPERATIONS', 'SUPPORT'].includes(role);
    if (!allowed) throw errors.forbidden('You are not part of this ride');
    return ride;
  }

  async function listRidesForUser(userId, role, { page = 1, limit = 20 } = {}) {
    const filter = role === 'CAPTAIN' ? { captainUserId: userId } : { customerUserId: userId };
    const total = await Ride.countDocuments(filter);
    const rides = await Ride.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    return { rides, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async function _requireRideForCaptain(rideId, captainUserId, expectedStatus) {
    const ride = await Ride.findOne({ _id: rideId, captainUserId });
    if (!ride) throw errors.notFound('Ride not found');
    if (ride.status !== expectedStatus) {
      throw errors.businessRule(
        `Expected ride status ${expectedStatus}, got ${ride.status}`,
        { currentStatus: ride.status },
      );
    }
    return ride;
  }

  return {
    createRide,
    captainArrived,
    verifyPinAndStart,
    addLocationSample,
    completeRide,
    cancelRide,
    getRide,
    listRidesForUser,
  };
}