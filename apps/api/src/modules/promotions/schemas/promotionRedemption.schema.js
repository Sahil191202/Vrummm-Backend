import mongoose from 'mongoose';

const { Schema } = mongoose;

const promotionRedemptionSchema = new Schema(
  {
    promotionId: {
      type: Schema.Types.ObjectId,
      ref: 'Promotion',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    rideId: {
      type: Schema.Types.ObjectId,
      ref: 'Ride',
      required: true,
      index: true,
    },
    discountAppliedPaise: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Prevent duplicate redemptions of the same promo on the same ride
promotionRedemptionSchema.index({ promotionId: 1, rideId: 1 }, { unique: true });
promotionRedemptionSchema.index({ promotionId: 1, userId: 1 });

export const PromotionRedemption = mongoose.model('PromotionRedemption', promotionRedemptionSchema);
