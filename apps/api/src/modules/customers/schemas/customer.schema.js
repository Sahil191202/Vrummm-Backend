import mongoose from 'mongoose';

const { Schema } = mongoose;

const customerSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // Preferred pickup locations for quick re-booking.
    savedPlaces: [
      {
        label: { type: String, trim: true, maxlength: 50 },
        address: { type: String, trim: true, maxlength: 300 },
        location: {
          type: { type: String, enum: ['Point'], default: 'Point' },
          coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
        },
      },
    ],
    // Running counts — denormalised for quick display, authoritative values in ledger.
    totalRides: { type: Number, default: 0 },
    totalSpentPaise: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Customer = mongoose.model('Customer', customerSchema);