import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { createVehicleController } from './vehicle.controller.js';
import { createVehicleService } from './vehicle.service.js';
import { createCaptainService } from '../captains/captain.service.js';
import { registerVehicleSchema, updateVehicleSchema } from './schemas/vehicle.schemas.js';

export function createVehicleRouter({ authService }) {
  const vehicleService = createVehicleService();
  const captainService = createCaptainService();
  const controller = createVehicleController({ vehicleService, captainService });
  const router = Router();
  const auth = authenticate(authService);

  function ensureProfile(req, _res, next) {
    captainService
      .getOrCreateProfile(req.user.sub)
      .then(() => next())
      .catch(next);
  }

  router.post('/', auth, requireRole('CAPTAIN'), ensureProfile, validate({ body: registerVehicleSchema }), controller.registerVehicle);
  router.get('/', auth, requireRole('CAPTAIN'), ensureProfile, controller.getVehicle);
  router.patch('/', auth, requireRole('CAPTAIN'), ensureProfile, validate({ body: updateVehicleSchema }), controller.updateVehicle);

  return router;
}