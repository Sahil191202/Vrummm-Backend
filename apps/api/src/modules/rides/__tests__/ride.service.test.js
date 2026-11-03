import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRideService } from '../ride.service.js';

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('../schemas/ride.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const Ride = {
    findOne: vi.fn(async (filter = {}) => {
      for (const r of store.values()) {
        const idMatch = !filter._id || String(r._id) === String(filter._id);
        const captainMatch =
          !filter.captainUserId ||
          String(r.captainUserId) === String(filter.captainUserId);
        const customerMatch =
          !filter.customerUserId ||
          String(r.customerUserId) === String(filter.customerUserId);
        const statusMatch = !filter.status || r.status === filter.status;
        if (idMatch && captainMatch && customerMatch && statusMatch) return { ...r };
      }
      return null;
    }),
    findById: vi.fn(async (id) => store.get(String(id)) ?? null),
    create: vi.fn(async ([data]) => {
      const id = String(++seq);
      const r = {
        _id: id,
        status: 'ACCEPTED',
        pinAttempts: 0,
        locationFlagged: false,
        ...data,
      };
      store.set(id, r);
      return [r];
    }),
    findOneAndUpdate: vi.fn(async (filter, update) => {
      const id = filter._id ? String(filter._id) : null;
      if (!id) return null;
      const r = store.get(id);
      if (!r) return null;
      const statusCond = filter.status;
      if (statusCond) {
        const ok = statusCond.$in
          ? statusCond.$in.includes(r.status)
          : r.status === statusCond;
        if (!ok) return null;
      }
      if (update.$set) Object.assign(r, update.$set);
      store.set(id, r);
      return r;
    }),
    updateOne: vi.fn(async (filter, update) => {
      const id = filter._id ? String(filter._id) : null;
      if (!id) return;
      const r = store.get(id);
      if (r && update.$set) {
        Object.assign(r, update.$set);
        store.set(id, r);
      }
    }),
    countDocuments: vi.fn(async () => 0),
    find: vi.fn(() => ({
      sort: () => ({ skip: () => ({ limit: () => Promise.resolve([]) }) }),
    })),
    _set(id, data) {
      store.set(String(id), {
        _id: String(id),
        pinAttempts: 0,
        locationFlagged: false,
        ...data,
      });
    },
    _reset() {
      store.clear();
      seq = 0;
    },
  };
  return { Ride };
});

vi.mock('../schemas/rideLocationSample.schema.js', () => {
  const store = [];
  const RideLocationSample = {
    findOne: vi.fn(() => ({
      sort: vi.fn(async () => store[store.length - 1] ?? null),
    })),
    find: vi.fn(() => ({
      sort: vi.fn(async () => [...store]),
    })),
    create: vi.fn(async (data) => {
      const s = { _id: String(store.length + 1), ...data };
      store.push(s);
      return s;
    }),
    _reset() {
      store.length = 0;
    },
  };
  return { RideLocationSample };
});

vi.mock('../../bookings/schemas/booking.schema.js', () => ({
  Booking: {
    findById: vi.fn((id) => ({
      session: () =>
        Promise.resolve({
          _id: id,
          userId: 'customer-u1',
          customerId: 'cust1',
          vehicleType: 'BIKE',
          fareSnapshot: { totalPaise: 8500 },
          pickup: {
            address: 'A',
            location: { coordinates: [72.8777, 19.076] },
          },
          drop: {
            address: 'B',
            location: { coordinates: [72.8347, 19.0176] },
          },
        }),
    })),
    updateOne: vi.fn(async () => {}),
  },
}));

vi.mock('../../captains/schemas/captain.schema.js', () => ({
  Captain: { updateOne: vi.fn(async () => {}) },
}));

vi.mock('../../socket/socket.service.js', () => ({
  emit: {
    toUser: vi.fn(async () => {}),
    toRide: vi.fn(async () => {}),
    toOps: vi.fn(async () => {}),
  },
  emitToRoom: vi.fn(async () => {}),
}));

vi.mock('bcrypt', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual };
});

import bcrypt from 'bcrypt';

const { Ride } = await import('../schemas/ride.schema.js');
const { RideLocationSample } = await import('../schemas/rideLocationSample.schema.js');

const service = createRideService({ io: null });

beforeEach(() => {
  Ride._reset();
  RideLocationSample._reset();
  vi.clearAllMocks();
  // Re-assert after clearAllMocks so PIN tests always get consistent behaviour.
  vi.spyOn(bcrypt, 'hash').mockImplementation(async (val) => `hashed:${val}`);
  vi.spyOn(bcrypt, 'compare').mockImplementation(
    async (plain, hash) => hash === `hashed:${plain}`,
  );
});

// ── captainArrived ─────────────────────────────────────────────────────────────
describe('captainArrived', () => {
  it('transitions ride from ACCEPTED to ARRIVED', async () => {
    Ride._set('r1', {
      status: 'ACCEPTED',
      captainUserId: 'cap-u1',
      customerUserId: 'cust-u1',
    });
    const ride = await service.captainArrived('r1', 'cap-u1');
    expect(ride.status).toBe('ARRIVED');
    expect(ride.arrivedAt).toBeInstanceOf(Date);
  });

  it('throws NOT_FOUND when captain does not own the ride', async () => {
    await expect(service.captainArrived('r-none', 'wrong')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('throws BUSINESS_RULE_VIOLATION when ride is not ACCEPTED', async () => {
    Ride._set('r2', {
      status: 'ARRIVED',
      captainUserId: 'cap-u1',
      customerUserId: 'cust-u1',
    });
    await expect(service.captainArrived('r2', 'cap-u1')).rejects.toMatchObject({
      code: 'BUSINESS_RULE_VIOLATION',
    });
  });
});

// ── verifyPinAndStart ──────────────────────────────────────────────────────────
describe('verifyPinAndStart', () => {
  it('starts the ride when the correct PIN is submitted', async () => {
    Ride._set('p1', {
      status: 'ARRIVED',
      customerUserId: 'cust-u1',
      captainUserId: 'cap-u1',
      tripPinHash: 'hashed:1234',
      pinAttempts: 0,
      pinLockedUntil: null,
    });
    const ride = await service.verifyPinAndStart('p1', 'cust-u1', '1234');
    expect(ride.status).toBe('IN_PROGRESS');
    expect(ride.startedAt).toBeInstanceOf(Date);
    expect(ride.pinAttempts).toBe(0);
  });

  it('throws BUSINESS_RULE_VIOLATION on wrong PIN and increments attempts', async () => {
    Ride._set('p2', {
      status: 'ARRIVED',
      customerUserId: 'cust-u1',
      captainUserId: 'cap-u1',
      tripPinHash: 'hashed:1234',
      pinAttempts: 0,
      pinLockedUntil: null,
    });
    await expect(
      service.verifyPinAndStart('p2', 'cust-u1', '9999'),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
    expect(Ride.updateOne).toHaveBeenCalledWith(
      { _id: 'p2' },
      { $set: { pinAttempts: 1 } },
    );
  });

  it('locks the ride after max failed attempts', async () => {
    Ride._set('p3', {
      status: 'ARRIVED',
      customerUserId: 'cust-u1',
      captainUserId: 'cap-u1',
      tripPinHash: 'hashed:1234',
      pinAttempts: 4,
      pinLockedUntil: null,
    });
    await expect(
      service.verifyPinAndStart('p3', 'cust-u1', '9999'),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
    const call = Ride.updateOne.mock.calls[0];
    expect(call[1].$set.pinLockedUntil).toBeInstanceOf(Date);
  });

  it('throws BUSINESS_RULE_VIOLATION when PIN entry is locked', async () => {
    Ride._set('p4', {
      status: 'ARRIVED',
      customerUserId: 'cust-u1',
      captainUserId: 'cap-u1',
      tripPinHash: 'hashed:1234',
      pinAttempts: 5,
      pinLockedUntil: new Date(Date.now() + 60_000),
    });
    await expect(
      service.verifyPinAndStart('p4', 'cust-u1', '1234'),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
  });

  it('throws BUSINESS_RULE_VIOLATION when ride is not ARRIVED', async () => {
    Ride._set('p5', {
      status: 'ACCEPTED',
      customerUserId: 'cust-u1',
      captainUserId: 'cap-u1',
      tripPinHash: 'hashed:1234',
      pinAttempts: 0,
      pinLockedUntil: null,
    });
    await expect(
      service.verifyPinAndStart('p5', 'cust-u1', '1234'),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
  });
});

// ── addLocationSample ──────────────────────────────────────────────────────────
describe('addLocationSample', () => {
  it('saves a sample and updates captain location', async () => {
    Ride._set('l1', {
      status: 'IN_PROGRESS',
      captainUserId: 'cap-u1',
      captainId: 'cap1',
    });
    const sample = await service.addLocationSample('l1', 'cap-u1', {
      coordinates: [72.8777, 19.076],
      recordedAt: new Date().toISOString(),
    });
    expect(sample.coordinates).toEqual([72.8777, 19.076]);
    expect(sample.implausible).toBe(false);
  });

  it('flags implausible speed between samples', async () => {
    Ride._set('l2', {
      status: 'IN_PROGRESS',
      captainUserId: 'cap-u1',
      captainId: 'cap1',
    });
    const prev = {
      coordinates: [72.8777, 19.076],
      recordedAt: new Date(Date.now() - 1000),
    };
    RideLocationSample.findOne.mockReturnValueOnce({
      sort: vi.fn(async () => prev),
    });
    // 1 km in 1 second = 3600 km/h — clearly implausible.
    const sample = await service.addLocationSample('l2', 'cap-u1', {
      coordinates: [72.8877, 19.076],
      recordedAt: new Date().toISOString(),
    });
    expect(sample.implausible).toBe(true);
    expect(Ride.updateOne).toHaveBeenCalledWith(
      { _id: 'l2' },
      expect.objectContaining({
        $set: expect.objectContaining({ locationFlagged: true }),
      }),
    );
  });

  it('throws BUSINESS_RULE_VIOLATION when ride is not IN_PROGRESS', async () => {
    Ride._set('l3', {
      status: 'ARRIVED',
      captainUserId: 'cap-u1',
      captainId: 'cap1',
    });
    await expect(
      service.addLocationSample('l3', 'cap-u1', {
        coordinates: [72.8777, 19.076],
        recordedAt: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
  });
});

// ── cancelRide ─────────────────────────────────────────────────────────────────
describe('cancelRide', () => {
  it('captain can cancel an ACCEPTED ride', async () => {
    Ride._set('c1', {
      status: 'ACCEPTED',
      captainUserId: 'cap-u1',
      customerUserId: 'cust-u1',
      bookingId: 'b1',
    });
    const ride = await service.cancelRide('c1', 'cap-u1', 'CAPTAIN', {
      reason: 'Emergency',
    });
    expect(ride.status).toBe('CANCELLED');
    expect(ride.cancelledBy).toBe('CAPTAIN');
  });

  it('customer can cancel an ACCEPTED ride', async () => {
    Ride._set('c2', {
      status: 'ACCEPTED',
      captainUserId: 'cap-u1',
      customerUserId: 'cust-u1',
      bookingId: 'b2',
    });
    const ride = await service.cancelRide('c2', 'cust-u1', 'CUSTOMER', {
      reason: 'Plans changed',
    });
    expect(ride.status).toBe('CANCELLED');
    expect(ride.cancelledBy).toBe('CUSTOMER');
  });

  it('throws BUSINESS_RULE_VIOLATION when ride is IN_PROGRESS', async () => {
    Ride._set('c3', {
      status: 'IN_PROGRESS',
      captainUserId: 'cap-u1',
      customerUserId: 'cust-u1',
    });
    await expect(service.cancelRide('c3', 'cap-u1', 'CAPTAIN')).rejects.toMatchObject({
      code: 'BUSINESS_RULE_VIOLATION',
    });
  });

  it('throws FORBIDDEN when user is not part of the ride', async () => {
    Ride._set('c4', {
      status: 'ACCEPTED',
      captainUserId: 'cap-u1',
      customerUserId: 'cust-u1',
    });
    await expect(
      service.cancelRide('c4', 'intruder', 'CAPTAIN'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ── getRide ────────────────────────────────────────────────────────────────────
describe('getRide', () => {
  it('returns the ride for the customer', async () => {
    Ride._set('g1', {
      status: 'IN_PROGRESS',
      customerUserId: 'cust-u1',
      captainUserId: 'cap-u1',
    });
    const ride = await service.getRide('g1', 'cust-u1', 'CUSTOMER');
    expect(ride._id).toBe('g1');
  });

  it('throws FORBIDDEN for an unrelated user', async () => {
    Ride._set('g2', {
      status: 'IN_PROGRESS',
      customerUserId: 'cust-u1',
      captainUserId: 'cap-u1',
    });
    await expect(
      service.getRide('g2', 'stranger', 'CUSTOMER'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throws NOT_FOUND for an unknown ride', async () => {
    await expect(service.getRide('none', 'u1', 'CUSTOMER')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});