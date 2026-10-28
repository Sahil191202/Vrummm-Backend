import mongoose from 'mongoose';
import { VEHICLE_TYPES } from '@vrumm/contracts';

const { Schema } = mongoose;

// All money fields are integer paise. Never floats.
// Rates are paise per km or paise per minute.
const fareConfigSchema = new Schema(
  {
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true, index: true },
    // Zone slug e.g. "mumbai-suburban". Used when multiple zones exist.
    zone: { type: String, default: 'mumbai', index: true },
    // Versioning: a new config is created for every change. The old one is never edited.
    version: { type: Number, required: true },
    effectiveFrom: { type: Date, required: true, index: true },
    // Null means this config is still active.
    effectiveTo: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    // Core fare rules — all paise
    baseFarePaise: { type: Number, required: true, min: 0 },
    perKmPaise: { type: Number, required: true, min: 0 },
    perMinutePaise: { type: Number, required: true, min: 0 },
    minimumFarePaise: { type: Number, required: true, min: 0 },
    // Minimum billable distance in metres. Below this, base fare applies.
    minimumBillableDistanceMetres: { type: Number, required: true, min: 0 },

    // Waiting charges
    waitingGracePeriodMinutes: { type: Number, default: 3, min: 0 },
    waitingChargePerMinutePaise: { type: Number, default: 0, min: 0 },

    // Surge — kept configurable but disabled by default (not legally verified for Mumbai).
    surgeEnabled: { type: Boolean, default: false },
    surgeMultiplierMax: { type: Number, default: 1.0, min: 1.0, max: 3.0 },

    // Taxes and permitted fees stored as basis points (100 = 1%).
    // Empty array means no taxes.
    taxes: [
      {
        label: { type: String, required: true },
        basisPoints: { type: Number, required: true, min: 0 },
      },
    ],
  },
  { timestamps: true },
);

// Only one active config per vehicleType+zone at any time.
fareConfigSchema.index({ vehicleType: 1, zone: 1, isActive: 1 });
fareConfigSchema.index({ vehicleType: 1, zone: 1, effectiveFrom: -1 });

export const FareConfig = mongoose.model('FareConfig', fareConfigSchema);