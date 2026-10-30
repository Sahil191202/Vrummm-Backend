import mongoose from 'mongoose';
import { VEHICLE_TYPES, BOOKING_MODES } from '@vrumm/contracts';

const { Schema } = mongoose;

const coordinatesSchema = {
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], required: true },
};

const bookingSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Prevents duplicate bookings on client retries.
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    mode: { type: String, enum: BOOKING_MODES, required: true, default: 'INSTANT' },

    pickup: {
      address: { type: String, trim: true, maxlength: 300 },
      location: coordinatesSchema,
    },
    drop: {
      address: { type: String, trim: true, maxlength: 300 },
      location: coordinatesSchema,
    },

    status: {
      type: String,
      enum: [
        'SEARCHING',    // Dispatch is looking for a captain
        'ACCEPTED',     // A captain has accepted
        'ARRIVED',      // Captain is at the pickup point
        'IN_PROGRESS',  // Ride has started (PIN verified)
        'COMPLETED',    // Ride finished
        'CANCELLED',    // Cancelled by customer, captain or system
        'NO_CAPTAIN',   // Search exhausted with no captain found
      ],
      default: 'SEARCHING',
      index: true,
    },

    // Scheduled ride fields
    scheduledFor: { type: Date, default: null },
    scheduleWindowOpenAt: { type: Date, default: null },

    // Fare snapshot — pinned at booking creation, never changed afterward.
    // Config version recorded so fare logic can be audited regardless of
    // how many times the fare config changes later.
    fareSnapshot: {
      totalPaise: { type: Number, required: true },
      breakdown: { type: Schema.Types.Mixed, required: true },
      fareConfigId: {
        type: Schema.Types.ObjectId,
        ref: 'FareConfig',
        required: true,
      },
      fareConfigVersion: { type: Number, required: true },
      distanceMetres: { type: Number, required: true },
      distanceMethod: { type: String, default: 'haversine' },
    },

    // Filled in by dispatch (Phase 5).
    captainId: {
      type: Schema.Types.ObjectId,
      ref: 'Captain',
      default: null,
      index: true,
    },
    // Filled in when the ride record is created (Phase 6).
    rideId: { type: Schema.Types.ObjectId, ref: 'Ride', default: null },

    // Cancellation details
    cancelledBy: {
      type: String,
      enum: ['CUSTOMER', 'CAPTAIN', 'SYSTEM', null],
      default: null,
    },
    cancellationReason: { type: String, maxlength: 300 },
    cancelledAt: { type: Date },

    // Promo applied at booking time (Phase 8).
    promoCode: { type: String },
    discountPaise: { type: Number, default: 0 },
  },
  { timestamps: true },
);

bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ customerId: 1, createdAt: -1 });

export const Booking = mongoose.model('Booking', bookingSchema);