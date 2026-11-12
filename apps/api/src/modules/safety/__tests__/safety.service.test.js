import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSafetyService } from '../safety.service.js';

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('../schemas/incident.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const Incident = {
    create: vi.fn(async (data) => {
      const id = String(++seq);
      const inc = {
        _id: id,
        statusHistory: [],
        createdAt: new Date(),
        save: vi.fn(async function () {
          return this;
        }),
        ...data,
      };
      store.set(id, inc);
      return inc;
    }),
    findById: vi.fn(async (id) => store.get(String(id)) ?? null),
    find: vi.fn(() => ({
      sort: () => ({ skip: () => ({ limit: () => Promise.resolve([...store.values()]) }) }),
    })),
    countDocuments: vi.fn(async () => store.size),
    _set(id, data) {
      store.set(String(id), {
        _id: String(id),
        statusHistory: [],
        save: vi.fn(async function () {
          return this;
        }),
        ...data,
      });
    },
    _reset() {
      store.clear();
      seq = 0;
    },
  };
  return { Incident };
});

vi.mock('../schemas/tripShareToken.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const TripShareToken = {
    create: vi.fn(async (data) => {
      const id = String(++seq);
      const doc = { _id: id, isActive: true, ...data };
      store.set(id, doc);
      return doc;
    }),
    findOne: vi.fn(async (filter = {}) => {
      for (const t of store.values()) {
        if (filter.token && t.token === filter.token) return { ...t };
      }
      return null;
    }),
    _set(id, data) {
      store.set(String(id), { _id: String(id), isActive: true, ...data });
    },
    _reset() {
      store.clear();
      seq = 0;
    },
  };
  return { TripShareToken };
});

vi.mock('../schemas/supportTicket.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const SupportTicket = {
    create: vi.fn(async (data) => {
      const id = String(++seq);
      const t = {
        _id: id,
        status: 'OPEN',
        messages: [],
        save: vi.fn(async function () {
          return this;
        }),
        ...data,
      };
      store.set(id, t);
      return t;
    }),
    findById: vi.fn(async (id) => store.get(String(id)) ?? null),
    find: vi.fn(() => ({
      sort: () => ({ skip: () => ({ limit: () => Promise.resolve([...store.values()]) }) }),
    })),
    countDocuments: vi.fn(async () => store.size),
    _reset() {
      store.clear();
      seq = 0;
    },
  };
  return { SupportTicket };
});

vi.mock('../../rides/schemas/ride.schema.js', () => {
  const store = new Map();
  const Ride = {
    findById: vi.fn(async (id) => store.get(String(id)) ?? null),
    _set(id, data) {
      store.set(String(id), { _id: String(id), ...data });
    },
    _reset() {
      store.clear();
    },
  };
  return { Ride };
});

vi.mock('../../rides/schemas/rideLocationSample.schema.js', () => ({
  RideLocationSample: {
    findOne: vi.fn(() => ({
      sort: vi.fn(async () => ({ coordinates: [72.8258, 18.9438], recordedAt: new Date() })),
    })),
  },
}));

vi.mock('../../vehicles/schemas/vehicle.schema.js', () => ({
  Vehicle: {
    findOne: vi.fn(async () => ({
      model: 'Honda Activa',
      plateNumber: 'MH01AB1234',
      color: 'Black',
    })),
  },
}));

vi.mock('../../socket/socket.service.js', () => ({
  emit: {
    toUser: vi.fn(async () => {}),
    toRide: vi.fn(async () => {}),
    toOps: vi.fn(async () => {}),
  },
}));

const { Incident } = await import('../schemas/incident.schema.js');
const { TripShareToken } = await import('../schemas/tripShareToken.schema.js');
const { SupportTicket } = await import('../schemas/supportTicket.schema.js');
const { Ride } = await import('../../rides/schemas/ride.schema.js');
const { emit } = await import('../../socket/socket.service.js');

const service = createSafetyService({ io: {} });

beforeEach(() => {
  Incident._reset();
  TripShareToken._reset();
  SupportTicket._reset();
  Ride._reset();
  vi.clearAllMocks();
});

describe('triggerSos', () => {
  it('triggers simulated emergency SOS and alerts ride and ops rooms', async () => {
    Ride._set('r1', {
      customerUserId: 'cust1',
      captainUserId: 'capt1',
      status: 'IN_PROGRESS',
    });

    const result = await service.triggerSos({
      rideId: 'r1',
      userId: 'cust1',
      userRole: 'CUSTOMER',
      coordinates: [72.8258, 18.9438],
      description: 'Customer feels unsafe',
    });

    expect(result.incident.type).toBe('SOS_SIMULATED');
    expect(result.incident.severity).toBe('CRITICAL');
    expect(result.incident.isSimulated).toBe(true);
    expect(result.message).toMatch(/simulation mode/i);

    expect(emit.toRide).toHaveBeenCalledTimes(1);
    expect(emit.toOps).toHaveBeenCalledTimes(1);
  });

  it('rejects SOS trigger from an unauthorized third party', async () => {
    Ride._set('r2', {
      customerUserId: 'cust1',
      captainUserId: 'capt1',
      status: 'IN_PROGRESS',
    });

    await expect(
      service.triggerSos({
        rideId: 'r2',
        userId: 'intruder',
        userRole: 'CUSTOMER',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Trip Sharing with Expiring Tokens', () => {
  it('generates share token and allows public trip detail retrieval', async () => {
    Ride._set('r3', {
      customerUserId: 'cust1',
      captainId: 'capt_doc1',
      status: 'IN_PROGRESS',
      vehicleType: 'BIKE',
      pickup: { address: 'Churchgate' },
      drop: { address: 'Bandra' },
    });

    const tokenRes = await service.generateTripShareToken({
      rideId: 'r3',
      userId: 'cust1',
      ttlHours: 12,
    });

    expect(tokenRes.token).toBeDefined();
    expect(tokenRes.shareUrl).toMatch(/^\/shared\/trip\//);

    const publicTrip = await service.getSharedTripDetails(tokenRes.token);
    expect(publicTrip.status).toBe('IN_PROGRESS');
    expect(publicTrip.vehicle.plateNumber).toBe('MH01AB1234');
    expect(publicTrip.currentLocation).toEqual([72.8258, 18.9438]);
  });

  it('rejects expired trip share token', async () => {
    TripShareToken._set('t_old', {
      token: 'expired_tok_123',
      rideId: 'r3',
      expiresAt: new Date(Date.now() - 60000), // Expired 1 min ago
    });

    await expect(service.getSharedTripDetails('expired_tok_123')).rejects.toMatchObject({
      code: 'BUSINESS_RULE_VIOLATION',
    });
  });
});

describe('Support Tickets', () => {
  it('creates ticket and adds messages', async () => {
    const ticket = await service.createSupportTicket(
      {
        subject: 'Billing discrepancy',
        category: 'BILLING',
        priority: 'HIGH',
        message: 'Charged extra for toll that was not incurred',
      },
      'cust1',
      'CUSTOMER',
    );

    expect(ticket.ticketNumber).toMatch(/^TCK-/);
    expect(ticket.status).toBe('OPEN');
    expect(ticket.messages).toHaveLength(1);

    const updated = await service.addSupportMessage(
      ticket._id,
      { message: 'Support agent is checking the toll route records' },
      'agent1',
      'SUPPORT',
    );

    expect(updated.messages).toHaveLength(2);
  });
});

describe('updateIncidentStatus', () => {
  it('updates incident status and records resolution history', async () => {
    Incident._set('inc1', {
      type: 'ROUTE_DEVIATION',
      status: 'REPORTED',
      statusHistory: [],
    });

    const resolved = await service.updateIncidentStatus(
      'inc1',
      { status: 'RESOLVED', resolutionNotes: 'Captain took flyover route to avoid jam' },
      'admin1',
    );

    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolutionNotes).toMatch(/flyover/);
    expect(resolved.statusHistory).toHaveLength(1);
    expect(resolved.statusHistory[0].status).toBe('RESOLVED');
  });
});
