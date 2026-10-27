import { Router } from 'express';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createCustomerRouter } from './modules/customers/customer.routes.js';
import { createCaptainRouter } from './modules/captains/captain.routes.js';
import { createVehicleRouter } from './modules/vehicles/vehicle.routes.js';
import { createDocumentRouter } from './modules/documents/document.routes.js';

export function createApiRouter({ healthService, authService, storageProvider }) {
  const router = Router();
  router.use('/health', createHealthRouter({ healthService }));
  router.use('/auth', createAuthRouter({ authService }));
  router.use('/customers', createCustomerRouter({ authService }));
  router.use('/captains', createCaptainRouter({ authService }));
  router.use('/vehicles', createVehicleRouter({ authService }));
  router.use('/documents', createDocumentRouter({ authService, storageProvider }));
  return router;
}