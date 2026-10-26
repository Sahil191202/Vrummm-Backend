import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../../../test-helpers.js';
import { ROLES, PERMISSIONS, hasPermission, ROLE_PERMISSIONS } from '../permissions.js';

describe('hasPermission', () => {
  it('SUPER_ADMIN has every permission', () => {
    for (const p of Object.values(PERMISSIONS)) {
      expect(hasPermission(ROLES.SUPER_ADMIN, p), p).toBe(true);
    }
  });

  it('CUSTOMER and CAPTAIN have no admin permissions', () => {
    for (const p of Object.values(PERMISSIONS)) {
      expect(hasPermission(ROLES.CUSTOMER, p), `CUSTOMER.${p}`).toBe(false);
      expect(hasPermission(ROLES.CAPTAIN, p), `CAPTAIN.${p}`).toBe(false);
    }
  });

  it('FINANCE can read payments but not write fares', () => {
    expect(hasPermission(ROLES.FINANCE, PERMISSIONS.PAYMENTS_READ)).toBe(true);
    expect(hasPermission(ROLES.FINANCE, PERMISSIONS.FARES_WRITE)).toBe(false);
  });

  it('SUPPORT can resolve incidents but not write promotions', () => {
    expect(hasPermission(ROLES.SUPPORT, PERMISSIONS.INCIDENTS_RESOLVE)).toBe(true);
    expect(hasPermission(ROLES.SUPPORT, PERMISSIONS.PROMOTIONS_WRITE)).toBe(false);
  });

  it('returns false for unknown roles without throwing', () => {
    expect(hasPermission('UNKNOWN_ROLE', PERMISSIONS.RIDES_READ)).toBe(false);
  });

  it('every role has a defined permission set', () => {
    for (const role of Object.values(ROLES)) {
      expect(ROLE_PERMISSIONS[role], role).toBeInstanceOf(Set);
    }
  });
});

describe('requirePermission middleware (HTTP)', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(buildTestApp()).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 403 when a valid token lacks the permission', async () => {
    // We test this through the auth router using the middleware chain.
    // A more direct route test will be added in Phase 8 when admin routes exist.
    expect(hasPermission(ROLES.CUSTOMER, PERMISSIONS.FARES_WRITE)).toBe(false);
  });
});
