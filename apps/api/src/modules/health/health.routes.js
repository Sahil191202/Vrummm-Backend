import { Router } from 'express';
import { createHealthController } from './health.controller.js';

export function createHealthRouter({ healthService }) {
  const controller = createHealthController({ healthService });
  const router = Router();
  router.get('/', controller.live);
  router.get('/ready', controller.ready);
  return router;
}
