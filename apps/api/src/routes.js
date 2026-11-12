import { Router } from 'express';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createCustomerRouter } from './modules/customers/customer.routes.js';
import { createCaptainRouter } from './modules/captains/captain.routes.js';
import { createVehicleRouter } from './modules/vehicles/vehicle.routes.js';
import { createDocumentRouter } from './modules/documents/document.routes.js';
import { createFareRouter } from './modules/fares/fare.routes.js';
import { createBookingRouter } from './modules/bookings/booking.routes.js';
import { createDispatchRouter } from './modules/dispatch/dispatch.routes.js';
import { createRideRouter } from './modules/rides/ride.routes.js';
import { createRevenuePlanRouter } from './modules/revenuePlans/revenuePlan.routes.js';
import { createRevenuePlanService } from './modules/revenuePlans/revenuePlan.service.js';
import { createPaymentRouter } from './modules/payments/payment.routes.js';
import { createPaymentService } from './modules/payments/payment.service.js';
import { createPaymentProviderRegistry } from './modules/payments/providers/paymentProvider.factory.js';
import { createLedgerRouter } from './modules/ledger/ledger.routes.js';
import { createLedgerService } from './modules/ledger/ledger.service.js';
import { createPromotionRouter } from './modules/promotions/promotion.routes.js';
import { createIncentiveRouter } from './modules/incentives/incentive.routes.js';
import { createSafetyRouter } from './modules/safety/safety.routes.js';
import { createAdminRouter } from './modules/admin/admin.routes.js';

export function createApiRouter({
  healthService,
  authService,
  storageProvider,
  logger,
  io,
  razorpayConfig,
}) {
  const router = Router();

  const revenuePlanService = createRevenuePlanService();
  const ledgerService = createLedgerService();
  const paymentProviderRegistry = createPaymentProviderRegistry({ razorpayConfig });
  const paymentService = createPaymentService({
    paymentProviderRegistry,
    revenuePlanService,
    ledgerService,
    io,
  });

  router.use('/health', createHealthRouter({ healthService }));
  router.use('/auth', createAuthRouter({ authService }));
  router.use('/customers', createCustomerRouter({ authService }));
  router.use('/captains', createCaptainRouter({ authService }));
  router.use('/vehicles', createVehicleRouter({ authService }));
  router.use('/documents', createDocumentRouter({ authService, storageProvider }));
  router.use('/fares', createFareRouter({ authService }));
  router.use('/bookings', createBookingRouter({ authService }));
  router.use('/dispatch', createDispatchRouter({ authService, logger }));
  router.use('/rides', createRideRouter({ authService, io }));
  router.use('/revenue-plans', createRevenuePlanRouter({ authService }));
  router.use('/payments', createPaymentRouter({ paymentService, authService }));
  router.use('/ledger', createLedgerRouter({ authService }));
  router.use('/promotions', createPromotionRouter({ authService }));
  router.use('/incentives', createIncentiveRouter({ authService, ledgerService }));
  router.use('/safety', createSafetyRouter({ authService, io }));
  router.use('/admin', createAdminRouter({ authService }));

  return router;
}
