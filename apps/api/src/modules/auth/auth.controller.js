import { ROLES } from '../rbac/permissions.js';
import { sendSuccess } from '../../shared/respond.js';
import { errors } from '../../shared/AppError.js';
import { logAudit } from '../audit/audit.service.js';

// Only admins can create non-CUSTOMER accounts through the register endpoint.
// Self-service registration always gets CUSTOMER.
const ADMIN_ONLY_ROLES = new Set([
  ROLES.SUPER_ADMIN,
  ROLES.OPERATIONS,
  ROLES.SUPPORT,
  ROLES.FINANCE,
  ROLES.MARKETING,
  ROLES.COMPLIANCE,
]);

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return (forwarded ? forwarded.split(',')[0].trim() : req.ip) ?? 'unknown';
}

export function createAuthController({ authService }) {
  return {
    async register(req, res) {
      const { email, password, displayName, phone, role } = req.validated.body;

      // Enforce role restriction. Public callers can only create CUSTOMER accounts.
      const isAdminCaller = req.user?.role && ADMIN_ONLY_ROLES.has(req.user.role);
      const requestedRole = role ?? ROLES.CUSTOMER;
      if (ADMIN_ONLY_ROLES.has(requestedRole) && !isAdminCaller) {
        throw errors.forbidden('You cannot create an account with that role');
      }

      const user = await authService.register({
        email,
        password,
        role: requestedRole,
        displayName,
        phone,
      });

      if (isAdminCaller) {
        await logAudit({
          actorId: req.user.sub,
          actorRole: req.user.role,
          action: 'auth.register.admin_created',
          targetType: 'User',
          targetId: user._id,
          requestId: req.id,
          meta: { email, role: requestedRole },
          ipAddress: clientIp(req),
        });
      }

      return sendSuccess(
        req,
        res,
        { userId: user._id, email: user.email, role: user.role },
        { status: 201 },
      );
    },

    async login(req, res) {
      const { email, password } = req.validated.body;
      const { user, accessToken, refreshToken } = await authService.login({
        email,
        password,
        ipAddress: clientIp(req),
        userAgent: req.get('user-agent'),
      });
      return sendSuccess(req, res, {
        accessToken,
        refreshToken,
        user: { id: user._id, email: user.email, role: user.role, displayName: user.displayName },
      });
    },

    async refresh(req, res) {
      const { refreshToken } = req.validated.body;
      const { accessToken, refreshToken: newRefreshToken } = await authService.refresh({
        refreshToken,
        ipAddress: clientIp(req),
        userAgent: req.get('user-agent'),
      });
      return sendSuccess(req, res, { accessToken, refreshToken: newRefreshToken });
    },

    async logout(req, res) {
      await authService.logout({ sessionId: req.user.sessionId });
      return sendSuccess(req, res, { message: 'Logged out' });
    },

    async logoutAll(req, res) {
      await authService.logoutAll({ userId: req.user.sub });
      return sendSuccess(req, res, { message: 'All sessions revoked' });
    },

    async me(req, res) {
      const { User } = await import('../rbac/schemas/user.schema.js');
      const user = await User.findById(req.user.sub);
      if (!user) throw errors.notFound('User not found');
      return sendSuccess(req, res, user);
    },
  };
}
