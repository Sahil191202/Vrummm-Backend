import { Writable } from 'node:stream';
import { createLogger } from './config/logger.js';
import { loadEnv } from './config/env.js';
import { createApp } from './app.js';

export const testConfig = loadEnv({
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost:27017/test',
  CORS_ORIGINS: 'http://localhost:3000',
  ACCESS_TOKEN_SECRET: 'test-access-secret-aaaaaaaaaaaaaaaa',
  REFRESH_TOKEN_SECRET: 'test-refresh-secret-bbbbbbbbbbbbbbbbb',
});

export function silentLogger() {
  return createLogger({ level: 'silent' });
}

export function capturingLogger() {
  const lines = [];
  const destination = new Writable({
    write(chunk, _enc, cb) {
      lines.push(JSON.parse(chunk.toString()));
      cb();
    },
  });
  return { logger: createLogger({ level: 'info', destination }), lines };
}

export function buildTestApp({ dbUp = true, logger = silentLogger() } = {}) {
  return createApp({
    config: testConfig,
    logger,
    checkDatabase: async () => dbUp,
    version: '0.0.0-test',
  });
}
