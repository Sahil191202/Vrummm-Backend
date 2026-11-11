import mongoose from 'mongoose';
import {
  LEDGER_ACCOUNT_TYPES,
  LEDGER_ENTRY_TYPES,
  LEDGER_DIRECTIONS,
  CURRENCY,
} from '@vrumm/contracts';

const { Schema } = mongoose;

const ledgerEntrySchema = new Schema(
  {
    rideId: {
      type: Schema.Types.ObjectId,
      ref: 'Ride',
      index: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      index: true,
    },
    accountType: {
      type: String,
      enum: LEDGER_ACCOUNT_TYPES,
      required: true,
      index: true,
    },
    // The user whose balance this entry affects (customer or captain), or system admin for PLATFORM.
    accountUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    entryType: {
      type: String,
      enum: LEDGER_ENTRY_TYPES,
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: LEDGER_DIRECTIONS,
      required: true,
    },
    // Amount is positive integer paise.
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
    // For idempotency across retries or webhook duplicates.
    idempotencyKey: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    // Audit reason required for manual adjustments or simulated refunds.
    auditReason: {
      type: String,
      maxlength: 500,
    },
    postedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Append-only: no updatedAt timestamp
  },
);

// Immutability enforcement: block any update or delete operations on posted ledger entries.
const disallowMutation = function () {
  throw new Error(
    'Ledger is append-only. Editing or deleting posted entries is strictly forbidden.',
  );
};

ledgerEntrySchema.pre('updateOne', disallowMutation);
ledgerEntrySchema.pre('updateMany', disallowMutation);
ledgerEntrySchema.pre('findOneAndUpdate', disallowMutation);
ledgerEntrySchema.pre('deleteOne', disallowMutation);
ledgerEntrySchema.pre('deleteMany', disallowMutation);
ledgerEntrySchema.pre('findOneAndDelete', disallowMutation);

ledgerEntrySchema.index({ accountUserId: 1, accountType: 1, createdAt: -1 });

export const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);
