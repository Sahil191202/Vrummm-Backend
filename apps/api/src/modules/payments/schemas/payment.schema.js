import mongoose from 'mongoose';
import { PAYMENT_STATUSES, PAYMENT_PROVIDERS, CURRENCY } from '@vrumm/contracts';

const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    rideId: {
      type: Schema.Types.ObjectId,
      ref: 'Ride',
      required: true,
      index: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    customerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    captainUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      validate: {
        validator(v) {
          return Number.isInteger(v) && v > 0;
        },
        message: 'amountPaise must be a positive integer in paise',
      },
    },
    currency: {
      type: String,
      default: CURRENCY,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'PENDING',
      index: true,
    },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      required: true,
      default: 'MOCK',
    },
    providerOrderId: {
      type: String,
      required: true,
      index: true,
    },
    providerPaymentId: {
      type: String,
      index: true,
    },
    providerSignature: {
      type: String,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 1,
    },
    errorReason: {
      type: String,
      maxlength: 500,
    },
    capturedAt: {
      type: Date,
    },
    refundSimulatedAt: {
      type: Date,
    },
    refundSimulatedReason: {
      type: String,
      maxlength: 500,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true },
);

paymentSchema.index({ rideId: 1, status: 1 });
paymentSchema.index({ customerUserId: 1, createdAt: -1 });

export const Payment = mongoose.model('Payment', paymentSchema);
