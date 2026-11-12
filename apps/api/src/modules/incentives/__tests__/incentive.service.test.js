import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createIncentiveService } from '../incentive.service.js';

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('../schemas/incentiveCampaign.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const IncentiveCampaign = {
    create: vi.fn(async (data) => {
      const id = String(++seq);
      const camp = { _id: id, isActive: true, ...data };
      store.set(id, camp);
      return camp;
    }),
    findById: vi.fn(async (id) => store.get(String(id)) ?? null),
    find: vi.fn(() => ({
      sort: () => ({ skip: () => ({ limit: () => Promise.resolve([...store.values()]) }) }),
    })),
    countDocuments: vi.fn(async () => store.size),
    _set(id, data) {
      store.set(String(id), { _id: String(id), isActive: true, ...data });
    },
    _reset() {
      store.clear();
      seq = 0;
    },
  };
  return { IncentiveCampaign };
});

vi.mock('../schemas/incentiveAward.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const IncentiveAward = {
    create: vi.fn(async ([data]) => {
      const id = String(++seq);
      const award = { _id: id, awardedAt: new Date(), ...data };
      store.set(id, award);
      return [award];
    }),
    findOne: vi.fn(async (filter = {}) => {
      for (const a of store.values()) {
        if (filter.idempotencyKey && a.idempotencyKey === filter.idempotencyKey) {
          return { ...a };
        }
      }
      return null;
    }),
    find: vi.fn((filter = {}) => ({
      sort: () =>
        Promise.resolve(
          [...store.values()].filter(
            (a) => !filter.captainId || String(a.captainId) === String(filter.captainId),
          ),
        ),
    })),
    _reset() {
      store.clear();
      seq = 0;
    },
  };
  return { IncentiveAward };
});

vi.mock('../../captains/schemas/captain.schema.js', () => ({
  Captain: {
    updateOne: vi.fn(async () => {}),
  },
}));

vi.mock('mongoose', async (importOriginal) => {
  const actual = await importOriginal();
  const session = {
    withTransaction: vi.fn(async (fn) => fn()),
    endSession: vi.fn(async () => {}),
  };
  return { ...actual, default: { ...actual.default, startSession: vi.fn(async () => session) } };
});

const { IncentiveCampaign } = await import('../schemas/incentiveCampaign.schema.js');
const { IncentiveAward } = await import('../schemas/incentiveAward.schema.js');

const ledgerService = {
  createAdjustment: vi.fn(async () => ({})),
};

const service = createIncentiveService({ ledgerService });

beforeEach(() => {
  IncentiveCampaign._reset();
  IncentiveAward._reset();
  vi.clearAllMocks();
});

describe('createCampaign', () => {
  it('creates an incentive campaign with target count and reward', async () => {
    const campaign = await service.createCampaign(
      {
        name: 'Daily 10 Rides Bonus',
        targetType: 'DAILY_RIDES',
        targetCount: 10,
        rewardAmountPaise: 5000,
        expiresAt: new Date(Date.now() + 86400000 * 7),
      },
      'admin1',
    );

    expect(campaign.name).toBe('Daily 10 Rides Bonus');
    expect(campaign.targetCount).toBe(10);
    expect(campaign.rewardAmountPaise).toBe(5000);
  });
});

describe('checkAndAwardIncentive', () => {
  it('awards bonus and posts to ledger when target is achieved', async () => {
    IncentiveCampaign._set('c1', {
      name: 'Weekend Hero',
      targetCount: 5,
      rewardAmountPaise: 2500,
      expiresAt: new Date(Date.now() + 86400000),
    });

    const result = await service.checkAndAwardIncentive({
      campaignId: 'c1',
      captainId: 'capt1',
      captainUserId: 'u_capt1',
      periodKey: '2026-11-12',
      progressCount: 5,
      actorUserId: 'admin1',
    });

    expect(result.awarded).toBe(true);
    expect(result.alreadyAwarded).toBe(false);
    expect(result.award.rewardAmountPaise).toBe(2500);
    expect(ledgerService.createAdjustment).toHaveBeenCalledTimes(1);
  });

  it('does not award if progress count is less than target', async () => {
    IncentiveCampaign._set('c2', {
      targetCount: 10,
      rewardAmountPaise: 5000,
      expiresAt: new Date(Date.now() + 86400000),
    });

    const result = await service.checkAndAwardIncentive({
      campaignId: 'c2',
      captainId: 'capt1',
      captainUserId: 'u_capt1',
      periodKey: '2026-11-12',
      progressCount: 7, // 7 < 10
      actorUserId: 'admin1',
    });

    expect(result.awarded).toBe(false);
    expect(result.progressCount).toBe(7);
  });

  it('is strictly idempotent and prevents double-crediting for the same periodKey', async () => {
    IncentiveCampaign._set('c3', {
      name: 'Daily Target',
      targetCount: 3,
      rewardAmountPaise: 1000,
      expiresAt: new Date(Date.now() + 86400000),
    });

    // First attempt: awarded
    const first = await service.checkAndAwardIncentive({
      campaignId: 'c3',
      captainId: 'capt1',
      captainUserId: 'u_capt1',
      periodKey: '2026-11-12',
      progressCount: 3,
      actorUserId: 'admin1',
    });
    expect(first.awarded).toBe(true);
    expect(first.alreadyAwarded).toBe(false);

    // Second attempt with same periodKey: idempotently returns existing award
    const second = await service.checkAndAwardIncentive({
      campaignId: 'c3',
      captainId: 'capt1',
      captainUserId: 'u_capt1',
      periodKey: '2026-11-12',
      progressCount: 4,
      actorUserId: 'admin1',
    });
    expect(second.awarded).toBe(true);
    expect(second.alreadyAwarded).toBe(true);
    expect(ledgerService.createAdjustment).toHaveBeenCalledTimes(1); // not called again
  });
});
