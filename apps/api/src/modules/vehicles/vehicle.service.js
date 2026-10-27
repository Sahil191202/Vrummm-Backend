import { Vehicle } from './schemas/vehicle.schema.js';
import { Captain } from '../captains/schemas/captain.schema.js';
import { errors } from '../../shared/AppError.js';

export function createVehicleService() {
  async function registerVehicle(userId, captainId, data) {
    const existing = await Vehicle.findOne({ captainId });
    if (existing) {
      throw errors.conflict(
        'A vehicle is already registered for this captain. Update the existing one.',
      );
    }

    const vehicle = await Vehicle.create({ ...data, captainId, userId });

    // Mirror the vehicle type on the captain profile.
    await Captain.updateOne({ _id: captainId }, { $set: { vehicleType: data.type } });

    return vehicle;
  }

  async function getVehicle(captainId) {
    const vehicle = await Vehicle.findOne({ captainId });
    if (!vehicle) throw errors.notFound('No vehicle registered for this captain');
    return vehicle;
  }

  async function updateVehicle(captainId, data) {
    const vehicle = await Vehicle.findOneAndUpdate(
      { captainId },
      { $set: data },
      { new: true, runValidators: true },
    );
    if (!vehicle) throw errors.notFound('No vehicle registered for this captain');

    if (data.type) {
      await Captain.updateOne({ _id: captainId }, { $set: { vehicleType: data.type } });
    }

    return vehicle;
  }

  return { registerVehicle, getVehicle, updateVehicle };
}