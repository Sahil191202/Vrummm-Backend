import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { API_BASE_PATH } from '@vrumm/contracts';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createHealthService } from './modules/health/health.service.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createApiRouter } from './routes.js';

// io is injected from server.js after the Socket.IO server is created.
// It is null during tests so socket emits are skipped gracefully.
export function createApp({ config, logger, checkDatabase, storageProvider, io = null, version = 'unknown' }) {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(requestLogger(logger));
  app.use(helmet());
  app.use(
    cors({
      origin: [...config.corsOrigins],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );
  // NOTE Phase 7: Razorpay webhook must be mounted BEFORE this line with express.raw()
  app.use(express.json({ limit: '100kb' }));

  const healthService = createHealthService({ checkDatabase, version });
  const authService = createAuthService({ authConfig: config.auth });

  app.use(API_BASE_PATH, createApiRouter({ healthService, authService, storageProvider, logger, io }));

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}