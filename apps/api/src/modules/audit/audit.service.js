import { AdminAuditLog } from './schemas/adminAuditLog.schema.js';

// Audit writes are fire-and-forget: a failure must not break the request.
// For the learning project this is acceptable. Phase 9 will review this decision.
export async function logAudit({
  actorId,
  actorRole,
  action,
  targetType,
  targetId,
  requestId,
  reason,
  meta,
  ipAddress,
}) {
  try {
    await AdminAuditLog.create({
      actorId,
      actorRole,
      action,
      targetType,
      targetId,
      requestId,
      reason,
      meta,
      ipAddress,
    });
  } catch {
    // Intentionally swallowed. The caller must not fail because of a log write.
    // A production system would forward to a dedicated audit pipeline here.
  }
}
