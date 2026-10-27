import mongoose from 'mongoose';
import { VEHICLE_TYPES } from '@vrumm/contracts';

const { Schema } = mongoose;

const captainSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // Current location. Updated via the simulated location endpoint in Phase 6.
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },
    isOnline: { type: Boolean, default: false, index: true },
    // Approval status managed by Operations / Compliance.
    approvalStatus: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'],
      default: 'PENDING',
      index: true,
    },
    approvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, maxlength: 500 },
    // Preferred vehicle type (links to vehicle record).
    vehicleType: { type: String, enum: VEHICLE_TYPES },
    // Running counts.
    totalRides: { type: Number, default: 0 },
    totalEarnedPaise: { type: Number, default: 0 },
    rating: { type: Number, min: 1, max: 5, default: null },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

captainSchema.index({ location: '2dsphere' });
captainSchema.index({ isOnline: 1, approvalStatus: 1 });

export const Captain = mongoose.model('Captain', captainSchema);