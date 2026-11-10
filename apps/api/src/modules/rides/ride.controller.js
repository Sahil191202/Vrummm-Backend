import { sendSuccess } from '../../shared/respond.js';

export function createRideController({ rideService }) {
  return {
    async captainArrived(req, res) {
      const ride = await rideService.captainArrived(req.validated.params.rideId, req.user.sub);
      return sendSuccess(req, res, ride);
    },

    async verifyPin(req, res) {
      const ride = await rideService.verifyPinAndStart(
        req.validated.params.rideId,
        req.user.sub,
        req.validated.body.pin,
      );
      return sendSuccess(req, res, ride);
    },

    async addLocationSample(req, res) {
      const sample = await rideService.addLocationSample(
        req.validated.params.rideId,
        req.user.sub,
        req.validated.body,
      );
      return sendSuccess(req, res, sample, { status: 201 });
    },

    async completeRide(req, res) {
      const ride = await rideService.completeRide(
        req.validated.params.rideId,
        req.user.sub,
        req.validated.body,
      );
      return sendSuccess(req, res, ride);
    },

    async cancelRide(req, res) {
      const ride = await rideService.cancelRide(
        req.validated.params.rideId,
        req.user.sub,
        req.user.role,
        req.validated.body,
      );
      return sendSuccess(req, res, ride);
    },

    async getRide(req, res) {
      const ride = await rideService.getRide(
        req.validated.params.rideId,
        req.user.sub,
        req.user.role,
      );
      return sendSuccess(req, res, ride);
    },

    async listMyRides(req, res) {
      const { page, limit } = req.validated.query;
      const result = await rideService.listRidesForUser(req.user.sub, req.user.role, {
        page,
        limit,
      });
      return sendSuccess(req, res, result.rides, {
        meta: {
          total: result.total,
          page: result.page,
          pages: result.pages,
          limit: result.limit,
        },
      });
    },
  };
}
