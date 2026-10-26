import { errors } from '../shared/AppError.js';

// Verifies the JWT access token and attaches the decoded payload to req.user.
// Does NOT check database. Access tokens are self-contained.
export function authenticate(authService) {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return next(errors.unauthenticated('Authorization header missing or malformed'));
    }
    const token = header.slice(7);
    try {
      req.user = authService.verifyAccessToken(token);
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

// Optional auth: attaches req.user if a valid token is present, but does not block the request.
export function optionalAuthenticate(authService) {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next();
    const token = header.slice(7);
    try {
      req.user = authService.verifyAccessToken(token);
    } catch {
      // Ignore invalid tokens for optional auth routes.
    }
    return next();
  };
}
