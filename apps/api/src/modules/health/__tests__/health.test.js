'use strict';

const request = require('supertest');

// Set required env vars before loading the app
process.env.NODE_ENV = 'test';
process.env.PORT = '3002';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/vrumm_test?replicaSet=rs0';
process.env.MONGODB_DB_NAME = 'vrumm_test';
process.env.JWT_SECRET = 'test_jwt_secret_at_least_16_chars';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_at_least_16_chars';
process.env.MINIO_ENDPOINT = '127.0.0.1';
process.env.MINIO_PORT = '9000';
process.env.MINIO_ACCESS_KEY = 'minioadmin';
process.env.MINIO_SECRET_KEY = 'minioadmin';
process.env.MINIO_BUCKET = 'vrumm-test';
process.env.MINIO_USE_SSL = 'false';
process.env.STORAGE_PROVIDER = 'local';
process.env.MAPS_PROVIDER = 'mock';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX = '1000';
process.env.LOG_LEVEL = 'silent';

// Mock mongoose so the health route can return different DB states
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connection: {
      ...actual.connection,
      readyState: 1, // simulate connected
    },
  };
});

const { app } = require('../../../app');

describe('GET /api/v1/health', () => {
  it('returns 200 with success:true and correct shape', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns status "ok"', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.body.data.status).toBe('ok');
  });

  it('includes a valid ISO timestamp', async () => {
    const res = await request(app).get('/api/v1/health');
    const ts = res.body.data.timestamp;
    expect(ts).toBeDefined();
    expect(new Date(ts).toISOString()).toBe(ts);
  });

  it('includes a version field', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.body.data.version).toBeDefined();
    expect(typeof res.body.data.version).toBe('string');
  });

  it('includes db field as "connected" when mongoose readyState is 1', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.body.data.db).toBe('connected');
  });

  it('includes an env field', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.body.data.env).toBeDefined();
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
