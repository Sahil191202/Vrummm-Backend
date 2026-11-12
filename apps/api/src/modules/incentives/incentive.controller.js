import { sendSuccess } from '../../shared/respond.js';
import { Captain } from '../captains/schemas/captain.schema.js';
import { errors } from '../../shared/AppError.js';

export function createIncentiveController({ incentiveService }) {
  return {
    async createCampaign(req, res) {
      const campaign = await incentiveService.createCampaign(req.validated.body, req.user.sub);
      return sendSuccess(req, res, campaign, { status: 201 });
    },

    async listCampaigns(req, res) {
      const { page, limit, ...filter } = req.validated.query;
      const result = await incentiveService.listCampaigns(filter, { page, limit });
      return sendSuccess(req, res, result.campaigns, { meta: result.pagination });
    },

    async getCampaign(req, res) {
      const campaign = await incentiveService.getCampaignById(req.validated.params.campaignId);
      return sendSuccess(req, res, campaign);
    },

    async evaluateIncentive(req, res) {
      const { campaignId, periodKey, progressCount } = req.validated.body;

      const captain = await Captain.findOne({ userId: req.user.sub });
      if (!captain) throw errors.notFound('Captain profile not found');

      const result = await incentiveService.checkAndAwardIncentive({
        campaignId,
        captainId: captain._id,
        captainUserId: req.user.sub,
        periodKey,
        progressCount,
        actorUserId: req.user.sub,
      });

      return sendSuccess(req, res, result);
    },

    async getMyAwards(req, res) {
      const captain = await Captain.findOne({ userId: req.user.sub });
      if (!captain) throw errors.notFound('Captain profile not found');

      const awards = await incentiveService.listCaptainAwards(captain._id);
      return sendSuccess(req, res, awards);
    },
  };
}
