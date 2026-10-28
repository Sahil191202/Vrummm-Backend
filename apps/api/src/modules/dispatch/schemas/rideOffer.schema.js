import mongoose from 'mongoose';

const { Schema } = mongoose;

// One row per captain per dispatch round.
// Status machine: PENDING → ACCEPTED | REJECTED | EXPIRED | SUPERSEDED
const rideOfferSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'DispatchRound', required: true, index: true },
    captainId: { type: Schema.Types.ObjectId, ref: 'Captain', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED'],
      default: 'PENDING',
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    // Distance from captain to pickup at the time of offer (metres, haversine).
    distanceToPickupMetres: { type: Number },
    // Distance from captain to drop (metres, haversine). Used for Rule B.
    distanceToDropMetres: { type: Number },
    respondedAt: { type: Date },
    // Why this captain was offered — useful for ops debugging.
    offerNote: { type: String },
  },
  { timestamps: true },
);

rideOfferSchema.index({ bookingId: 1, captainId: 1 });
rideOfferSchema.index({ bookingId: 1, status: 1 });
// TTL: auto-expire old offer documents after 7 days.
rideOfferSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

export const RideOffer = mongoose.model('RideOffer', rideOfferSchema);