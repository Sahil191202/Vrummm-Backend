import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { registerSchema, loginSchema, refreshSchema } from './schemas/auth.schemas.js';
import { createAuthController } from './auth.controller.js';

function authLimiter(max, windowMinutes, message) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    message: { success: false, error: { code: 'RATE_LIMITED', message } },
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const forwarded = req.headers['x-forwarded-for'];
      const raw = forwarded ? forwarded.split(',')[0].trim() : req.ip;
      return ipKeyGenerator(raw ?? '');
    },
  });
}

const loginLimiter = authLimiter(10, 15, 'Too many login attempts. Try again in 15 minutes.');
const registerLimiter = authLimiter(5, 60, 'Too many registration attempts. Try again in 1 hour.');
const refreshLimiter = authLimiter(30, 15, 'Too many token refresh attempts. Try again shortly.');

export function createAuthRouter({ authService }) {
  const controller = createAuthController({ authService });
  const router = Router();

  router.post(
    '/register',
    registerLimiter,
    validate({ body: registerSchema }),
    controller.register,
  );
  router.post('/login', loginLimiter, validate({ body: loginSchema }), controller.login);
  router.post('/refresh', refreshLimiter, validate({ body: refreshSchema }), controller.refresh);
  router.post('/logout', authenticate(authService), controller.logout);
  router.post('/logout-all', authenticate(authService), controller.logoutAll);
  router.get('/me', authenticate(authService), controller.me);

  return router;
}
