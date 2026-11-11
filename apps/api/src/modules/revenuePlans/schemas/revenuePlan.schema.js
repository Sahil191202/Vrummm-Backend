import mongoose from 'mongoose';
import { REVENUE_PLAN_TYPES, SUBSCRIPTION_BILLING_PERIODS } from '@vrumm/contracts';

const { Schema } = mongoose;

const revenuePlanSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: REVENUE_PLAN_TYPES,
      required: true,
      index: true,
    },
    // Commission rate in integer basis points (e.g. 300 = 3.00%, 350 = 3.50%).
    // Allowed range: 300 to 350 bps per product rules.
    commissionBps: {
      type: Number,
      min: 300,
      max: 350,
      validate: {
        validator(v) {
          if (this.type === 'COMMISSION') return Number.isInteger(v) && v >= 300 && v <= 350;
          return true;
        },
        message: 'Commission must be an integer between 300 and 350 basis points (3.00% to 3.50%)',
      },
    },
    // Simulated subscription plan settings (no real subscription billing).
    subscriptionPricePaise: {
      type: Number,
      validate: {
        validator(v) {
          if (this.type === 'SUBSCRIPTION') return Number.isInteger(v) && v > 0;
          return true;
        },
        message: 'Subscription price must be a positive integer in paise',
      },
    },
    subscriptionBillingPeriod: {
      type: String,
      enum: SUBSCRIPTION_BILLING_PERIODS,
      default: 'DAILY',
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

revenuePlanSchema.index({ type: 1, isActive: 1 });

export const RevenuePlan = mongoose.model('RevenuePlan', revenuePlanSchema);
