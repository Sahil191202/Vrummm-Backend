import mongoose from 'mongoose';

const { Schema } = mongoose;

// Durable scheduled dispatch job. A worker polls this collection,
// atomically claims a job, runs dispatch, and marks it done.
// If the worker crashes, the lock expires and another worker retries.
const scheduledDispatchJobSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    runAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'DONE', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    // Worker lock: set when a worker claims this job.
    lockedBy: { type: String, default: null },
    lockedAt: { type: Date, default: null },
    // Lock expires after this time so another worker can retry.
    lockExpiresAt: { type: Date, default: null },
    lastError: { type: String },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

scheduledDispatchJobSchema.index({ status: 1, runAt: 1 });
scheduledDispatchJobSchema.index({ lockExpiresAt: 1 });

export const ScheduledDispatchJob = mongoose.model(
  'ScheduledDispatchJob',
  scheduledDispatchJobSchema,
);