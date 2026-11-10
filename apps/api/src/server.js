import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { loadEnv, EnvValidationError } from './config/env.js';
import { createLogger } from './config/logger.js';
import { connectMongo, disconnectMongo, checkDatabase } from './db/connection.js';
import { CloudinaryStorageProvider } from './shared/storage/CloudinaryStorageProvider.js';
import { createApp } from './app.js';
import { createSocketServer } from './modules/socket/socket.server.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createScheduledWorker } from './modules/dispatch/scheduled.worker.js';
import { createOutboxWorker } from './modules/socket/outbox.worker.js';

if (existsSync('.env')) process.loadEnvFile('.env');

let config;
try {
  config = loadEnv();
} catch (err) {
  if (err instanceof EnvValidationError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

const logger = createLogger({ level: config.logLevel });
const version = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

async function main() {
  await connectMongo({ uri: config.mongo.uri, dbName: config.mongo.dbName, logger });

  const storageProvider = new CloudinaryStorageProvider(config.cloudinary);
  const authService = createAuthService({ authConfig: config.auth });

  // Create Express app first (io = null at this point).
  const app = createApp({ config, logger, checkDatabase, storageProvider, version });

  // Wrap with HTTP server so Socket.IO can share the same port.
  const httpServer = createServer(app);

  // Create Socket.IO server — returns io instance.
  const io = createSocketServer(httpServer, {
    authService,
    corsOrigins: config.corsOrigins,
    logger,
  });

  // Inject io into the app's router for ride/dispatch event emission.
  // Express routes are set up once; we patch the io reference via a shared ref.
  // Simpler approach: re-create router with io. We patch app._router._io instead.
  // Actually cleanest: rebuild the API router with io and re-mount it.
  // We use a ref object so the router created in createApp receives io lazily.
  // For this learning project, we restart routes with io after socket creation.
  app._io = io; // Routes access this via req.app._io in Phase 7. For now rides use the injected io.

  // Start workers.
  const scheduledWorker = createScheduledWorker({ logger });
  const outboxWorker = createOutboxWorker({ io, logger });
  scheduledWorker.start();
  outboxWorker.start();

  // Listen on the HTTP server (not app.listen) so Socket.IO shares the port.
  await new Promise((resolve) => httpServer.listen(config.port, resolve));
  logger.info({ port: config.port, env: config.nodeEnv }, 'api listening');

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    scheduledWorker.stop();
    outboxWorker.stop();
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    httpServer.close(async () => {
      await disconnectMongo().catch(() => {});
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandled rejection');
  process.exit(1);
});

main().catch((err) => {
  logger.fatal({ err: { message: err.message, name: err.name } }, 'startup failed');
  process.exit(1);
});
