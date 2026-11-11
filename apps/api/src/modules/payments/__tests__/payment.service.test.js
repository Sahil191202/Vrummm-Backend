import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPaymentService } from '../payment.service.js';
import { MockPaymentProvider } from '../providers/MockPaymentProvider.js';

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('../schemas/payment.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const Payment = {
    create: vi.fn(async (data) => {
      const id = String(++seq);
      const p = { _id: id, status: 'PENDING', attempts: 1, ...data };
      store.set(id, p);
      return p;
    }),
    findById: vi.fn(async (id) => store.get(String(id)) ?? null),
    findOne: vi.fn(async (filter = {}) => {
      for (const p of store.values()) {
        if (filter._id && String(p._id) !== String(filter._id)) continue;
        if (filter.idempotencyKey && p.idempotencyKey !== filter.idempotencyKey) continue;
        if (filter.rideId && String(p.rideId) !== String(filter.rideId)) continue;
        if (filter.providerOrderId && p.providerOrderId !== filter.providerOrderId) continue;
        if (filter.status && p.status !== filter.status) continue;
        return { ...p };
      }
      return null;
    }),
    findOneAndUpdate: vi.fn(async (filter, update) => {
      const id = filter._id ? String(filter._id) : null;
      if (!id) return null;
      const p = store.get(id);
      if (!p) return null;
      if (filter.status && p.status !== filter.status) return null;
      if (update.$set) Object.assign(p, update.$set);
      store.set(id, p);
      return p;
    }),
    updateOne: vi.fn(async (filter, update) => {
      for (const p of store.values()) {
        const idMatch = !filter._id || String(p._id) === String(filter._id);
        const orderMatch = !filter.providerOrderId || p.providerOrderId === filter.providerOrderId;
        const statusMatch = !filter.status || p.status === filter.status;
        if (idMatch && orderMatch && statusMatch) {
          if (update.$set) Object.assign(p, update.$set);
          if (update.$inc?.attempts) p.attempts = (p.attempts || 1) + update.$inc.attempts;
        }
      }
    }),
    find: vi.fn(() => ({
      sort: () => ({ skip: () => ({ limit: () => Promise.resolve([...store.values()]) }) }),
    })),
    countDocuments: vi.fn(async () => store.size),
    _set(id, data) {
      store.set(String(id), { _id: String(id), status: 'PENDING', ...data });
    },
    _reset() {
      store.clear();
      seq = 0;
    },
  };
  return { Payment };
});

vi.mock('../schemas/webhookEvent.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const WebhookEvent = {
    findOne: vi.fn(async ({ eventId } = {}) => {
      for (const ev of store.values()) {
        if (ev.eventId === eventId) return { ...ev };
      }
      return null;
    }),
    create: vi.fn(async (data) => {
      const id = String(++seq);
      const ev = { _id: id, ...data };
      store.set(id, ev);
      return ev;
    }),
    updateOne: vi.fn(async (filter, update) => {
      const id = filter._id ? String(filter._id) : null;
      if (id && store.has(id)) {
        const ev = store.get(id);
        if (update.$set) Object.assign(ev, update.$set);
      }
    }),
    _reset() {
      store.clear();
      seq = 0;
    },
  };
  return { WebhookEvent };
});

vi.mock('../../rides/schemas/ride.schema.js', () => {
  const store = new Map();
  const Ride = {
    findById: vi.fn((id) => {
      const r = store.get(String(id)) ?? null;
      return {
        session: vi.fn(async () => r),
        then: (resolve, reject) => Promise.resolve(r).then(resolve, reject),
      };
    }),
    updateOne: vi.fn(async (filter, update) => {
      const id = filter._id ? String(filter._id) : null;
      if (id && store.has(id)) {
        const r = store.get(id);
        if (update.$set) Object.assign(r, update.$set);
      }
    }),
    _set(id, data) {
      store.set(String(id), { _id: String(id), ...data });
    },
    _reset() {
      store.clear();
    },
  };
  return { Ride };
});

vi.mock('../../captains/schemas/captain.schema.js', () => ({
  Captain: {
    updateOne: vi.fn(async () => {}),
  },
}));

vi.mock('../../socket/socket.service.js', () => ({
  emit: {
    toUser: vi.fn(async () => {}),
    toRide: vi.fn(async () => {}),
    toOps: vi.fn(async () => {}),
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

const { Payment } = await import('../schemas/payment.schema.js');
const { WebhookEvent } = await import('../schemas/webhookEvent.schema.js');
const { Ride } = await import('../../rides/schemas/ride.schema.js');

const mockProvider = new MockPaymentProvider();
const paymentProviderRegistry = {
  getProvider: () => mockProvider,
  mockProvider,
};

const revenuePlanService = {
  calculateRideCommission: vi.fn(async ({ totalPaise }) => ({
    commissionPaise: Math.round(totalPaise * 0.035),
    captainEarningsPaise: totalPaise - Math.round(totalPaise * 0.035),
    planSnapshot: { type: 'COMMISSION', commissionBps: 350 },
  })),
};

const ledgerService = {
  recordRideSettlement: vi.fn(async () => []),
  createAdjustment: vi.fn(async () => ({})),
};

const service = createPaymentService({
  paymentProviderRegistry,
  revenuePlanService,
  ledgerService,
});

beforeEach(() => {
  Payment._reset();
  WebhookEvent._reset();
  Ride._reset();
  vi.clearAllMocks();
});

describe('createPaymentOrder', () => {
  it('creates an order for a completed ride with authoritative server amount', async () => {
    Ride._set('r1', {
      customerUserId: 'cust1',
      captainUserId: 'capt1',
      bookingId: 'b1',
      status: 'COMPLETED',
      fareSnapshot: { totalPaise: 12500 },
    });

    const result = await service.createPaymentOrder({
      rideId: 'r1',
      customerUserId: 'cust1',
      providerName: 'MOCK',
    });

    expect(result.amountPaise).toBe(12500);
    expect(result.currency).toBe('INR');
    expect(result.providerOrderId).toMatch(/^mock_order_/);
    expect(result.keyId).toBe('mock_rzp_key_id');
  });

  it('rejects order creation if ride is not completed', async () => {
    Ride._set('r2', {
      customerUserId: 'cust1',
      status: 'IN_PROGRESS',
      fareSnapshot: { totalPaise: 10000 },
    });

    await expect(
      service.createPaymentOrder({ rideId: 'r2', customerUserId: 'cust1' }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
  });

  it('rejects payment attempt by a non-owner', async () => {
    Ride._set('r3', {
      customerUserId: 'cust1',
      status: 'COMPLETED',
      fareSnapshot: { totalPaise: 10000 },
    });

    await expect(
      service.createPaymentOrder({ rideId: 'r3', customerUserId: 'cust_intruder' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('verifyPayment', () => {
  it('captures payment, triggers ledger settlement, and calculates commission', async () => {
    Ride._set('r10', {
      captainId: 'c1',
      customerUserId: 'cust1',
      captainUserId: 'capt1',
      status: 'COMPLETED',
      fareSnapshot: { totalPaise: 10000 },
    });

    Payment._set('p10', {
      rideId: 'r10',
      customerUserId: 'cust1',
      captainUserId: 'capt1',
      amountPaise: 10000,
      provider: 'MOCK',
      providerOrderId: 'mock_order_123',
      status: 'PENDING',
    });

    const verified = await service.verifyPayment({
      paymentId: 'p10',
      customerUserId: 'cust1',
      providerPaymentId: 'mock_pay_999',
      providerSignature: 'mock_valid_signature',
    });

    expect(verified.status).toBe('CAPTURED');
    expect(ledgerService.recordRideSettlement).toHaveBeenCalledTimes(1);
    expect(revenuePlanService.calculateRideCommission).toHaveBeenCalledWith(
      expect.objectContaining({ totalPaise: 10000 }),
    );
  });

  it('rejects verification with invalid signature', async () => {
    Payment._set('p11', {
      rideId: 'r11',
      customerUserId: 'cust1',
      amountPaise: 10000,
      provider: 'MOCK',
      providerOrderId: 'mock_order_123',
      status: 'PENDING',
    });

    await expect(
      service.verifyPayment({
        paymentId: 'p11',
        customerUserId: 'cust1',
        providerPaymentId: 'mock_pay_999',
        providerSignature: 'wrong_tampered_signature',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('processWebhook', () => {
  it('processes payment.captured event and deduplicates eventId', async () => {
    Payment._set('p20', {
      rideId: 'r20',
      customerUserId: 'cust1',
      captainUserId: 'capt1',
      amountPaise: 5000,
      provider: 'MOCK',
      providerOrderId: 'order_webhook_1',
      status: 'PENDING',
    });

    Ride._set('r20', {
      captainId: 'c1',
      status: 'COMPLETED',
      fareSnapshot: { totalPaise: 5000 },
    });

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_hook_1',
            order_id: 'order_webhook_1',
          },
        },
      },
    };

    const rawBody = Buffer.from(JSON.stringify(payload));
    const result = await service.processWebhook({
      rawBody,
      signature: 'mock_valid_webhook_signature',
      eventId: 'evt_unique_1',
      providerName: 'MOCK',
    });

    expect(result.received).toBe(true);

    // Call again with the exact same eventId: must return duplicate and not re-process
    const duplicateCall = await service.processWebhook({
      rawBody,
      signature: 'mock_valid_webhook_signature',
      eventId: 'evt_unique_1',
      providerName: 'MOCK',
    });

    expect(duplicateCall.duplicate).toBe(true);
  });

  it('rejects webhook with invalid signature', async () => {
    const rawBody = Buffer.from(JSON.stringify({ event: 'order.paid' }));
    await expect(
      service.processWebhook({
        rawBody,
        signature: 'invalid_sig',
        eventId: 'evt_fail_1',
        providerName: 'MOCK',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('simulateRefund', () => {
  it('transitions payment to REFUNDED_SIMULATED and posts ledger adjustment', async () => {
    Payment._set('p30', {
      rideId: 'r30',
      customerUserId: 'cust1',
      captainUserId: 'capt1',
      amountPaise: 7500,
      status: 'CAPTURED',
    });

    const refund = await service.simulateRefund({
      paymentId: 'p30',
      reason: 'Driver did not arrive and passenger had to take another vehicle',
      actorUserId: 'admin1',
    });

    expect(refund.status).toBe('REFUNDED_SIMULATED');
    expect(refund.refundSimulatedReason).toMatch(/Driver did not arrive/);
    expect(ledgerService.createAdjustment).toHaveBeenCalledTimes(2); // Customer credit + Platform debit
  });

  it('rejects refund if payment was not captured', async () => {
    Payment._set('p31', {
      rideId: 'r31',
      status: 'PENDING',
    });

    await expect(
      service.simulateRefund({
        paymentId: 'p31',
        reason: 'Random refund request',
        actorUserId: 'admin1',
      }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
  });
});
