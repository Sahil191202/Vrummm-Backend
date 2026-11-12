import mongoose from 'mongoose';
import { INCENTIVE_TARGET_TYPES } from '@vrumm/contracts';

const { Schema } = mongoose;

const incentiveCampaignSchema = new Schema(
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
    targetType: {
      type: String,
      enum: INCENTIVE_TARGET_TYPES,
      required: true,
      index: true,
    },
    // Required count (e.g. 10 rides, 1 referral)
    targetCount: {
      type: Number,
      required: true,
      min: 1,
    },
    // Reward in integer paise (e.g. 5000 paise = Rs. 50)
    rewardAmountPaise: {
      type: Number,
      required: true,
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

incentiveCampaignSchema.index({ targetType: 1, isActive: 1 });

export const IncentiveCampaign = mongoose.model('IncentiveCampaign', incentiveCampaignSchema);
