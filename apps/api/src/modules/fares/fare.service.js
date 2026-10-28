import { FareConfig } from './schemas/fareConfig.schema.js';
import { calculateFare, routeDistanceMetres } from './fare.calculator.js';
import { errors } from '../../shared/AppError.js';

export function createFareService() {
  // Get the currently active config for a vehicle type and zone.
  async function getActiveConfig(vehicleType, zone = 'mumbai') {
    const config = await FareConfig.findOne({ vehicleType, zone, isActive: true })
      .sort({ effectiveFrom: -1 });
    if (!config) {
      throw errors.notFound(
        `No active fare config found for ${vehicleType} in zone ${zone}`,
      );
    }
    return config;
  }

  // Public fare quote — no auth required.
  async function getFareQuote({ vehicleType, zone, pickupCoordinates, dropCoordinates }) {
    const config = await getActiveConfig(vehicleType, zone);
    const distanceMetres = routeDistanceMetres(pickupCoordinates, dropCoordinates);
    const result = calculateFare({ config, distanceMetres });
    return {
      vehicleType,
      zone,
      distanceMetres: Math.round(distanceMetres),
      ...result,
      // Note: this is a haversine (straight-line) estimate.
      // Actual route distance will differ. Config version is pinned for audit.
      distanceMethod: 'haversine',
    };
  }

  // Admin: create a new fare config version. The current active one is closed.
  async function createFareConfig(data, adminUserId) {
    const { vehicleType, zone = 'mumbai', effectiveFrom, reason, ...fareFields } = data;

    // Close the current active config.
    const current = await FareConfig.findOne({ vehicleType, zone, isActive: true })
      .sort({ effectiveFrom: -1 });

    const nextVersion = current ? current.version + 1 : 1;

    if (current) {
      await FareConfig.updateOne(
        { _id: current._id },
        { $set: { isActive: false, effectiveTo: new Date(effectiveFrom) } },
      );
    }

    const config = await FareConfig.create({
      vehicleType,
      zone,
      effectiveFrom: new Date(effectiveFrom),
      version: nextVersion,
      createdBy: adminUserId,
      ...fareFields,
    });

    return { config, reason };
  }

  // Admin: list all configs (for preview and history).
  async function listFareConfigs({ vehicleType, zone, page = 1, limit = 20 } = {}) {
    const filter = {};
    if (vehicleType) filter.vehicleType = vehicleType;
    if (zone) filter.zone = zone;
    const total = await FareConfig.countDocuments(filter);
    const configs = await FareConfig.find(filter)
      .sort({ vehicleType: 1, effectiveFrom: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    return { configs, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async function getFareConfig(configId) {
    const config = await FareConfig.findById(configId);
    if (!config) throw errors.notFound('Fare config not found');
    return config;
  }

  return { getActiveConfig, getFareQuote, createFareConfig, listFareConfigs, getFareConfig };
}