import mongoose from 'mongoose';
import { ROLES } from '../permissions.js';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      // E.164 format: +91XXXXXXXXXX
      type: String,
      trim: true,
      sparse: true,
      index: true,
      validate: {
        validator: (v) => !v || /^\+\d{10,15}$/.test(v),
        message: 'phone must be in E.164 format (+91XXXXXXXXXX)',
      },
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    // Seed / test flag. Prevents accidental deletion of fixed reference accounts.
    isSeeded: { type: Boolean, default: false },
    // Track failed login attempts for account lockout.
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    // Profile display fields. Kept minimal here; richer profile lives in customers/captains.
    displayName: { type: String, trim: true, maxlength: 100 },
  },
  { timestamps: true },
);

// Never return the password hash in any query result unless explicitly selected.
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
