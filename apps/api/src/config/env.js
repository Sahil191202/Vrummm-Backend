import { z } from 'zod';

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const FLAG_NAMES = ['LIVE_RIDES_ENABLED', 'REAL_PAYMENTS_ENABLED', 'REAL_PAYOUTS_ENABLED'];

function isExactOrigin(value) {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    MONGODB_URI: z.string().refine((v) => /^mongodb(\+srv)?:\/\/.+/.test(v), {
      message: 'must be a mongodb:// or mongodb+srv:// connection string',
    }),
    MONGODB_DB_NAME: z.string().min(1).default('vrumm'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((s) =>
        s
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ACCESS_TOKEN_SECRET: z
      .string()
      .min(32, 'must be at least 32 characters — generate with: openssl rand -hex 32'),
    REFRESH_TOKEN_SECRET: z
      .string()
      .min(32, 'must be at least 32 characters — generate with: openssl rand -hex 32'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    LIVE_RIDES_ENABLED: flag,
    REAL_PAYMENTS_ENABLED: flag,
    REAL_PAYOUTS_ENABLED: flag,
  })
  .superRefine((env, ctx) => {
    for (const origin of env.CORS_ORIGINS) {
      const valid = isExactOrigin(origin);
      if (!valid) {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message:
            'each entry must be an exact origin like https://example.com (no wildcard, path or trailing slash)',
        });
      } else if (env.NODE_ENV === 'production' && !origin.startsWith('https://')) {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message: 'production origins must use https',
        });
      }
    }
    if (env.CORS_ORIGINS.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'at least one origin is required',
      });
    }
    if (env.NODE_ENV !== 'test' && env.ACCESS_TOKEN_SECRET === env.REFRESH_TOKEN_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['REFRESH_TOKEN_SECRET'],
        message: 'ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be different values',
      });
    }
    for (const name of FLAG_NAMES) {
      if (env[name]) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message:
            'must stay false: this is a learning project and is not authorised for live operation',
        });
      }
    }
  });

export class EnvValidationError extends Error {
  constructor(problems) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvValidationError';
    this.problems = problems;
  }
}

export function loadEnv(source = process.env) {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.') || 'env'}: ${i.message}`);
    throw new EnvValidationError(problems);
  }
  const e = result.data;
  return Object.freeze({
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    mongo: Object.freeze({ uri: e.MONGODB_URI, dbName: e.MONGODB_DB_NAME }),
    corsOrigins: Object.freeze(e.CORS_ORIGINS),
    auth: Object.freeze({
      accessTokenSecret: e.ACCESS_TOKEN_SECRET,
      refreshTokenSecret: e.REFRESH_TOKEN_SECRET,
      accessTokenTtlSeconds: e.ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlDays: e.REFRESH_TOKEN_TTL_DAYS,
    }),
    features: Object.freeze({
      liveRidesEnabled: e.LIVE_RIDES_ENABLED,
      realPaymentsEnabled: e.REAL_PAYMENTS_ENABLED,
      realPayoutsEnabled: e.REAL_PAYOUTS_ENABLED,
    }),
  });
}
