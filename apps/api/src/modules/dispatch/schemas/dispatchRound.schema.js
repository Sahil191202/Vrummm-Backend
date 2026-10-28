import mongoose from 'mongoose';

const { Schema } = mongoose;

// One row per search round. A booking can have multiple rounds if nobody accepts.
const dispatchRoundSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    roundNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED'],
      default: 'ACTIVE',
      index: true,
    },
    searchRadiusMetres: { type: Number, required: true },
    offerDurationSeconds: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    // Captains found but skipped — reason recorded for each.
    skippedCaptains: [
      {
        captainId: { type: Schema.Types.ObjectId, ref: 'Captain' },
        reason: { type: String },
      },
    ],
    // Captains offered this round.
    offeredCaptainIds: [{ type: Schema.Types.ObjectId, ref: 'Captain' }],
    // Captain who accepted (populated when status → COMPLETED).
    acceptedCaptainId: { type: Schema.Types.ObjectId, ref: 'Captain', default: null },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

dispatchRoundSchema.index({ bookingId: 1, roundNumber: 1 });

export const DispatchRound = mongoose.model('DispatchRound', dispatchRoundSchema);