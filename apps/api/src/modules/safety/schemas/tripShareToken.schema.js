import mongoose from 'mongoose';

const { Schema } = mongoose;

const tripShareTokenSchema = new Schema(
  {
    rideId: {
      type: Schema.Types.ObjectId,
      ref: 'Ride',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
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
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// TTL index to automatically remove expired share tokens
tripShareTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TripShareToken = mongoose.model('TripShareToken', tripShareTokenSchema);
