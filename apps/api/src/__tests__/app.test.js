import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { buildTestApp, capturingLogger, silentLogger } from '../test-helpers.js';
import { requestId } from '../middleware/requestId.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';
import { errors } from '../shared/AppError.js';

describe('request ids', () => {
  it('creates an id when none is sent', async () => {
    const res = await request(buildTestApp()).get('/api/v1/health');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('echoes a safe client id', async () => {
    const res = await request(buildTestApp())
      .get('/api/v1/health')
      .set('X-Request-Id', 'client-req-12345');
    expect(res.headers['x-request-id']).toBe('client-req-12345');
  });

  it('replaces an unsafe client id', async () => {
    const res = await request(buildTestApp())
      .get('/api/v1/health')
      .set('X-Request-Id', 'bad id with spaces!!');
    expect(res.headers['x-request-id']).not.toBe('bad id with spaces!!');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('error format', () => {
  it('returns 404 NOT_FOUND for unknown routes', async () => {
    const res = await request(buildTestApp()).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    expect(res.body.requestId).toBeTruthy();
  });

  it('returns 400 BAD_REQUEST for malformed JSON', async () => {
    const res = await request(buildTestApp())
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 413 PAYLOAD_TOO_LARGE for oversized bodies', async () => {
    const res = await request(buildTestApp())
      .post('/api/v1/health')
      .send({ blob: 'x'.repeat(150_000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  function appThatThrows(thrower) {
    const app = express();
    app.use(requestId);
    app.get('/boom', () => {
      throw thrower();
    });
    app.get('/async-boom', async () => {
      throw thrower();
    });
    app.use(errorHandler(silentLogger()));
    return app;
  }

  it('maps AppError to its code and status', async () => {
    const app = appThatThrows(() => errors.conflict('Already assigned', { rideId: 'r1' }));
    const res = await request(app).get('/boom');
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'CONFLICT',
      message: 'Already assigned',
      details: { rideId: 'r1' },
    });
  });

  it('uses 422 for business rule violations and 403 for forbidden', async () => {
    expect(
      (await request(appThatThrows(() => errors.businessRule('no'))).get('/boom')).status,
    ).toBe(422);
    expect((await request(appThatThrows(() => errors.forbidden())).get('/boom')).status).toBe(403);
  });

  it('hides internals for unexpected errors, including async ones', async () => {
    const app = appThatThrows(() => new Error('db password is hunter2'));
    for (const path of ['/boom', '/async-boom']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(res.body)).not.toContain('hunter2');
    }
  });
});

describe('validate middleware', () => {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.post(
    '/things/:id',
    validate({
      params: z.object({ id: z.string().min(3) }),
      query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
      body: z.object({ name: z.string().min(1) }),
    }),
    (req, res) => res.json(req.validated),
  );
  app.use(errorHandler(silentLogger()));

  it('passes parsed values through', async () => {
    const res = await request(app).post('/things/abc?page=2').send({ name: 'x' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ params: { id: 'abc' }, query: { page: 2 }, body: { name: 'x' } });
  });

  it('returns 400 VALIDATION_ERROR listing every problem', async () => {
    const res = await request(app).post('/things/a?page=0').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const places = res.body.error.details.map((d) => d.in).sort();
    expect(places).toEqual(['body', 'params', 'query']);
  });
});

describe('security headers and CORS', () => {
  it('sets helmet headers and hides x-powered-by', async () => {
    const res = await request(buildTestApp()).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('allows a listed origin and not an unlisted one', async () => {
    const ok = await request(buildTestApp())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:3000');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    const bad = await request(buildTestApp())
      .get('/api/v1/health')
      .set('Origin', 'http://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('request logging', () => {
  it('logs request id and path, but never the query string', async () => {
    const { logger, lines } = capturingLogger();
    await request(buildTestApp({ logger }))
      .get('/api/v1/health?token=super-secret')
      .set('X-Request-Id', 'log-test-123456');
    const entry = lines.find((l) => l.msg === 'request completed');
    expect(entry).toMatchObject({
      requestId: 'log-test-123456',
      path: '/api/v1/health',
      statusCode: 200,
    });
    expect(JSON.stringify(lines)).not.toContain('super-secret');
  });

  it('redacts secrets and auth headers', async () => {
    const { logger, lines } = capturingLogger();
    logger.info(
      { pin: '1234', password: 'p', req: { headers: { authorization: 'Bearer abc' } } },
      'x',
    );
    const text = JSON.stringify(lines);
    expect(text).not.toContain('1234');
    expect(text).not.toContain('Bearer abc');
    expect(text).toContain('[REDACTED]');
  });
});
