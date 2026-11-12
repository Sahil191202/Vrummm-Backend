import mongoose from 'mongoose';
import { PROMOTION_DISCOUNT_TYPES, VEHICLE_TYPES } from '@vrumm/contracts';

const { Schema } = mongoose;

const promotionSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    discountType: {
      type: String,
      enum: PROMOTION_DISCOUNT_TYPES,
      required: true,
    },
    // If PERCENTAGE: 1 to 100. If FLAT: integer paise.
    discountValue: {
      type: Number,
      required: true,
      min: 1,
    },
    // Optional ceiling cap for percentage discounts in integer paise.
    maxDiscountPaise: {
      type: Number,
      min: 1,
    },
    // Minimum fare required before discount can apply.
    minRideFarePaise: {
      type: Number,
      default: 0,
    },
    firstRideOnly: {
      type: Boolean,
      default: false,
    },
    allowedVehicleTypes: {
      type: [{ type: String, enum: VEHICLE_TYPES }],
      default: VEHICLE_TYPES,
    },
    maxTotalRedemptions: {
      type: Number,
      min: 1,
    },
    currentRedemptions: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxPerUserRedemptions: {
      type: Number,
      default: 1,
      min: 1,
    },
    startsAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

promotionSchema.index({ code: 1, isActive: 1 });

export const Promotion = mongoose.model('Promotion', promotionSchema);
