import mongoose from 'mongoose';
import {
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_PRIORITIES,
} from '@vrumm/contracts';

const { Schema } = mongoose;

const supportMessageSchema = new Schema(
  {
    senderUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, required: true },
    message: { type: String, required: true, maxlength: 2000 },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const supportTicketSchema = new Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userRole: {
      type: String,
      required: true,
    },
    rideId: {
      type: Schema.Types.ObjectId,
      ref: 'Ride',
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      enum: SUPPORT_TICKET_CATEGORIES,
      default: 'OTHER',
      index: true,
    },
    priority: {
      type: String,
      enum: SUPPORT_TICKET_PRIORITIES,
      default: 'NORMAL',
      index: true,
    },
    status: {
      type: String,
      enum: SUPPORT_TICKET_STATUSES,
      default: 'OPEN',
      index: true,
    },
    messages: [supportMessageSchema],
    assignedToUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    resolvedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });

export const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
