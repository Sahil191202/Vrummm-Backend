import mongoose from 'mongoose';

const { Schema } = mongoose;

const rideLocationSampleSchema = new Schema(
  {
    rideId: { type: Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
    captainId: { type: Schema.Types.ObjectId, ref: 'Captain', required: true },
    coordinates: { type: [Number], required: true }, // [lng, lat]
    // Speed between this sample and the previous one (km/h).
    speedKmh: { type: Number },
    // Set when speed exceeds IMPLAUSIBLE_SPEED_KMH.
    implausible: { type: Boolean, default: false },
    // Client-supplied timestamp — used to detect jumps.
    recordedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

rideLocationSampleSchema.index({ rideId: 1, recordedAt: 1 });

export const RideLocationSample = mongoose.model('RideLocationSample', rideLocationSampleSchema);