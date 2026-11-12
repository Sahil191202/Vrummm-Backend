import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../rbac/permissions.js';
import { createPromotionController } from './promotion.controller.js';
import { createPromotionService } from './promotion.service.js';
import {
  createPromotionSchema,
  applyPromotionSchema,
  queryPromotionsSchema,
  promotionIdParamSchema,
} from './schemas/promotion.schemas.js';

export function createPromotionRouter({ authService }) {
  const promotionService = createPromotionService();
  const controller = createPromotionController({ promotionService });
  const router = Router();
  const auth = authenticate(authService);

  // Customer route to check / validate promo code
  router.post('/validate', auth, validate({ body: applyPromotionSchema }), controller.validateCode);

  // Admin routes
  router.get(
    '/',
    auth,
    requirePermission(PERMISSIONS.PROMOTIONS_READ),
    validate({ query: queryPromotionsSchema }),
    controller.listPromotions,
  );

  router.post(
    '/',
    auth,
    requirePermission(PERMISSIONS.PROMOTIONS_WRITE),
    validate({ body: createPromotionSchema }),
    controller.createPromotion,
  );

  router.get(
    '/:promotionId',
    auth,
    requirePermission(PERMISSIONS.PROMOTIONS_READ),
    validate({ params: promotionIdParamSchema }),
    controller.getPromotion,
  );

  return router;
}
