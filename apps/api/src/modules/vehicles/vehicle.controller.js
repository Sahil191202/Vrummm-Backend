import { sendSuccess } from '../../shared/respond.js';

export function createVehicleController({ vehicleService, captainService }) {
  return {
    async registerVehicle(req, res) {
      const captain = await captainService.getProfileByUserId(req.user.sub);
      const vehicle = await vehicleService.registerVehicle(
        req.user.sub,
        captain._id,
        req.validated.body,
      );
      return sendSuccess(req, res, vehicle, { status: 201 });
    },

    async getVehicle(req, res) {
      const captain = await captainService.getProfileByUserId(req.user.sub);
      const vehicle = await vehicleService.getVehicle(captain._id);
      return sendSuccess(req, res, vehicle);
    },

    async updateVehicle(req, res) {
      const captain = await captainService.getProfileByUserId(req.user.sub);
      const vehicle = await vehicleService.updateVehicle(captain._id, req.validated.body);
      return sendSuccess(req, res, vehicle);
    },
  };
}