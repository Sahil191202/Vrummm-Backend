import { Promotion } from './schemas/promotion.schema.js';
import { PromotionRedemption } from './schemas/promotionRedemption.schema.js';
import { errors } from '../../shared/AppError.js';

export function createPromotionService() {
  async function createPromotion(data, actorUserId) {
    const existing = await Promotion.findOne({ code: data.code });
    if (existing) {
      throw errors.conflict(`Promotion code '${data.code}' already exists`);
    }

    const promotion = await Promotion.create({
      ...data,
      createdBy: actorUserId,
    });
    return promotion;
  }

  async function listPromotions(filter = {}, { page = 1, limit = 20 } = {}) {
    const query = {};
    if (typeof filter.isActive === 'boolean') query.isActive = filter.isActive;

    const skip = (page - 1) * limit;
    const [promotions, total] = await Promise.all([
      Promotion.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Promotion.countDocuments(query),
    ]);

    return {
      promotions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async function getPromotionById(promotionId) {
    const promotion = await Promotion.findById(promotionId);
    if (!promotion) throw errors.notFound('Promotion not found');
    return promotion;
  }

  async function validateAndCalculateDiscount({
    code,
    userId,
    rideFarePaise,
    vehicleType,
    isFirstRide = false,
  }) {
    const promotion = await Promotion.findOne({ code: code.toUpperCase() });
    if (!promotion || !promotion.isActive) {
      throw errors.notFound('Invalid or inactive promotion code');
    }

    const now = new Date();
    if (promotion.startsAt && now < promotion.startsAt) {
      throw errors.businessRule('Promotion is not yet active');
    }
    if (now > promotion.expiresAt) {
      throw errors.businessRule('Promotion code has expired');
    }

    if (
      promotion.allowedVehicleTypes &&
      promotion.allowedVehicleTypes.length > 0 &&
      !promotion.allowedVehicleTypes.includes(vehicleType)
    ) {
      throw errors.businessRule(
        `Promotion is only valid for vehicle types: ${promotion.allowedVehicleTypes.join(', ')}`,
      );
    }

    if (rideFarePaise < promotion.minRideFarePaise) {
      throw errors.businessRule(
        `Minimum ride fare of ₹${promotion.minRideFarePaise / 100} required to use this promo`,
      );
    }

    if (promotion.firstRideOnly && !isFirstRide) {
      throw errors.businessRule('Promotion is only valid on your first ride');
    }

    if (
      promotion.maxTotalRedemptions &&
      promotion.currentRedemptions >= promotion.maxTotalRedemptions
    ) {
      throw errors.businessRule('Promotion usage limit reached');
    }

    // Check per-user redemption limit
    const userRedemptions = await PromotionRedemption.countDocuments({
      promotionId: promotion._id,
      userId,
    });
    if (userRedemptions >= promotion.maxPerUserRedemptions) {
      throw errors.businessRule('You have reached the maximum redemptions for this promotion');
    }

    // Calculate discount
    let discountPaise = 0;
    if (promotion.discountType === 'PERCENTAGE') {
      discountPaise = Math.round((rideFarePaise * promotion.discountValue) / 100);
      if (promotion.maxDiscountPaise) {
        discountPaise = Math.min(discountPaise, promotion.maxDiscountPaise);
      }
    } else if (promotion.discountType === 'FLAT') {
      discountPaise = Math.min(rideFarePaise, promotion.discountValue);
    }

    const finalFarePaise = Math.max(0, rideFarePaise - discountPaise);

    return {
      promotion,
      discountPaise,
      finalFarePaise,
    };
  }

  async function redeemPromotion(
    { promotionId, userId, rideId, discountAppliedPaise },
    session = null,
  ) {
    // Atomically increment redemption count ensuring max limit is respected
    const promo = await Promotion.findOneAndUpdate(
      {
        _id: promotionId,
        isActive: true,
        $or: [
          { maxTotalRedemptions: { $exists: false } },
          { maxTotalRedemptions: null },
          { $expr: { $lt: ['$currentRedemptions', '$maxTotalRedemptions'] } },
        ],
      },
      { $inc: { currentRedemptions: 1 } },
      { new: true, session },
    );

    if (!promo) {
      throw errors.conflict('Promotion redemption limit has been exhausted or promo is inactive');
    }

    const [redemption] = await PromotionRedemption.create(
      [
        {
          promotionId,
          userId,
          rideId,
          discountAppliedPaise,
        },
      ],
      { session },
    );

    return redemption;
  }

  return {
    createPromotion,
    listPromotions,
    getPromotionById,
    validateAndCalculateDiscount,
    redeemPromotion,
  };
}
