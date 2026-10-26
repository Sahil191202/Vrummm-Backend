import { hasPermission } from '../modules/rbac/permissions.js';
import { errors } from '../shared/AppError.js';

// Usage: requirePermission('rides.read')
// Must be used after authenticate middleware.
export function requirePermission(permission) {
  return (req, _res, next) => {
    if (!req.user) return next(errors.unauthenticated());
    if (!hasPermission(req.user.role, permission)) {
      return next(errors.forbidden(`Missing permission: ${permission}`));
    }
    return next();
  };
}

// Require any of the given permissions (OR logic).
export function requireAnyPermission(...permissions) {
  return (req, _res, next) => {
    if (!req.user) return next(errors.unauthenticated());
    const ok = permissions.some((p) => hasPermission(req.user.role, p));
    if (!ok) {
      return next(errors.forbidden(`Missing one of: ${permissions.join(', ')}`));
    }
    return next();
  };
}

// Require the caller to have one of the listed roles (useful for customer/captain routes).
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(errors.unauthenticated());
    if (!roles.includes(req.user.role)) {
      return next(errors.forbidden('This action is not available for your account type'));
    }
    return next();
  };
}
