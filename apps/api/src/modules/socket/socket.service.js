import { randomUUID } from 'node:crypto';
import { OutboxEvent } from './outboxEvent.schema.js';
import { socketRooms } from '@vrumm/contracts';

// Monotonic version counter per room — in-process only.
// Good enough for a learning project; a Redis counter would be used in production.
const roomVersions = new Map();

function nextVersion(room) {
  const v = (roomVersions.get(room) ?? 0) + 1;
  roomVersions.set(room, v);
  return v;
}

// Persist an outbox event and immediately attempt to emit it.
// If io is null (e.g. during tests), only the DB write happens.
export async function emitToRoom({ io, room, event, payload, session }) {
  const eventId = randomUUID();
  const version = nextVersion(room);

  const fullPayload = { ...payload, eventId, version, emittedAt: new Date().toISOString() };

  const createFn = () =>
    OutboxEvent.create(
      [{ room, event, payload: fullPayload, eventId, version }],
      session ? { session } : {},
    );

  await createFn();

  // Best-effort immediate emit. The outbox worker handles retry on failure.
  if (io) {
    try {
      io.to(room).emit(event, fullPayload);
      await OutboxEvent.updateOne({ eventId }, { $set: { status: 'EMITTED', emittedAt: new Date() } });
    } catch {
      // Outbox worker will retry.
    }
  }
}

// Helpers for the most common rooms.
export const emit = {
  toUser: (io, userId, event, payload, session) =>
    emitToRoom({ io, room: socketRooms.user(userId), event, payload, session }),
  toRide: (io, rideId, event, payload, session) =>
    emitToRoom({ io, room: socketRooms.ride(rideId), event, payload, session }),
  toOps: (io, event, payload, session) =>
    emitToRoom({ io, room: socketRooms.ops(), event, payload, session }),
};