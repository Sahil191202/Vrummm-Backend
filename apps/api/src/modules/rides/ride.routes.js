import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { createRideController } from './ride.controller.js';
import { createRideService } from './ride.service.js';
import {
  rideIdParamSchema,
  verifyPinSchema,
  locationSampleSchema,
  completeRideSchema,
  cancelRideSchema,
} from './schemas/ride.schemas.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function createRideRouter({ authService, io }) {
  const rideService = createRideService({ io });
  const controller = createRideController({ rideService });
  const router = Router();
  const auth = authenticate(authService);

  // Both captain and customer can access their own ride.
  router.get('/mine', auth, validate({ query: listQuerySchema }), controller.listMyRides);
  router.get('/:rideId', auth, validate({ params: rideIdParamSchema }), controller.getRide);
  router.post(
    '/:rideId/cancel',
    auth,
    validate({ params: rideIdParamSchema, body: cancelRideSchema }),
    controller.cancelRide,
  );

  // Captain only.
  router.post(
    '/:rideId/arrive',
    auth,
    requireRole('CAPTAIN'),
    validate({ params: rideIdParamSchema }),
    controller.captainArrived,
  );
  router.post(
    '/:rideId/location',
    auth,
    requireRole('CAPTAIN'),
    validate({ params: rideIdParamSchema, body: locationSampleSchema }),
    controller.addLocationSample,
  );
  router.post(
    '/:rideId/complete',
    auth,
    requireRole('CAPTAIN'),
    validate({ params: rideIdParamSchema, body: completeRideSchema }),
    controller.completeRide,
  );

  // Customer only — PIN submission to start the ride.
  router.post(
    '/:rideId/verify-pin',
    auth,
    requireRole('CUSTOMER'),
    validate({ params: rideIdParamSchema, body: verifyPinSchema }),
    controller.verifyPin,
  );

  return router;
}
