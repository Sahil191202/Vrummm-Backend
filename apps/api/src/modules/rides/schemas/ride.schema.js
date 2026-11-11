import mongoose from 'mongoose';
import { VEHICLE_TYPES } from '@vrumm/contracts';

const { Schema } = mongoose;

const rideSchema = new Schema(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true,
      index: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    captainId: { type: Schema.Types.ObjectId, ref: 'Captain', required: true, index: true },
    customerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    captainUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },

    status: {
      type: String,
      enum: ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'ACCEPTED',
      index: true,
    },

    pickup: {
      address: { type: String, trim: true, maxlength: 300 },
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true },
      },
    },
    drop: {
      address: { type: String, trim: true, maxlength: 300 },
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true },
      },
    },

    // Trip PIN — stored as bcrypt hash only, never plaintext.
    tripPinHash: { type: String, required: true, select: false },
    pinAttempts: { type: Number, default: 0 },
    pinLockedUntil: { type: Date, default: null },
    pinVerifiedAt: { type: Date, default: null },

    // Fare snapshot copied from booking — never changes.
    fareSnapshot: { type: Schema.Types.Mixed, required: true },

    // Revenue plan snapshot — copied when ride is created (Phase 7).
    revenuePlanSnapshot: { type: Schema.Types.Mixed },

    // Payment state tracking (Phase 7).
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PENDING', 'PAID', 'REFUNDED'],
      default: 'UNPAID',
      index: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
    },

    // Timestamps for each state transition.
    arrivedAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: String, enum: ['CUSTOMER', 'CAPTAIN', 'SYSTEM', null], default: null },
    cancellationReason: { type: String, maxlength: 300 },

    // Actual distance and duration recorded at completion.
    actualDistanceMetres: { type: Number },
    actualDurationMinutes: { type: Number },

    // Location quality flag — set by the implausible-speed detector.
    locationFlagged: { type: Boolean, default: false },
    locationFlagReason: { type: String },
  },
  { timestamps: true },
);

rideSchema.index({ customerUserId: 1, status: 1 });
rideSchema.index({ captainUserId: 1, status: 1 });
rideSchema.index({ pickup: { location: '2dsphere' } });

export const Ride = mongoose.model('Ride', rideSchema);
