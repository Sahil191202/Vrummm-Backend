import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../rbac/permissions.js';
import { createFareController } from './fare.controller.js';
import { createFareService } from './fare.service.js';
import {
  fareQuoteQuerySchema,
  createFareConfigSchema,
  fareConfigIdParamSchema,
  listFareConfigsQuerySchema,
} from './schemas/fare.schemas.js';

export function createFareRouter({ authService }) {
  const fareService = createFareService();
  const controller = createFareController({ fareService });
  const router = Router();
  const auth = authenticate(authService);

  // Public — customers and captains both use this before booking
  router.get('/quote', validate({ query: fareQuoteQuerySchema }), controller.getFareQuote);

  // Admin
  router.post(
    '/configs',
    auth,
    requirePermission(PERMISSIONS.FARES_WRITE),
    validate({ body: createFareConfigSchema }),
    controller.createFareConfig,
  );
  router.get(
    '/configs',
    auth,
    requirePermission(PERMISSIONS.FARES_READ),
    validate({ query: listFareConfigsQuerySchema }),
    controller.listFareConfigs,
  );
  router.get(
    '/configs/:configId',
    auth,
    requirePermission(PERMISSIONS.FARES_READ),
    validate({ params: fareConfigIdParamSchema }),
    controller.getFareConfig,
  );

  return router;
}