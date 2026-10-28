import mongoose from 'mongoose';
import { Booking } from './schemas/booking.schema.js';
import { Customer } from '../customers/schemas/customer.schema.js';
import { errors } from '../../shared/AppError.js';

// Dispatch window for scheduled rides: open 15 minutes before scheduled time.
const SCHEDULED_DISPATCH_WINDOW_MINUTES = 15;

export function createBookingService({ fareService }) {
  async function createBooking(userId, data) {
    const { idempotencyKey, vehicleType, mode, pickup, drop, zone, scheduledFor } = data;

    // Idempotency check: return the existing booking if the key was used before.
    const existing = await Booking.findOne({ idempotencyKey });
    if (existing) return { booking: existing, wasIdempotent: true };

    // Customer profile must exist.
    const customer = await Customer.findOne({ userId });
    if (!customer) throw errors.notFound('Customer profile not found');

    // Get fare quote and pin the config version.
    const fareQuote = await fareService.getFareQuote({
      vehicleType,
      zone,
      pickupCoordinates: pickup.coordinates,
      dropCoordinates: drop.coordinates,
    });

    const bookingData = {
      customerId: customer._id,
      userId,
      idempotencyKey,
      vehicleType,
      mode,
      pickup: {
        address: pickup.address,
        location: { type: 'Point', coordinates: pickup.coordinates },
      },
      drop: {
        address: drop.address,
        location: { type: 'Point', coordinates: drop.coordinates },
      },
      fareSnapshot: {
        totalPaise: fareQuote.totalPaise,
        breakdown: fareQuote.breakdown,
        fareConfigId: fareQuote.fareConfigId,
        fareConfigVersion: fareQuote.fareConfigVersion,
        distanceMetres: fareQuote.distanceMetres,
        distanceMethod: fareQuote.distanceMethod,
      },
    };

    if (mode === 'SCHEDULED') {
      const scheduledDate = new Date(scheduledFor);
      bookingData.scheduledFor = scheduledDate;
      bookingData.scheduleWindowOpenAt = new Date(
        scheduledDate.getTime() - SCHEDULED_DISPATCH_WINDOW_MINUTES * 60 * 1000,
      );
    }

    // Use a transaction: if anything fails after the Booking is created
    // (e.g. customer counter update), the whole thing rolls back.
    const session = await mongoose.startSession();
    let booking;
    try {
      await session.withTransaction(async () => {
        const [created] = await Booking.create([bookingData], { session });
        booking = created;
      });
    } finally {
      await session.endSession();
    }

    return { booking, wasIdempotent: false };
  }

  async function getBooking(bookingId, userId, role) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw errors.notFound('Booking not found');

    // Customers can only see their own bookings.
    if (role === 'CUSTOMER' && booking.userId.toString() !== userId) {
      throw errors.forbidden('You can only view your own bookings');
    }

    return booking;
  }

  async function listBookings(userId, { page = 1, limit = 20, status } = {}) {
    const filter = { userId };
    if (status) filter.status = status;
    const total = await Booking.countDocuments(filter);
    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    return { bookings, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async function cancelBooking(bookingId, userId, role, { reason } = {}) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw errors.notFound('Booking not found');

    // Ownership check
    if (role === 'CUSTOMER' && booking.userId.toString() !== userId) {
      throw errors.forbidden('You can only cancel your own bookings');
    }

    const cancellableStatuses = ['SEARCHING', 'ACCEPTED'];
    if (!cancellableStatuses.includes(booking.status)) {
      throw errors.businessRule(
        `Cannot cancel a booking with status ${booking.status}`,
        { currentStatus: booking.status, cancellableStatuses },
      );
    }

    const updated = await Booking.findOneAndUpdate(
      { _id: bookingId, status: { $in: cancellableStatuses } },
      {
        $set: {
          status: 'CANCELLED',
          cancelledBy: role === 'CUSTOMER' ? 'CUSTOMER' : 'SYSTEM',
          cancellationReason: reason,
          cancelledAt: new Date(),
        },
      },
      { new: true },
    );

    // Race condition: another process cancelled it between our read and write.
    if (!updated) throw errors.conflict('Booking was already updated by another process');

    return updated;
  }

  // Admin: list all bookings across customers
  async function listAllBookings({ page = 1, limit = 20, status, customerId } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (customerId) filter.customerId = customerId;
    const total = await Booking.countDocuments(filter);
    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'email displayName');
    return { bookings, total, page, limit, pages: Math.ceil(total / limit) };
  }

  return { createBooking, getBooking, listBookings, cancelBooking, listAllBookings };
}