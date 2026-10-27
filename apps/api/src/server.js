import { existsSync, readFileSync } from 'node:fs';
import { loadEnv, EnvValidationError } from './config/env.js';
import { createLogger } from './config/logger.js';
import { connectMongo, disconnectMongo, checkDatabase } from './db/connection.js';
import { CloudinaryStorageProvider } from './shared/storage/CloudinaryStorageProvider.js';
import { createApp } from './app.js';

if (existsSync('.env')) process.loadEnvFile('.env');

let config;
try {
  config = loadEnv();
} catch (err) {
  if (err instanceof EnvValidationError) {
    console.error(err.message); // eslint-disable-line no-console
    process.exit(1);
  }
  throw err;
}

const logger = createLogger({ level: config.logLevel });
import { v2 as cloudinary } from 'cloudinary';

// TEMPORARY — remove after debugging
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
});
cloudinary.api.ping().then((r) => {
  logger.info({ result: r }, 'cloudinary ping');
}).catch((e) => {
  logger.error({ detail: e.error ?? e.message }, 'cloudinary ping FAILED');
});
const version = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
).version;

async function main() {
  await connectMongo({ uri: config.mongo.uri, dbName: config.mongo.dbName, logger });

  const storageProvider = new CloudinaryStorageProvider(config.cloudinary);

  const app = createApp({ config, logger, checkDatabase, storageProvider, version });
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.nodeEnv }, 'api listening');
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server.close(async () => {
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