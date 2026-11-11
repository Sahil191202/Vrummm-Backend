import mongoose from 'mongoose';
import { PAYMENT_PROVIDERS } from '@vrumm/contracts';

const { Schema } = mongoose;

const webhookEventSchema = new Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      required: true,
      default: 'RAZORPAY',
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ['RECEIVED', 'PROCESSED', 'FAILED', 'DUPLICATE_IGNORED'],
      default: 'RECEIVED',
      index: true,
    },
    errorMessage: {
      type: String,
      maxlength: 1000,
    },
    processedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

webhookEventSchema.index({ provider: 1, eventType: 1, createdAt: -1 });

export const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
