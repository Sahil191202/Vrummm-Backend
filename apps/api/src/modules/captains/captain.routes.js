import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole, requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../rbac/permissions.js';
import { createCaptainController } from './captain.controller.js';
import { createCaptainService } from './captain.service.js';
import {
  updateCaptainProfileSchema,
  setAvailabilitySchema,
  captainIdParamSchema,
  setApprovalStatusSchema,
  listCaptainsQuerySchema,
} from './schemas/captain.schemas.js';

export function createCaptainRouter({ authService }) {
  const captainService = createCaptainService();
  const controller = createCaptainController({ captainService });
  const router = Router();
  const auth = authenticate(authService);

  // Auto-create the Captain profile document on first request.
  // This means the seed script only needs to create User records.
  function ensureProfile(req, _res, next) {
    captainService
      .getOrCreateProfile(req.user.sub)
      .then(() => next())
      .catch(next);
  }

  // Captain self-service
  router.get('/me', auth, requireRole('CAPTAIN'), ensureProfile, controller.getMyProfile);
  router.patch('/me', auth, requireRole('CAPTAIN'), ensureProfile, validate({ body: updateCaptainProfileSchema }), controller.updateMyProfile);
  router.patch('/me/availability', auth, requireRole('CAPTAIN'), ensureProfile, validate({ body: setAvailabilitySchema }), controller.setAvailability);
  router.get('/me/eligibility', auth, requireRole('CAPTAIN'), ensureProfile, controller.checkEligibility);

  // Admin
  router.get('/', auth, requirePermission(PERMISSIONS.CAPTAINS_READ), validate({ query: listCaptainsQuerySchema }), controller.listCaptains);
  router.get('/:captainId', auth, requirePermission(PERMISSIONS.CAPTAINS_READ), validate({ params: captainIdParamSchema }), controller.getCaptain);
  router.patch('/:captainId/approval', auth, requirePermission(PERMISSIONS.CAPTAINS_APPROVE), validate({ params: captainIdParamSchema, body: setApprovalStatusSchema }), controller.setApprovalStatus);

  return router;
}