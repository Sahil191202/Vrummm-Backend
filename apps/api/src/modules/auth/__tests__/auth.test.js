import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { buildTestApp, testConfig } from '../../../test-helpers.js';
import { createAuthService } from '../auth.service.js';

// ── In-memory mock stores ──────────────────────────────────────────────────────
const userStore = new Map();
const sessionStore = new Map();
let userSeq = 0;
let sessionSeq = 0;

function resetStores() {
  userStore.clear();
  sessionStore.clear();
  userSeq = 0;
  sessionSeq = 0;
}

// Mock returns a chainable object with .select() so auth.service can do
// User.findOne({email}).select('+passwordHash') without a real DB.
vi.mock('../../rbac/schemas/user.schema.js', () => {
  const User = {
    findOne: vi.fn(({ email } = {}) => {
      let found = null;
      for (const u of userStore.values()) {
        if (u.email === email) {
          found = u;
          break;
        }
      }
      // Return a thenable that also has .select() chaining.
      const result = found ? { ...found } : null;
      const chain = {
        select: () => chain,
        then: (resolve) => Promise.resolve(resolve(result)),
        catch: (reject) => Promise.resolve(result).catch(reject),
      };
      return chain;
    }),
    findById: vi.fn(async (id) => {
      const u = userStore.get(String(id));
      if (!u) return null;
      const { passwordHash: _ph, ...safe } = u;
      return safe;
    }),
    create: vi.fn(async (data) => {
      const id = String(++userSeq);
      const record = {
        _id: id,
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...data,
      };
      userStore.set(id, record);
      const { passwordHash: _ph, ...safe } = record;
      return safe;
    }),
    updateOne: vi.fn(async (filter, update) => {
      const targetId = filter._id ? String(filter._id) : null;
      if (!targetId) return;
      const u = userStore.get(targetId);
      if (u && update.$set) {
        Object.assign(u, update.$set);
        userStore.set(targetId, u);
      }
    }),
  };
  return { User };
});

vi.mock('../../rbac/schemas/session.schema.js', () => {
  const Session = {
    findById: vi.fn(async (id) => sessionStore.get(String(id)) ?? null),
    create: vi.fn(async (data) => {
      const id = String(++sessionSeq);
      const s = { _id: id, revokedAt: null, ...data };
      sessionStore.set(id, s);
      return s;
    }),
    updateOne: vi.fn(async (filter, update) => {
      const targetId = filter._id ? String(filter._id) : null;
      if (!targetId) return;
      const s = sessionStore.get(targetId);
      if (s && update.$set) {
        Object.assign(s, update.$set);
        sessionStore.set(targetId, s);
      }
    }),
    updateMany: vi.fn(async () => {}),
  };
  return { Session };
});

vi.mock('../../audit/audit.service.js', () => ({ logAudit: vi.fn(async () => {}) }));

const authService = createAuthService({ authConfig: testConfig.auth });

beforeEach(() => {
  resetStores();
  vi.clearAllMocks();
});

// ── Registration ───────────────────────────────────────────────────────────────
describe('register', () => {
  it('creates a user and does not return a password hash', async () => {
    const user = await authService.register({
      email: 'a@test.com',
      password: 'Password1!',
      role: 'CUSTOMER',
    });
    expect(user.email).toBe('a@test.com');
    expect(user.passwordHash).toBeUndefined();
  });

  it('throws CONFLICT on duplicate email', async () => {
    await authService.register({ email: 'dup@test.com', password: 'Password1!', role: 'CUSTOMER' });
    await expect(
      authService.register({ email: 'dup@test.com', password: 'Password1!', role: 'CUSTOMER' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

// ── Login ──────────────────────────────────────────────────────────────────────
describe('login', () => {
  beforeEach(async () => {
    // Pre-insert a user with a real bcrypt hash so the service can compare it.
    const passwordHash = await bcrypt.hash('Password1!', 1); // 1 round for speed in tests
    const id = String(++userSeq);
    userStore.set(id, {
      _id: id,
      email: 'user@test.com',
      passwordHash,
      role: 'CUSTOMER',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  });

  it('returns access and refresh tokens on valid credentials', async () => {
    const result = await authService.login({ email: 'user@test.com', password: 'Password1!' });
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it('throws UNAUTHENTICATED on wrong password', async () => {
    await expect(
      authService.login({ email: 'user@test.com', password: 'WrongPassword' }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('throws UNAUTHENTICATED on unknown email', async () => {
    await expect(
      authService.login({ email: 'nobody@test.com', password: 'Password1!' }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('locks the account after max failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await authService.login({ email: 'user@test.com', password: 'wrong' }).catch(() => {});
    }
    await expect(
      authService.login({ email: 'user@test.com', password: 'Password1!' }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
  });
});

// ── Token refresh ──────────────────────────────────────────────────────────────
describe('refresh', () => {
  async function loginUser() {
    const passwordHash = await bcrypt.hash('Password1!', 1);
    const id = String(++userSeq);
    userStore.set(id, {
      _id: id,
      email: `u${id}@test.com`,
      passwordHash,
      role: 'CUSTOMER',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    return authService.login({ email: `u${id}@test.com`, password: 'Password1!' });
  }

  it('returns new tokens and rotates the refresh token', async () => {
    const { refreshToken: original } = await loginUser();
    const { accessToken, refreshToken: rotated } = await authService.refresh({
      refreshToken: original,
    });
    expect(accessToken).toBeTruthy();
    expect(rotated).not.toBe(original);
  });

  it('rejects the same refresh token twice (rotation)', async () => {
    const { refreshToken } = await loginUser();
    await authService.refresh({ refreshToken });
    await expect(authService.refresh({ refreshToken })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('rejects a tampered token', async () => {
    await expect(
      authService.refresh({ refreshToken: 'eyJhbGciOiJIUzI1NiJ9.fake.sig' }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});

// ── verifyAccessToken ──────────────────────────────────────────────────────────
describe('verifyAccessToken', () => {
  it('returns the decoded payload for a valid token', async () => {
    const passwordHash = await bcrypt.hash('Password1!', 1);
    const id = String(++userSeq);
    userStore.set(id, {
      _id: id,
      email: 'v@test.com',
      passwordHash,
      role: 'CUSTOMER',
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    const { accessToken } = await authService.login({
      email: 'v@test.com',
      password: 'Password1!',
    });
    const payload = authService.verifyAccessToken(accessToken);
    expect(payload.role).toBe('CUSTOMER');
    expect(payload.sub).toBeTruthy();
  });

  it('rejects a token signed with a different secret', () => {
    const badService = createAuthService({
      authConfig: { ...testConfig.auth, accessTokenSecret: 'different-secret-xxxxxxxxxxxxxxxxxx' },
    });
    expect(() => badService.verifyAccessToken('not.a.real.token')).toThrow();
  });
});

// ── HTTP layer ─────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/register', () => {
  it('returns 201 with userId', async () => {
    const res = await request(buildTestApp())
      .post('/api/v1/auth/register')
      .send({ email: 'new@example.com', password: 'Password1!' });
    expect(res.status).toBe(201);
    expect(res.body.data.userId).toBeTruthy();
    expect(res.body.data.role).toBe('CUSTOMER');
  });

  it('returns 400 VALIDATION_ERROR for a weak password', async () => {
    const res = await request(buildTestApp())
      .post('/api/v1/auth/register')
      .send({ email: 'x@example.com', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for a bad email', async () => {
    const res = await request(buildTestApp())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'Password1!' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns 400 for an empty body', async () => {
    const res = await request(buildTestApp()).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(buildTestApp()).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns 401 for a malformed bearer token', async () => {
    const res = await request(buildTestApp())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });
});
