import { sendSuccess } from '../../shared/respond.js';
import { ROLES } from '../rbac/permissions.js';

export function createLedgerController({ ledgerService }) {
  return {
    async listEntries(req, res) {
      const { page, limit, ...filter } = req.validated.query;
      const result = await ledgerService.listEntries(filter, { page, limit });
      return sendSuccess(req, res, result.entries, { meta: result.pagination });
    },

    async getBalance(req, res) {
      // If user is captain, get their captain balance. If admin, check query params or defaults.
      let targetUserId = req.user.sub;
      let accountType = req.user.role === ROLES.CAPTAIN ? 'CAPTAIN' : 'CUSTOMER';

      if (req.user.role === ROLES.SUPER_ADMIN || req.user.role === ROLES.FINANCE) {
        if (req.query.accountUserId) targetUserId = req.query.accountUserId;
        if (req.query.accountType) accountType = req.query.accountType;
      }

      const balancePaise = await ledgerService.getAccountBalance(targetUserId, accountType);
      return sendSuccess(req, res, {
        accountUserId: targetUserId,
        accountType,
        balancePaise,
        balanceRupees: balancePaise / 100,
      });
    },

    async createAdjustment(req, res) {
      const entry = await ledgerService.createAdjustment({
        ...req.validated.body,
        actorUserId: req.user.sub,
      });
      return sendSuccess(req, res, entry, { status: 201 });
    },

    async simulatePayout(req, res) {
      const { amountPaise, idempotencyKey } = req.validated.body;
      const entry = await ledgerService.recordSimulatedPayout({
        captainUserId: req.user.sub,
        amountPaise,
        actorUserId: req.user.sub,
        idempotencyKey,
      });
      return sendSuccess(req, res, entry, { status: 201 });
    },
  };
}
