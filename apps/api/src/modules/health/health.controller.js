import { sendSuccess } from '../../shared/respond.js';
import { errors } from '../../shared/AppError.js';

// Thin controller: no business rules here.
export function createHealthController({ healthService }) {
  return {
    live(req, res) {
      return sendSuccess(req, res, healthService.liveness());
    },
    async ready(req, res) {
      const result = await healthService.readiness();
      if (!result.ready) {
        throw errors.unavailable('Service is not ready', { checks: result.checks });
      }
      return sendSuccess(req, res, { status: result.status, checks: result.checks });
    },
  };
}
