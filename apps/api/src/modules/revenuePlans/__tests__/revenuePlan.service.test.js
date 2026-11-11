import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRevenuePlanService } from '../revenuePlan.service.js';

vi.mock('../schemas/revenuePlan.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const RevenuePlan = {
    create: vi.fn(async (data) => {
      const id = String(++seq);
      const plan = { _id: id, isActive: true, ...data };
      store.set(id, plan);
      return plan;
    }),
    find: vi.fn(async (query = {}) => {
      let items = [...store.values()];
      if (query.type) items = items.filter((p) => p.type === query.type);
      if (typeof query.isActive === 'boolean')
        items = items.filter((p) => p.isActive === query.isActive);
      return { sort: vi.fn(async () => items) };
    }),
    findById: vi.fn((id) => {
      const plan = store.get(String(id)) ?? null;
      return {
        session: vi.fn(async () => plan),
        then: (resolve, reject) => Promise.resolve(plan).then(resolve, reject),
      };
    }),
    findByIdAndUpdate: vi.fn(async (id, update) => {
      const plan = store.get(String(id));
      if (!plan) return null;
      if (update.$set) Object.assign(plan, update.$set);
      store.set(String(id), plan);
      return plan;
    }),
    _reset() {
      store.clear();
      seq = 0;
    },
  };
  return { RevenuePlan };
});

vi.mock('../schemas/captainPlanAssignment.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const CaptainPlanAssignment = {
    create: vi.fn(async ([data]) => {
      const id = String(++seq);
      const a = { _id: id, ...data };
      store.set(id, a);
      return [a];
    }),
    updateMany: vi.fn(async (filter, update) => {
      for (const a of store.values()) {
        if (
          String(a.captainId) === String(filter.captainId) &&
          (!filter.status || a.status === filter.status)
        ) {
          if (update.$set) Object.assign(a, update.$set);
        }
      }
    }),
    findOne: vi.fn((filter = {}) => ({
      sort: vi.fn(async () => {
        const matches = [...store.values()].filter((a) => {
          if (String(a.captainId) !== String(filter.captainId)) return false;
          if (filter.status && a.status !== filter.status) return false;
          return true;
        });
        return matches[matches.length - 1] ?? null;
      }),
    })),
    find: vi.fn((filter = {}) => ({
      sort: vi.fn(async () =>
        [...store.values()].filter((a) => String(a.captainId) === String(filter.captainId)),
      ),
    })),
    _reset() {
      store.clear();
      seq = 0;
    },
  };
  return { CaptainPlanAssignment };
});

vi.mock('../../captains/schemas/captain.schema.js', () => ({
  Captain: {
    updateOne: vi.fn(async () => {}),
  },
}));

const { RevenuePlan } = await import('../schemas/revenuePlan.schema.js');
const { CaptainPlanAssignment } = await import('../schemas/captainPlanAssignment.schema.js');

const service = createRevenuePlanService();

beforeEach(() => {
  RevenuePlan._reset();
  CaptainPlanAssignment._reset();
  vi.clearAllMocks();
});

describe('createPlan', () => {
  it('creates a commission plan with 300 to 350 bps', async () => {
    const plan = await service.createPlan(
      {
        name: 'Standard Commission',
        type: 'COMMISSION',
        commissionBps: 325,
      },
      'admin1',
    );
    expect(plan.commissionBps).toBe(325);
    expect(plan.type).toBe('COMMISSION');
    expect(plan.isActive).toBe(true);
  });

  it('creates a subscription plan', async () => {
    const plan = await service.createPlan(
      {
        name: 'Daily Pass',
        type: 'SUBSCRIPTION',
        subscriptionPricePaise: 15000,
        subscriptionBillingPeriod: 'DAILY',
      },
      'admin1',
    );
    expect(plan.type).toBe('SUBSCRIPTION');
    expect(plan.subscriptionPricePaise).toBe(15000);
  });
});

describe('selectCaptainPlan & getActiveCaptainPlan', () => {
  it('assigns plan and supersedes previous active plan', async () => {
    const plan1 = await service.createPlan(
      { name: 'Plan A', type: 'COMMISSION', commissionBps: 300 },
      'admin1',
    );
    const plan2 = await service.createPlan(
      { name: 'Plan B', type: 'COMMISSION', commissionBps: 350 },
      'admin1',
    );

    const a1 = await service.selectCaptainPlan('c1', plan1._id);
    expect(a1.status).toBe('ACTIVE');

    const a2 = await service.selectCaptainPlan('c1', plan2._id);
    expect(a2.status).toBe('ACTIVE');
    expect(a2.planSnapshot.commissionBps).toBe(350);

    const active = await service.getActiveCaptainPlan('c1');
    expect(active.commissionBps).toBe(350);
  });

  it('falls back to default commission when captain has no plan assigned', async () => {
    const active = await service.getActiveCaptainPlan('c-new');
    expect(active.isDefault).toBe(true);
    expect(active.type).toBe('COMMISSION');
    expect(active.commissionBps).toBe(300);
  });
});

describe('calculateRideCommission', () => {
  it('calculates commission in integer paise for COMMISSION plan', async () => {
    const plan = await service.createPlan(
      { name: 'Comm 3.5%', type: 'COMMISSION', commissionBps: 350 },
      'admin1',
    );
    await service.selectCaptainPlan('c1', plan._id);

    // Ride fare 10000 paise (Rs. 100). 3.5% = 350 paise. Captain earns 9650 paise.
    const result = await service.calculateRideCommission({
      totalPaise: 10000,
      captainId: 'c1',
    });
    expect(result.commissionPaise).toBe(350);
    expect(result.captainEarningsPaise).toBe(9650);
    expect(Number.isInteger(result.commissionPaise)).toBe(true);
    expect(Number.isInteger(result.captainEarningsPaise)).toBe(true);
  });

  it('applies 0 commission for SUBSCRIPTION plan', async () => {
    const plan = await service.createPlan(
      {
        name: 'Unlimited',
        type: 'SUBSCRIPTION',
        subscriptionPricePaise: 50000,
      },
      'admin1',
    );
    await service.selectCaptainPlan('c2', plan._id);

    const result = await service.calculateRideCommission({
      totalPaise: 10000,
      captainId: 'c2',
    });
    expect(result.commissionPaise).toBe(0);
    expect(result.captainEarningsPaise).toBe(10000);
  });
});
