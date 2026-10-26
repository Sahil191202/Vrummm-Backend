import { describe, it, expect } from 'vitest';
import { ERROR_CODES, ERROR_STATUS, errorEnvelope, successEnvelope } from './index.js';

describe('error codes', () => {
  it('maps every code to an HTTP status', () => {
    for (const code of Object.values(ERROR_CODES)) {
      expect(ERROR_STATUS[code], code).toBeTypeOf('number');
    }
  });

  it('uses the status codes required by the spec', () => {
    expect(ERROR_STATUS.UNAUTHENTICATED).toBe(401);
    expect(ERROR_STATUS.FORBIDDEN).toBe(403);
    expect(ERROR_STATUS.NOT_FOUND).toBe(404);
    expect(ERROR_STATUS.CONFLICT).toBe(409);
    expect(ERROR_STATUS.BUSINESS_RULE_VIOLATION).toBe(422);
  });
});

describe('envelopes', () => {
  it('builds a success envelope', () => {
    expect(successEnvelope({ data: { a: 1 }, requestId: 'r1' })).toEqual({
      success: true,
      data: { a: 1 },
      requestId: 'r1',
    });
  });

  it('builds an error envelope and omits empty details', () => {
    const body = errorEnvelope({ code: 'NOT_FOUND', message: 'x', requestId: 'r1' });
    expect(body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'x' },
      requestId: 'r1',
    });
    expect('details' in body.error).toBe(false);
  });
});
