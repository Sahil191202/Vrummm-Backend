import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../rbac/schemas/user.schema.js';
import { Session } from '../rbac/schemas/session.schema.js';
import { errors } from '../../shared/AppError.js';

const BCRYPT_ROUNDS = 12;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

// ── Token helpers ──────────────────────────────────────────────────────────────

function generateOpaqueToken() {
  return randomBytes(48).toString('hex'); // 96 hex chars
}

async function hashToken(token) {
  // bcrypt is used for passwords. For session tokens, which are high-entropy
  // random values, a single bcrypt round is sufficient and fast enough.
  return bcrypt.hash(token, 1);
}

async function verifyTokenHash(token, hash) {
  return bcrypt.compare(token, hash);
}

function signAccessToken(payload, secret, ttlSeconds) {
  return jwt.sign(payload, secret, {
    expiresIn: ttlSeconds,
    algorithm: 'HS256',
  });
}

// ── Auth service factory ───────────────────────────────────────────────────────
// Dependencies are injected so tests can override config without touching process.env.

export function createAuthService({ authConfig }) {
  const { accessTokenSecret, refreshTokenSecret, accessTokenTtlSeconds, refreshTokenTtlDays } =
    authConfig;

  // ── Register ───────────────────────────────────────────────────────────────
  async function register({ email, password, role, displayName, phone }) {
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) throw errors.conflict('An account with this email already exists');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      email: email.toLowerCase().trim(),
      phone,
      passwordHash,
      role,
      displayName,
    });
    return user;
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  async function login({ email, password, ipAddress, userAgent }) {
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');

    // Use a constant-time comparison path even when the user doesn't exist,
    // to avoid timing-based user enumeration.
    const dummyHash = '$2b$12$invalidhashfortimingnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn';
    const passwordHash = user?.passwordHash ?? dummyHash;

    const passwordMatch = await bcrypt.compare(password, passwordHash);

    if (!user || !passwordMatch) {
      if (user) await recordFailedLogin(user);
      throw errors.unauthenticated('Invalid email or password');
    }

    if (!user.isActive) throw errors.forbidden('Account is deactivated');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const waitSeconds = Math.ceil((user.lockedUntil - Date.now()) / 1000);
      throw errors.businessRule(
        `Account is temporarily locked. Try again in ${waitSeconds} seconds.`,
        { lockedUntilIso: user.lockedUntil.toISOString() },
      );
    }

    // Reset failure counter on successful login.
    await User.updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } },
    );

    const { accessToken, refreshToken, session } = await createTokenPair({
      userId: user._id,
      role: user.role,
      ipAddress,
      userAgent,
    });

    return { user, accessToken, refreshToken, sessionId: session._id };
  }

  // ── Refresh ────────────────────────────────────────────────────────────────
  async function refresh({ refreshToken, ipAddress, userAgent }) {
    // Decode without verification first to find the session.
    let payload;
    try {
      payload = jwt.verify(refreshToken, refreshTokenSecret, { algorithms: ['HS256'] });
    } catch {
      throw errors.unauthenticated('Invalid or expired refresh token');
    }

    const session = await Session.findById(payload.sessionId);
    if (!session) throw errors.unauthenticated('Session not found');
    if (session.revokedAt) throw errors.unauthenticated('Session has been revoked');
    if (session.expiresAt < new Date()) throw errors.unauthenticated('Session has expired');

    const tokenValid = await verifyTokenHash(payload.opaqueToken, session.tokenHash);
    if (!tokenValid) throw errors.unauthenticated('Invalid refresh token');

    const user = await User.findById(session.userId);
    if (!user || !user.isActive) throw errors.unauthenticated('User not found or deactivated');

    // Rotate: revoke old session, issue new pair.
    await Session.updateOne(
      { _id: session._id },
      { $set: { revokedAt: new Date(), revokedReason: 'logout' } },
    );

    const {
      accessToken,
      refreshToken: newRefreshToken,
      session: newSession,
    } = await createTokenPair({ userId: user._id, role: user.role, ipAddress, userAgent });

    await Session.updateOne({ _id: session._id }, { $set: { lastUsedAt: new Date() } });

    return { accessToken, refreshToken: newRefreshToken, sessionId: newSession._id };
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async function logout({ sessionId, reason = 'logout' }) {
    await Session.updateOne(
      { _id: sessionId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: reason } },
    );
  }

  async function logoutAll({ userId }) {
    await Session.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'logout_all' } },
    );
  }

  // ── Verify access token ────────────────────────────────────────────────────
  // Used by the authenticate middleware. Returns the decoded payload or throws.
  function verifyAccessToken(token) {
    try {
      return jwt.verify(token, accessTokenSecret, { algorithms: ['HS256'] });
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw errors.unauthenticated('Access token has expired');
      }
      throw errors.unauthenticated('Invalid access token');
    }
  }

  // ── Internal helpers ───────────────────────────────────────────────────────
  async function createTokenPair({ userId, role, ipAddress, userAgent }) {
    const opaqueToken = generateOpaqueToken();
    const tokenHash = await hashToken(opaqueToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshTokenTtlDays);

    const session = await Session.create({
      userId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    });

    const refreshToken = jwt.sign(
      { sessionId: session._id.toString(), opaqueToken },
      refreshTokenSecret,
      { expiresIn: `${refreshTokenTtlDays}d`, algorithm: 'HS256' },
    );

    const accessToken = signAccessToken(
      { sub: userId.toString(), role, sessionId: session._id.toString() },
      accessTokenSecret,
      accessTokenTtlSeconds,
    );

    return { accessToken, refreshToken, session };
  }

  async function recordFailedLogin(user) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const update = { failedLoginAttempts: attempts };
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      update.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
    }
    await User.updateOne({ _id: user._id }, { $set: update });
  }

  return { register, login, refresh, logout, logoutAll, verifyAccessToken };
}
