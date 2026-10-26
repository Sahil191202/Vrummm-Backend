import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../../../test-helpers.js';

describe('GET /api/v1/health', () => {
  it('returns liveness in the standard success envelope', async () => {
    const res = await request(buildTestApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      status: 'ok',
      service: 'vrumm-api',
      version: '0.0.0-test',
    });
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('stays up even when the database is down', async () => {
    const res = await request(buildTestApp({ dbUp: false })).get('/api/v1/health');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/health/ready', () => {
  it('returns 200 when the database is up', async () => {
    const res = await request(buildTestApp({ dbUp: true })).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.data.checks.database).toBe('up');
  });

  it('returns 503 with an error envelope when the database is down', async () => {
    const res = await request(buildTestApp({ dbUp: false })).get('/api/v1/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.body.error.details.checks.database).toBe('down');
  });
});
