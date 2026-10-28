import { randomUUID } from 'node:crypto';
import { ScheduledDispatchJob } from './schemas/scheduledDispatchJob.schema.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { runDispatchRound } from './dispatch.engine.js';
import { DISPATCH_CONFIG } from './dispatch.config.js';

const WORKER_ID = randomUUID();
const LOCK_TTL_MS = DISPATCH_CONFIG.workerLockTtlSeconds * 1000;
const POLL_INTERVAL_MS = DISPATCH_CONFIG.scheduledWorkerPollIntervalMs;

export function createScheduledWorker({ logger }) {
  let timer = null;
  let running = false;

  async function processDueJobs() {
    const now = new Date();

    // Atomically claim one job at a time.
    // Only claim PENDING jobs whose runAt has passed and no live lock exists.
    const job = await ScheduledDispatchJob.findOneAndUpdate(
      {
        status: 'PENDING',
        runAt: { $lte: now },
        $or: [{ lockExpiresAt: null }, { lockExpiresAt: { $lte: now } }],
        attempts: { $lt: 3 },
      },
      {
        $set: {
          status: 'RUNNING',
          lockedBy: WORKER_ID,
          lockedAt: now,
          lockExpiresAt: new Date(now.getTime() + LOCK_TTL_MS),
        },
        $inc: { attempts: 1 },
      },
      { new: true, sort: { runAt: 1 } },
    );

    if (!job) return; // Nothing to do.

    logger.info({ jobId: job._id, bookingId: job.bookingId, attempt: job.attempts }, 'scheduled dispatch starting');

    try {
      const booking = await Booking.findById(job.bookingId);
      if (!booking || booking.status !== 'SEARCHING') {
        // Booking was cancelled or already resolved.
        await ScheduledDispatchJob.updateOne(
          { _id: job._id },
          { $set: { status: 'DONE', completedAt: new Date() } },
        );
        return;
      }

      await runDispatchRound(job.bookingId, logger);

      await ScheduledDispatchJob.updateOne(
        { _id: job._id },
        { $set: { status: 'DONE', completedAt: new Date() } },
      );
      logger.info({ jobId: job._id }, 'scheduled dispatch done');
    } catch (err) {
      const failed = job.attempts >= 3;
      await ScheduledDispatchJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status: failed ? 'FAILED' : 'PENDING',
            lockedBy: null,
            lockedAt: null,
            lockExpiresAt: null,
            lastError: err.message,
          },
        },
      );
      logger.error({ jobId: job._id, err: err.message, attempt: job.attempts }, 'scheduled dispatch failed');
    }
  }

  async function poll() {
    if (running) return;
    running = true;
    try {
      await processDueJobs();
    } catch (err) {
      logger.error({ err: err.message }, 'scheduled worker poll error');
    } finally {
      running = false;
    }
  }

  function start() {
    logger.info({ workerId: WORKER_ID, pollIntervalMs: POLL_INTERVAL_MS }, 'scheduled worker started');
    // Run immediately, then on interval.
    poll();
    timer = setInterval(poll, POLL_INTERVAL_MS);
    // Allow process to exit even if timer is active.
    if (timer.unref) timer.unref();
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    logger.info({ workerId: WORKER_ID }, 'scheduled worker stopped');
  }

  return { start, stop };
}