import mongoose from 'mongoose';

const { Schema } = mongoose;

const incentiveAwardSchema = new Schema(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'IncentiveCampaign',
      required: true,
      index: true,
    },
    captainId: {
      type: Schema.Types.ObjectId,
      ref: 'Captain',
      required: true,
      index: true,
    },
    captainUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    periodKey: {
      type: String,
      required: true,
    },
    rewardAmountPaise: {
      type: Number,
      required: true,
      min: 1,
    },
    // Strictly unique composite idempotency key to prevent double-crediting
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    awardedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

incentiveAwardSchema.index({ campaignId: 1, captainId: 1, periodKey: 1 }, { unique: true });

export const IncentiveAward = mongoose.model('IncentiveAward', incentiveAwardSchema);
