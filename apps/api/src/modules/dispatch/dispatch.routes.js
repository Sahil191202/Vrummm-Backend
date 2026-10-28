import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { createDispatchController } from './dispatch.controller.js';
import { createDispatchService } from './dispatch.service.js';
import { offerIdParamSchema, bookingIdParamSchema } from './schemas/dispatch.schemas.js';

export function createDispatchRouter({ authService, logger }) {
  const dispatchService = createDispatchService({ logger });
  const controller = createDispatchController({ dispatchService });
  const router = Router();
  const auth = authenticate(authService);

  // Captain routes
  router.get('/offers/mine', auth, requireRole('CAPTAIN'), controller.listMyOffers);
  router.post(
    '/offers/:offerId/accept',
    auth,
    requireRole('CAPTAIN'),
    validate({ params: offerIdParamSchema }),
    controller.acceptOffer,
  );
  router.post(
    '/offers/:offerId/reject',
    auth,
    requireRole('CAPTAIN'),
    validate({ params: offerIdParamSchema }),
    controller.rejectOffer,
  );

  // Customer routes
  router.get(
    '/status/:bookingId',
    auth,
    requireRole('CUSTOMER'),
    validate({ params: bookingIdParamSchema }),
    controller.getDispatchStatus,
  );

  return router;
}