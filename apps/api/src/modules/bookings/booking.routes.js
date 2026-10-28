import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole, requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../rbac/permissions.js';
import { createBookingController } from './booking.controller.js';
import { createBookingService } from './booking.service.js';
import { createFareService } from '../fares/fare.service.js';
import { createCustomerService } from '../customers/customer.service.js';
import {
  createBookingSchema,
  cancelBookingSchema,
  bookingIdParamSchema,
  listBookingsQuerySchema,
} from './schemas/booking.schemas.js';

export function createBookingRouter({ authService }) {
  const fareService = createFareService();
  const bookingService = createBookingService({ fareService });
  const customerService = createCustomerService();
  const controller = createBookingController({ bookingService });
  const router = Router();
  const auth = authenticate(authService);

  function ensureCustomerProfile(req, _res, next) {
    customerService
      .getOrCreateProfile(req.user.sub)
      .then(() => next())
      .catch(next);
  }

  // Customer
  router.post(
    '/',
    auth,
    requireRole('CUSTOMER'),
    ensureCustomerProfile,
    validate({ body: createBookingSchema }),
    controller.createBooking,
  );
  router.get(
    '/mine',
    auth,
    requireRole('CUSTOMER'),
    validate({ query: listBookingsQuerySchema }),
    controller.listMyBookings,
  );
  router.get(
    '/:bookingId',
    auth,
    validate({ params: bookingIdParamSchema }),
    controller.getBooking,
  );
  router.post(
    '/:bookingId/cancel',
    auth,
    validate({ params: bookingIdParamSchema, body: cancelBookingSchema }),
    controller.cancelBooking,
  );

  // Admin
  router.get(
    '/',
    auth,
    requirePermission(PERMISSIONS.RIDES_READ),
    validate({ query: listBookingsQuerySchema }),
    controller.listAllBookings,
  );

  return router;
}