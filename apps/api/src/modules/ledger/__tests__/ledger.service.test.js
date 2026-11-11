import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLedgerService } from '../ledger.service.js';

vi.mock('../schemas/ledgerEntry.schema.js', () => {
  const store = [];
  const idempotencyIndex = new Set();

  const LedgerEntry = {
    create: vi.fn(async ([data]) => {
      if (data.idempotencyKey) {
        if (idempotencyIndex.has(data.idempotencyKey)) {
          const err = new Error('Duplicate key');
          err.code = 11000;
          throw err;
        }
        idempotencyIndex.add(data.idempotencyKey);
      }
      const entry = { _id: String(store.length + 1), createdAt: new Date(), ...data };
      store.push(entry);
      return [entry];
    }),
    find: vi.fn((filter = {}) => {
      let results = [...store];
      if (filter.accountUserId) {
        results = results.filter((e) => String(e.accountUserId) === String(filter.accountUserId));
      }
      if (filter.accountType) {
        results = results.filter((e) => e.accountType === filter.accountType);
      }
      return {
        sort: () => ({
          skip: (s) => ({
            limit: (l) => Promise.resolve(results.slice(s, s + l)),
          }),
        }),
        then: (resolve, reject) => Promise.resolve(results).then(resolve, reject),
      };
    }),
    countDocuments: vi.fn(async () => store.length),
    _reset() {
      store.length = 0;
      idempotencyIndex.clear();
    },
  };

  return { LedgerEntry };
});

const { LedgerEntry } = await import('../schemas/ledgerEntry.schema.js');
const service = createLedgerService();

beforeEach(() => {
  LedgerEntry._reset();
  vi.clearAllMocks();
});

describe('recordRideSettlement', () => {
  it('creates balanced ledger entries for a completed ride', async () => {
    // Total fare 10,000 paise (Rs. 100), Commission 350 paise, Captain 9,650 paise
    const entries = await service.recordRideSettlement({
      rideId: 'ride1',
      paymentId: 'pay1',
      customerUserId: 'cust1',
      captainUserId: 'capt1',
      totalFarePaise: 10000,
      commissionPaise: 350,
      captainEarningsPaise: 9650,
      actorUserId: 'admin1',
    });

    expect(entries).toHaveLength(4);

    const customerDebit = entries.find(
      (e) => e.accountType === 'CUSTOMER' && e.direction === 'DEBIT',
    );
    expect(customerDebit.amountPaise).toBe(10000);

    const platformFare = entries.find(
      (e) => e.accountType === 'PLATFORM' && e.entryType === 'FARE_COLLECTED',
    );
    expect(platformFare.amountPaise).toBe(10000);

    const captainCredit = entries.find((e) => e.accountType === 'CAPTAIN');
    expect(captainCredit.amountPaise).toBe(9650);

    const platformCommission = entries.find(
      (e) => e.accountType === 'PLATFORM' && e.entryType === 'COMMISSION_EARNED',
    );
    expect(platformCommission.amountPaise).toBe(350);
  });

  it('rejects unbalanced settlement (accounting integrity check)', async () => {
    await expect(
      service.recordRideSettlement({
        rideId: 'ride1',
        paymentId: 'pay1',
        customerUserId: 'cust1',
        captainUserId: 'capt1',
        totalFarePaise: 10000,
        commissionPaise: 300,
        captainEarningsPaise: 9000, // 300 + 9000 = 9300 != 10000
        actorUserId: 'admin1',
      }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
  });

  it('is idempotent on duplicate calls with same paymentId', async () => {
    await service.recordRideSettlement({
      rideId: 'ride1',
      paymentId: 'pay_dup',
      customerUserId: 'cust1',
      captainUserId: 'capt1',
      totalFarePaise: 5000,
      commissionPaise: 175,
      captainEarningsPaise: 4825,
      actorUserId: 'admin1',
    });

    // Calling second time with same paymentId returns empty/already-processed without throwing duplicate error
    const secondCall = await service.recordRideSettlement({
      rideId: 'ride1',
      paymentId: 'pay_dup',
      customerUserId: 'cust1',
      captainUserId: 'capt1',
      totalFarePaise: 5000,
      commissionPaise: 175,
      captainEarningsPaise: 4825,
      actorUserId: 'admin1',
    });
    expect(secondCall).toHaveLength(0);
  });
});

describe('createAdjustment', () => {
  it('creates an adjustment with required audit reason', async () => {
    const entry = await service.createAdjustment({
      accountUserId: 'cust1',
      accountType: 'CUSTOMER',
      direction: 'CREDIT',
      amountPaise: 500,
      reason: 'Customer goodwill refund for delayed dispatch',
      description: 'Goodwill adjustment',
      actorUserId: 'admin1',
    });

    expect(entry.entryType).toBe('ADJUSTMENT');
    expect(entry.amountPaise).toBe(500);
    expect(entry.auditReason).toMatch(/goodwill/);
  });

  it('fails if audit reason is missing or too short', async () => {
    await expect(
      service.createAdjustment({
        accountUserId: 'cust1',
        accountType: 'CUSTOMER',
        direction: 'CREDIT',
        amountPaise: 500,
        reason: 'no',
        description: 'Adj',
        actorUserId: 'admin1',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('recordSimulatedPayout & getAccountBalance', () => {
  it('records payout when captain has sufficient earnings', async () => {
    // Settle a ride first to credit earnings to capt1
    await service.recordRideSettlement({
      rideId: 'ride1',
      paymentId: 'pay_earning',
      customerUserId: 'cust1',
      captainUserId: 'capt1',
      totalFarePaise: 10000,
      commissionPaise: 350,
      captainEarningsPaise: 9650,
      actorUserId: 'admin1',
    });

    const balanceBefore = await service.getAccountBalance('capt1', 'CAPTAIN');
    expect(balanceBefore).toBe(9650);

    const payout = await service.recordSimulatedPayout({
      captainUserId: 'capt1',
      amountPaise: 5000,
      actorUserId: 'capt1',
    });
    expect(payout.amountPaise).toBe(5000);
    expect(payout.direction).toBe('DEBIT');

    const balanceAfter = await service.getAccountBalance('capt1', 'CAPTAIN');
    expect(balanceAfter).toBe(4650);
  });

  it('rejects simulated payout when balance is insufficient', async () => {
    await expect(
      service.recordSimulatedPayout({
        captainUserId: 'capt_broke',
        amountPaise: 5000,
        actorUserId: 'capt_broke',
      }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
  });
});
