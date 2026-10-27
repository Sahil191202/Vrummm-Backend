import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { createCustomerController } from './customer.controller.js';
import { createCustomerService } from './customer.service.js';
import {
  updateCustomerProfileSchema,
  addSavedPlaceSchema,
  placeIdParamSchema,
} from './schemas/customer.schemas.js';

export function createCustomerRouter({ authService }) {
  const customerService = createCustomerService();
  const controller = createCustomerController({ customerService });
  const router = Router();
  const auth = authenticate(authService);

  function ensureProfile(req, _res, next) {
    customerService
      .getOrCreateProfile(req.user.sub)
      .then(() => next())
      .catch(next);
  }

  router.get('/me', auth, requireRole('CUSTOMER'), ensureProfile, controller.getProfile);
  router.patch('/me', auth, requireRole('CUSTOMER'), ensureProfile, validate({ body: updateCustomerProfileSchema }), controller.updateProfile);
  router.post('/me/saved-places', auth, requireRole('CUSTOMER'), ensureProfile, validate({ body: addSavedPlaceSchema }), controller.addSavedPlace);
  router.delete('/me/saved-places/:placeId', auth, requireRole('CUSTOMER'), ensureProfile, validate({ params: placeIdParamSchema }), controller.removeSavedPlace);

  return router;
}