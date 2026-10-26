import mongoose from 'mongoose';

const { Schema } = mongoose;

// A session holds the opaque refresh token (stored as a hash, never plaintext).
// Access tokens are stateless JWTs; only refresh tokens need a DB row.
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    // Revocation fields
    revokedAt: { type: Date, default: null },
    revokedReason: {
      type: String,
      enum: ['logout', 'logout_all', 'admin_revoke', 'password_change', null],
      default: null,
    },
    // Metadata for audit / display.
    userAgent: { type: String, maxlength: 500 },
    ipAddress: { type: String, maxlength: 45 },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

sessionSchema.index({ userId: 1, revokedAt: 1 });

export const Session = mongoose.model('Session', sessionSchema);
