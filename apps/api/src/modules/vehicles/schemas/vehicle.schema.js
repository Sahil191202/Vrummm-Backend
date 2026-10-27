import mongoose from 'mongoose';
import { VEHICLE_TYPES } from '@vrumm/contracts';

const { Schema } = mongoose;

const vehicleSchema = new Schema(
  {
    captainId: {
      type: Schema.Types.ObjectId,
      ref: 'Captain',
      required: true,
      unique: true, // One vehicle per captain.
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: { type: String, enum: VEHICLE_TYPES, required: true },
    make: { type: String, trim: true, maxlength: 50, required: true },
    model: { type: String, trim: true, maxlength: 50, required: true },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: new Date().getFullYear() + 1,
    },
    // Licence plate. Stored uppercase, no spaces.
    registrationNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
      validate: {
        validator: (v) => /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/.test(v),
        message: 'Registration must be a valid Indian plate e.g. MH01AB1234',
      },
    },
    color: { type: String, trim: true, maxlength: 30 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Vehicle = mongoose.model('Vehicle', vehicleSchema);