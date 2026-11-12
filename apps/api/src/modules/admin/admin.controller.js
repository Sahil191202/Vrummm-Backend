import { sendSuccess } from '../../shared/respond.js';

export function createAdminController({ adminService }) {
  return {
    async getOperationsSummary(req, res) {
      const summary = await adminService.getOperationsSummary(req.validated.query);
      return sendSuccess(req, res, summary);
    },

    async getFinancialSummary(req, res) {
      const summary = await adminService.getFinancialSummary(req.validated.query);
      return sendSuccess(req, res, summary);
    },

    async getLeaderboard(req, res) {
      const leaderboard = await adminService.getCaptainLeaderboard(req.validated.query);
      return sendSuccess(req, res, leaderboard);
    },
  };
}
