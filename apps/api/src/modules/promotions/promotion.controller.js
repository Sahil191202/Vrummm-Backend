import { sendSuccess } from '../../shared/respond.js';
import { Customer } from '../customers/schemas/customer.schema.js';

export function createPromotionController({ promotionService }) {
  return {
    async createPromotion(req, res) {
      const promotion = await promotionService.createPromotion(req.validated.body, req.user.sub);
      return sendSuccess(req, res, promotion, { status: 201 });
    },

    async listPromotions(req, res) {
      const { page, limit, ...filter } = req.validated.query;
      const result = await promotionService.listPromotions(filter, { page, limit });
      return sendSuccess(req, res, result.promotions, { meta: result.pagination });
    },

    async getPromotion(req, res) {
      const promotion = await promotionService.getPromotionById(req.validated.params.promotionId);
      return sendSuccess(req, res, promotion);
    },

    async validateCode(req, res) {
      const { code, rideFarePaise, vehicleType } = req.validated.body;

      // Determine if it is the customer's first ride
      const customer = await Customer.findOne({ userId: req.user.sub });
      const isFirstRide = !customer || (customer.totalRides || 0) === 0;

      const result = await promotionService.validateAndCalculateDiscount({
        code,
        userId: req.user.sub,
        rideFarePaise,
        vehicleType,
        isFirstRide,
      });

      return sendSuccess(req, res, {
        code: result.promotion.code,
        discountType: result.promotion.discountType,
        discountValue: result.promotion.discountValue,
        discountPaise: result.discountPaise,
        originalFarePaise: rideFarePaise,
        finalFarePaise: result.finalFarePaise,
      });
    },
  };
}
