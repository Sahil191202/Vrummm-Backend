import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission, requireRole } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS, ROLES } from '../rbac/permissions.js';
import { createRevenuePlanController } from './revenuePlan.controller.js';
import { createRevenuePlanService } from './revenuePlan.service.js';
import {
  createRevenuePlanSchema,
  updateRevenuePlanSchema,
  assignPlanSchema,
  planIdParamSchema,
} from './schemas/revenuePlan.schemas.js';

export function createRevenuePlanRouter({ authService }) {
  const revenuePlanService = createRevenuePlanService();
  const controller = createRevenuePlanController({ revenuePlanService });
  const router = Router();
  const auth = authenticate(authService);

  // Captain routes (must come before /:planId to avoid param collision)
  router.get('/captains/my-plan', auth, requireRole(ROLES.CAPTAIN), controller.getMyPlan);
  router.post(
    '/captains/select',
    auth,
    requireRole(ROLES.CAPTAIN),
    validate({ body: assignPlanSchema }),
    controller.selectCaptainPlan,
  );

  // Admin and list routes
  router.get('/', auth, controller.listPlans);
  router.post(
    '/',
    auth,
    requirePermission(PERMISSIONS.REVENUE_PLANS_WRITE),
    validate({ body: createRevenuePlanSchema }),
    controller.createPlan,
  );
  router.get('/:planId', auth, validate({ params: planIdParamSchema }), controller.getPlan);
  router.patch(
    '/:planId',
    auth,
    requirePermission(PERMISSIONS.REVENUE_PLANS_WRITE),
    validate({ params: planIdParamSchema, body: updateRevenuePlanSchema }),
    controller.updatePlan,
  );

  return router;
}
