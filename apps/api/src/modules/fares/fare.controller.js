import { sendSuccess } from '../../shared/respond.js';
import { logAudit } from '../audit/audit.service.js';

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? fwd.split(',')[0].trim() : req.ip) ?? 'unknown';
}

export function createFareController({ fareService }) {
  return {
    // Public — no auth
    async getFareQuote(req, res) {
      const { vehicleType, zone, pickupLng, pickupLat, dropLng, dropLat } = req.validated.query;
      const quote = await fareService.getFareQuote({
        vehicleType,
        zone,
        pickupCoordinates: [pickupLng, pickupLat],
        dropCoordinates: [dropLng, dropLat],
      });
      return sendSuccess(req, res, quote);
    },

    // Admin
    async createFareConfig(req, res) {
      const { config, reason } = await fareService.createFareConfig(
        req.validated.body,
        req.user.sub,
      );
      await logAudit({
        actorId: req.user.sub,
        actorRole: req.user.role,
        action: 'fareConfig.create',
        targetType: 'FareConfig',
        targetId: config._id,
        requestId: req.id,
        reason,
        meta: { vehicleType: config.vehicleType, zone: config.zone, version: config.version },
        ipAddress: clientIp(req),
      });
      return sendSuccess(req, res, config, { status: 201 });
    },

    async listFareConfigs(req, res) {
      const { vehicleType, zone, page, limit } = req.validated.query;
      const result = await fareService.listFareConfigs({ vehicleType, zone, page, limit });
      return sendSuccess(req, res, result.configs, {
        meta: { total: result.total, page: result.page, pages: result.pages, limit: result.limit },
      });
    },

    async getFareConfig(req, res) {
      const config = await fareService.getFareConfig(req.validated.params.configId);
      return sendSuccess(req, res, config);
    },
  };
}