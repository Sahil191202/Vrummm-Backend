'use strict';

// dotenv is loaded by server.js before this module is required.
// We call it here too as a safety net for cases where env.js is loaded
// directly (e.g. scripts), but we do NOT override already-set vars.
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}

const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('3001')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),

  // MongoDB
  MONGODB_URI: z.string().url('MONGODB_URI must be a valid URL'),
  MONGODB_DB_NAME: z.string().min(1),

  // JWT
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),

  // MinIO / S3
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z
    .string()
    .default('9000')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1),
  MINIO_USE_SSL: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  // Providers
  STORAGE_PROVIDER: z.enum(['minio', 'local']).default('minio'),
  MAPS_PROVIDER: z.enum(['mock', 'googlemaps']).default('mock'),

  // Razorpay (optional in dev/test)
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default('60000')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),
  RATE_LIMIT_MAX: z
    .string()
    .default('100')
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),

  // Logging
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
    .default('info'),
});

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  // Use plain console.error here — logger isn't initialised yet
  // eslint-disable-next-line no-console
  console.error('[config/env] Environment validation failed:');
  parseResult.error.errors.forEach((err) => {
    // eslint-disable-next-line no-console
    console.error(`  ${err.path.join('.')}: ${err.message}`);
  });
  process.exit(1);
}

const config = parseResult.data;

module.exports = { config };
