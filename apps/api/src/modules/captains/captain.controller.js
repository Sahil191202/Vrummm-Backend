import { sendSuccess } from '../../shared/respond.js';
import { logAudit } from '../audit/audit.service.js';

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? fwd.split(',')[0].trim() : req.ip) ?? 'unknown';
}

export function createCaptainController({ captainService }) {
  return {
    async getMyProfile(req, res) {
      const profile = await captainService.getProfileByUserId(req.user.sub);
      return sendSuccess(req, res, profile);
    },

    async updateMyProfile(req, res) {
      const profile = await captainService.updateProfile(req.user.sub, req.validated.body);
      return sendSuccess(req, res, profile);
    },

    async setAvailability(req, res) {
      const result = await captainService.setAvailability(
        req.user.sub,
        req.validated.body.isOnline,
      );
      return sendSuccess(req, res, result);
    },

    async checkEligibility(req, res) {
      const captain = await captainService.getProfileByUserId(req.user.sub);
      const result = await captainService.checkEligibility(captain._id);
      return sendSuccess(req, res, result);
    },

    // Admin endpoints
    async listCaptains(req, res) {
      const { page, limit, search } = req.validated.query;
      const { approvalStatus } = req.validated.query;
      const result = await captainService.listCaptains({ page, limit, search, approvalStatus });
      return sendSuccess(req, res, result.captains, {
        meta: { total: result.total, page: result.page, pages: result.pages, limit: result.limit },
      });
    },

    async getCaptain(req, res) {
      const profile = await captainService.getProfile(req.validated.params.captainId);
      return sendSuccess(req, res, profile);
    },

    async setApprovalStatus(req, res) {
      const { captainId } = req.validated.params;
      const { status, reason } = req.validated.body;
      const captain = await captainService.setApprovalStatus(captainId, {
        status,
        reason,
        adminUserId: req.user.sub,
      });
      await logAudit({
        actorId: req.user.sub,
        actorRole: req.user.role,
        action: `captain.approval.${status.toLowerCase()}`,
        targetType: 'Captain',
        targetId: captainId,
        requestId: req.id,
        reason,
        ipAddress: clientIp(req),
      });
      return sendSuccess(req, res, captain);
    },
  };
}