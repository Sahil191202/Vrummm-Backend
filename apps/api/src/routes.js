import { Router } from 'express';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';

export function createApiRouter({ healthService, authService }) {
  const router = Router();
  router.use('/health', createHealthRouter({ healthService }));
  router.use('/auth', createAuthRouter({ authService }));
  return router;
}
