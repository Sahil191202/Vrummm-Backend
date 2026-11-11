import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission, requireRole } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS, ROLES } from '../rbac/permissions.js';
import { createLedgerController } from './ledger.controller.js';
import { createLedgerService } from './ledger.service.js';
import {
  queryLedgerSchema,
  createAdjustmentSchema,
  simulatePayoutSchema,
} from './schemas/ledger.schemas.js';

export function createLedgerRouter({ authService }) {
  const ledgerService = createLedgerService();
  const controller = createLedgerController({ ledgerService });
  const router = Router();
  const auth = authenticate(authService);

  router.get(
    '/entries',
    auth,
    requirePermission(PERMISSIONS.PAYMENTS_READ),
    validate({ query: queryLedgerSchema }),
    controller.listEntries,
  );

  router.get('/balance', auth, controller.getBalance);

  router.post(
    '/adjustments',
    auth,
    requirePermission(PERMISSIONS.PAYMENTS_READ),
    validate({ body: createAdjustmentSchema }),
    controller.createAdjustment,
  );

  router.post(
    '/payouts/simulate',
    auth,
    requireRole(ROLES.CAPTAIN),
    validate({ body: simulatePayoutSchema }),
    controller.simulatePayout,
  );

  return router;
}
