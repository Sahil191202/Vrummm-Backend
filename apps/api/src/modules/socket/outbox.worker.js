import { OutboxEvent } from './outboxEvent.schema.js';

const POLL_INTERVAL_MS = 2_000;
const MAX_ATTEMPTS = 5;

export function createOutboxWorker({ io, logger }) {
  let timer = null;

  async function flush() {
    const pending = await OutboxEvent.find({
      status: 'PENDING',
      attempts: { $lt: MAX_ATTEMPTS },
    })
      .sort({ createdAt: 1 })
      .limit(50);

    for (const evt of pending) {
      try {
        io.to(evt.room).emit(evt.event, evt.payload);
        await OutboxEvent.updateOne(
          { _id: evt._id },
          { $set: { status: 'EMITTED', emittedAt: new Date() }, $inc: { attempts: 1 } },
        );
      } catch (err) {
        const attempts = (evt.attempts ?? 0) + 1;
        await OutboxEvent.updateOne(
          { _id: evt._id },
          { $set: { status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING' }, $inc: { attempts: 1 } },
        );
        logger.warn({ eventId: evt.eventId, err: err.message }, 'outbox emit failed');
      }
    }
  }

  function start() {
    logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, 'outbox worker started');
    flush();
    timer = setInterval(flush, POLL_INTERVAL_MS);
    if (timer.unref) timer.unref();
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    logger.info('outbox worker stopped');
  }

  return { start, stop };
}