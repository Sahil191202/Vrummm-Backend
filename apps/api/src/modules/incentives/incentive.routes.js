import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission, requireRole } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS, ROLES } from '../rbac/permissions.js';
import { createIncentiveController } from './incentive.controller.js';
import { createIncentiveService } from './incentive.service.js';
import {
  createIncentiveCampaignSchema,
  evaluateIncentiveSchema,
  queryCampaignsSchema,
  campaignIdParamSchema,
} from './schemas/incentive.schemas.js';

export function createIncentiveRouter({ authService, ledgerService }) {
  const incentiveService = createIncentiveService({ ledgerService });
  const controller = createIncentiveController({ incentiveService });
  const router = Router();
  const auth = authenticate(authService);

  // Captain routes
  router.get('/my-awards', auth, requireRole(ROLES.CAPTAIN), controller.getMyAwards);
  router.post(
    '/evaluate',
    auth,
    requireRole(ROLES.CAPTAIN),
    validate({ body: evaluateIncentiveSchema }),
    controller.evaluateIncentive,
  );

  // General & admin routes
  router.get('/', auth, validate({ query: queryCampaignsSchema }), controller.listCampaigns);

  router.post(
    '/',
    auth,
    requirePermission(PERMISSIONS.PROMOTIONS_WRITE),
    validate({ body: createIncentiveCampaignSchema }),
    controller.createCampaign,
  );

  router.get(
    '/:campaignId',
    auth,
    validate({ params: campaignIdParamSchema }),
    controller.getCampaign,
  );

  return router;
}
