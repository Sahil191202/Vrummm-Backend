import { describe, it, expect } from 'vitest';
import { loadEnv, EnvValidationError } from './env.js';

const valid = {
  MONGODB_URI: 'mongodb+srv://user:secretpass@cluster0.example.mongodb.net/',
  ACCESS_TOKEN_SECRET: 'access-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  REFRESH_TOKEN_SECRET: 'refresh-secret-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
};

describe('loadEnv', () => {
  it('applies safe defaults', () => {
    const c = loadEnv(valid);
    expect(c.port).toBe(4000);
    expect(c.nodeEnv).toBe('development');
    expect(c.mongo.dbName).toBe('vrumm');
    expect(c.features).toEqual({
      liveRidesEnabled: false,
      realPaymentsEnabled: false,
      realPayoutsEnabled: false,
    });
    expect(c.auth.accessTokenTtlSeconds).toBe(900);
    expect(c.auth.refreshTokenTtlDays).toBe(30);
  });

  it('fails when the Mongo URI is missing', () => {
    expect(() =>
      loadEnv({
        ACCESS_TOKEN_SECRET: valid.ACCESS_TOKEN_SECRET,
        REFRESH_TOKEN_SECRET: valid.REFRESH_TOKEN_SECRET,
      }),
    ).toThrow(EnvValidationError);
  });

  it('rejects a non-mongodb URI without echoing it', () => {
    try {
      loadEnv({ ...valid, MONGODB_URI: 'postgres://admin:topsecret@host/db' });
      expect.unreachable();
    } catch (err) {
      expect(err.message).toContain('MONGODB_URI');
      expect(err.message).not.toContain('topsecret');
    }
  });

  it('rejects a bad port', () => {
    expect(() => loadEnv({ ...valid, PORT: '99999' })).toThrow(/PORT/);
    expect(() => loadEnv({ ...valid, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('parses a comma-separated CORS list', () => {
    const c = loadEnv({ ...valid, CORS_ORIGINS: 'http://localhost:3000, http://localhost:5173' });
    expect(c.corsOrigins).toEqual(['http://localhost:3000', 'http://localhost:5173']);
  });

  it('rejects wildcard and malformed CORS origins', () => {
    expect(() => loadEnv({ ...valid, CORS_ORIGINS: '*' })).toThrow(/CORS_ORIGINS/);
    expect(() => loadEnv({ ...valid, CORS_ORIGINS: 'http://localhost:3000/' })).toThrow(
      /CORS_ORIGINS/,
    );
  });

  it('requires https origins in production', () => {
    expect(() =>
      loadEnv({ ...valid, NODE_ENV: 'production', CORS_ORIGINS: 'http://example.com' }),
    ).toThrow(/https/);
    expect(
      loadEnv({ ...valid, NODE_ENV: 'production', CORS_ORIGINS: 'https://example.com' })
        .corsOrigins,
    ).toEqual(['https://example.com']);
  });

  it('refuses to start with any live-operation switch on', () => {
    for (const name of ['LIVE_RIDES_ENABLED', 'REAL_PAYMENTS_ENABLED', 'REAL_PAYOUTS_ENABLED']) {
      expect(() => loadEnv({ ...valid, [name]: 'true' }), name).toThrow(new RegExp(name));
    }
  });

  it('rejects identical access and refresh token secrets (outside test env)', () => {
    expect(() =>
      loadEnv({
        ...valid,
        NODE_ENV: 'development',
        ACCESS_TOKEN_SECRET: 'same-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        REFRESH_TOKEN_SECRET: 'same-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    ).toThrow(/REFRESH_TOKEN_SECRET/);
  });

  it('rejects secrets shorter than 32 characters', () => {
    expect(() => loadEnv({ ...valid, ACCESS_TOKEN_SECRET: 'short' })).toThrow(
      /ACCESS_TOKEN_SECRET/,
    );
  });
});
