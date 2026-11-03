import mongoose from 'mongoose';

const { Schema } = mongoose;

// Transactional outbox for Socket.IO events.
// State is persisted BEFORE the socket.emit call.
// A worker reads PENDING events and emits them — if the server crashes
// between persist and emit, the worker retries on restart.
const outboxEventSchema = new Schema(
  {
    room: { type: String, required: true, index: true },
    event: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'EMITTED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    emittedAt: { type: Date },
    // eventId: stable id included in every payload so clients can deduplicate.
    eventId: { type: String, required: true, unique: true },
    // version: monotonically increasing per room — clients can detect gaps.
    version: { type: Number, required: true },
  },
  { timestamps: true },
);

outboxEventSchema.index({ status: 1, createdAt: 1 });

export const OutboxEvent = mongoose.model('OutboxEvent', outboxEventSchema);