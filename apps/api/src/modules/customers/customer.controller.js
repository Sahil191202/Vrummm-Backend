import { sendSuccess } from '../../shared/respond.js';

export function createCustomerController({ customerService }) {
  return {
    async getProfile(req, res) {
      const profile = await customerService.getProfile(req.user.sub);
      return sendSuccess(req, res, profile);
    },

    async updateProfile(req, res) {
      const profile = await customerService.updateProfile(req.user.sub, req.validated.body);
      return sendSuccess(req, res, profile);
    },

    async addSavedPlace(req, res) {
      const profile = await customerService.addSavedPlace(req.user.sub, req.validated.body);
      return sendSuccess(req, res, profile, { status: 201 });
    },

    async removeSavedPlace(req, res) {
      const profile = await customerService.removeSavedPlace(
        req.user.sub,
        req.validated.params.placeId,
      );
      return sendSuccess(req, res, profile);
    },
  };
}