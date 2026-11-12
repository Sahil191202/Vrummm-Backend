import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../rbac/permissions.js';
import { createAdminController } from './admin.controller.js';
import { createAdminService } from './admin.service.js';
import { dateRangeQuerySchema, leaderboardQuerySchema } from './schemas/admin.schemas.js';

export function createAdminRouter({ authService }) {
  const adminService = createAdminService();
  const controller = createAdminController({ adminService });
  const router = Router();
  const auth = authenticate(authService);

  router.get(
    '/reports/operations',
    auth,
    requirePermission(PERMISSIONS.RIDES_READ),
    validate({ query: dateRangeQuerySchema }),
    controller.getOperationsSummary,
  );

  router.get(
    '/reports/financial',
    auth,
    requirePermission(PERMISSIONS.PAYMENTS_READ),
    validate({ query: dateRangeQuerySchema }),
    controller.getFinancialSummary,
  );

  router.get(
    '/reports/captains/leaderboard',
    auth,
    requirePermission(PERMISSIONS.CAPTAINS_READ),
    validate({ query: leaderboardQuerySchema }),
    controller.getLeaderboard,
  );

  return router;
}
