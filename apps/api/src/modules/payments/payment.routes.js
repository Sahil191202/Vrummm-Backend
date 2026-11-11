import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission, requireRole } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS, ROLES } from '../rbac/permissions.js';
import { createPaymentController } from './payment.controller.js';
import {
  createPaymentOrderSchema,
  verifyPaymentSchema,
  simulateRefundSchema,
  paymentIdParamSchema,
  rideIdParamSchema,
  queryPaymentsSchema,
} from './schemas/payment.schemas.js';

export function createPaymentRouter({ paymentService, authService }) {
  const controller = createPaymentController({ paymentService });
  const router = Router();
  const auth = authenticate(authService);

  // Webhook is unauthenticated (authenticated by cryptographic HMAC signature of raw body)
  router.post('/webhook', controller.handleWebhook);

  // Customer creates order and verifies checkout signature
  router.post(
    '/orders',
    auth,
    requireRole(ROLES.CUSTOMER),
    validate({ body: createPaymentOrderSchema }),
    controller.createPaymentOrder,
  );

  router.post(
    '/verify',
    auth,
    requireRole(ROLES.CUSTOMER),
    validate({ body: verifyPaymentSchema }),
    controller.verifyPayment,
  );

  // Payment status for a specific ride
  router.get(
    '/ride/:rideId',
    auth,
    validate({ params: rideIdParamSchema }),
    controller.getPaymentForRide,
  );

  // Admin routes
  router.get(
    '/',
    auth,
    requirePermission(PERMISSIONS.PAYMENTS_READ),
    validate({ query: queryPaymentsSchema }),
    controller.listPayments,
  );

  router.post(
    '/:paymentId/refund/simulate',
    auth,
    requirePermission(PERMISSIONS.PAYMENTS_REFUND_SIMULATE),
    validate({ params: paymentIdParamSchema, body: simulateRefundSchema }),
    controller.simulateRefund,
  );

  return router;
}
