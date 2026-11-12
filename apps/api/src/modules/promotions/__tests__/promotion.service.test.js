import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPromotionService } from '../promotion.service.js';

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('../schemas/promotion.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const Promotion = {
    create: vi.fn(async (data) => {
      const id = String(++seq);
      const promo = { _id: id, currentRedemptions: 0, isActive: true, ...data };
      store.set(id, promo);
      return promo;
    }),
    findById: vi.fn(async (id) => store.get(String(id)) ?? null),
    findOne: vi.fn(async (filter = {}) => {
      for (const p of store.values()) {
        if (filter.code && p.code === filter.code) return { ...p };
      }
      return null;
    }),
    findOneAndUpdate: vi.fn(async (filter, update) => {
      const p = store.get(String(filter._id));
      if (!p || !p.isActive) return null;
      if (p.maxTotalRedemptions && p.currentRedemptions >= p.maxTotalRedemptions) {
        return null;
      }
      if (update.$inc?.currentRedemptions) {
        p.currentRedemptions += update.$inc.currentRedemptions;
      }
      return p;
    }),
    find: vi.fn(() => ({
      sort: () => ({ skip: () => ({ limit: () => Promise.resolve([...store.values()]) }) }),
    })),
    countDocuments: vi.fn(async () => store.size),
    _set(id, data) {
      store.set(String(id), { _id: String(id), currentRedemptions: 0, isActive: true, ...data });
    },
    _reset() {
      store.clear();
      seq = 0;
    },
  };
  return { Promotion };
});

vi.mock('../schemas/promotionRedemption.schema.js', () => {
  const store = [];
  const PromotionRedemption = {
    create: vi.fn(async ([data]) => {
      const r = { _id: String(store.length + 1), ...data };
      store.push(r);
      return [r];
    }),
    countDocuments: vi.fn(async ({ promotionId, userId } = {}) => {
      return store.filter(
        (r) => String(r.promotionId) === String(promotionId) && String(r.userId) === String(userId),
      ).length;
    }),
    _reset() {
      store.length = 0;
    },
  };
  return { PromotionRedemption };
});

const { Promotion } = await import('../schemas/promotion.schema.js');
const { PromotionRedemption } = await import('../schemas/promotionRedemption.schema.js');
const service = createPromotionService();

beforeEach(() => {
  Promotion._reset();
  PromotionRedemption._reset();
  vi.clearAllMocks();
});

describe('createPromotion', () => {
  it('creates a percentage promo code with max discount cap', async () => {
    const promo = await service.createPromotion(
      {
        code: 'VRUMM50',
        discountType: 'PERCENTAGE',
        discountValue: 50,
        maxDiscountPaise: 5000,
        expiresAt: new Date(Date.now() + 86400000),
      },
      'admin1',
    );

    expect(promo.code).toBe('VRUMM50');
    expect(promo.discountValue).toBe(50);
  });

  it('rejects duplicate promo codes with CONFLICT', async () => {
    Promotion._set('p1', { code: 'EXISTING' });
    await expect(
      service.createPromotion(
        {
          code: 'EXISTING',
          discountType: 'FLAT',
          discountValue: 2000,
          expiresAt: new Date(Date.now() + 86400000),
        },
        'admin1',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('validateAndCalculateDiscount', () => {
  it('applies percentage discount capped at maxDiscountPaise', async () => {
    Promotion._set('p2', {
      code: 'HALF50',
      discountType: 'PERCENTAGE',
      discountValue: 50,
      maxDiscountPaise: 3000, // max 30 Rs discount
      minRideFarePaise: 1000,
      allowedVehicleTypes: ['BIKE', 'AUTO', 'CAB'],
      expiresAt: new Date(Date.now() + 86400000),
    });

    // 50% of 10000 is 5000, but capped at 3000
    const result = await service.validateAndCalculateDiscount({
      code: 'HALF50',
      userId: 'u1',
      rideFarePaise: 10000,
      vehicleType: 'BIKE',
    });

    expect(result.discountPaise).toBe(3000);
    expect(result.finalFarePaise).toBe(7000);
  });

  it('applies flat discount accurately', async () => {
    Promotion._set('p3', {
      code: 'FLAT25',
      discountType: 'FLAT',
      discountValue: 2500, // Rs 25
      minRideFarePaise: 5000,
      expiresAt: new Date(Date.now() + 86400000),
    });

    const result = await service.validateAndCalculateDiscount({
      code: 'FLAT25',
      userId: 'u1',
      rideFarePaise: 6000,
      vehicleType: 'CAB',
    });

    expect(result.discountPaise).toBe(2500);
    expect(result.finalFarePaise).toBe(3500);
  });

  it('rejects expired promo code', async () => {
    Promotion._set('p4', {
      code: 'OLDPROMO',
      discountType: 'FLAT',
      discountValue: 1000,
      expiresAt: new Date(Date.now() - 10000),
    });

    await expect(
      service.validateAndCalculateDiscount({
        code: 'OLDPROMO',
        userId: 'u1',
        rideFarePaise: 5000,
        vehicleType: 'BIKE',
      }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
  });

  it('rejects first-ride only promo if user is not on first ride', async () => {
    Promotion._set('p5', {
      code: 'WELCOME100',
      discountType: 'FLAT',
      discountValue: 5000,
      firstRideOnly: true,
      expiresAt: new Date(Date.now() + 86400000),
    });

    await expect(
      service.validateAndCalculateDiscount({
        code: 'WELCOME100',
        userId: 'u1',
        rideFarePaise: 10000,
        vehicleType: 'BIKE',
        isFirstRide: false,
      }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
  });
});

describe('redeemPromotion', () => {
  it('atomically increments redemptions and records redemption', async () => {
    Promotion._set('p6', {
      maxTotalRedemptions: 10,
      currentRedemptions: 0,
    });

    const redemption = await service.redeemPromotion({
      promotionId: 'p6',
      userId: 'u1',
      rideId: 'r1',
      discountAppliedPaise: 2500,
    });

    expect(redemption.discountAppliedPaise).toBe(2500);
  });

  it('rejects redemption when maxTotalRedemptions is exhausted', async () => {
    Promotion._set('p7', {
      maxTotalRedemptions: 5,
      currentRedemptions: 5, // Exhausted
    });

    await expect(
      service.redeemPromotion({
        promotionId: 'p7',
        userId: 'u2',
        rideId: 'r2',
        discountAppliedPaise: 1000,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
