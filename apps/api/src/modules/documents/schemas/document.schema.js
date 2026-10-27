import mongoose from 'mongoose';

const { Schema } = mongoose;

// Document types required for captain onboarding.
export const DOCUMENT_TYPES = Object.freeze([
  'AADHAAR_FRONT',
  'AADHAAR_BACK',
  'PAN_CARD',
  'DRIVING_LICENCE_FRONT',
  'DRIVING_LICENCE_BACK',
  'VEHICLE_RC', // Registration Certificate
  'VEHICLE_INSURANCE',
  'PROFILE_PHOTO',
]);

// Required docs before a captain can be approved.
export const REQUIRED_DOCUMENT_TYPES = Object.freeze([
  'AADHAAR_FRONT',
  'AADHAAR_BACK',
  'DRIVING_LICENCE_FRONT',
  'DRIVING_LICENCE_BACK',
  'VEHICLE_RC',
  'VEHICLE_INSURANCE',
  'PROFILE_PHOTO',
]);

const documentSchema = new Schema(
  {
    captainId: {
      type: Schema.Types.ObjectId,
      ref: 'Captain',
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: DOCUMENT_TYPES, required: true },
    // Storage metadata only. Raw file lives in Cloudinary.
    storagePublicId: { type: String, required: true },
    storageResourceType: { type: String, required: true, default: 'image' },
    fileSizeBytes: { type: Number },
    fileFormat: { type: String },
    // Review state.
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, maxlength: 500 },
    // Expiry tracking (driving licence, insurance, RC have expiry dates).
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

// One active document per type per captain. Uploading a new one supersedes the old.
documentSchema.index({ captainId: 1, type: 1 });

export const Document = mongoose.model('Document', documentSchema);