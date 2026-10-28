import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acceptOffer, rejectOffer } from '../dispatch.engine.js';

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('../../captains/schemas/captain.schema.js', () => ({
  Captain: { find: vi.fn(async () => []) },
}));

vi.mock('../../bookings/schemas/booking.schema.js', () => {
  const store = new Map();
  const Booking = {
    findById: vi.fn(async (id) => store.get(String(id)) ?? null),
    findOneAndUpdate: vi.fn(async ({ _id, status }, update) => {
      const b = store.get(String(_id));
      if (!b || b.status !== status) return null;
      if (update.$set) Object.assign(b, update.$set);
      return b;
    }),
    updateOne: vi.fn(async () => {}),
    _set(id, data) { store.set(String(id), { _id: id, ...data }); },
    _reset() { store.clear(); },
  };
  return { Booking };
});

vi.mock('../schemas/rideOffer.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const RideOffer = {
    findOneAndUpdate: vi.fn(async ({ _id, captainId, status }, update) => {
      const o = store.get(String(_id));
      if (!o) return null;
      if (captainId && String(o.captainId) !== String(captainId)) return null;
      if (status && o.status !== status) return null;
      if (update.$set) Object.assign(o, update.$set);
      return o;
    }),
    updateMany: vi.fn(async () => {}),
    updateOne: vi.fn(async () => {}),
    _set(id, data) {
      const obj = { _id: String(id), status: 'PENDING', ...data };
      store.set(String(id), obj);
    },
    _reset() { store.clear(); seq = 0; },
  };
  return { RideOffer };
});

vi.mock('../schemas/dispatchRound.schema.js', () => ({
  DispatchRound: {
    findOne: vi.fn(() => ({ sort: vi.fn(() => Promise.resolve(null)) })),
    create: vi.fn(async ([data]) => [{ _id: 'round1', ...data }]),
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

const { Booking } = await import('../../bookings/schemas/booking.schema.js');
const { RideOffer } = await import('../schemas/rideOffer.schema.js');

beforeEach(() => {
  Booking._reset();
  RideOffer._reset();
  vi.clearAllMocks();
});

// ── acceptOffer ────────────────────────────────────────────────────────────────
describe('acceptOffer', () => {
  it('assigns captain to booking on valid accept', async () => {
    Booking._set('b1', { status: 'SEARCHING', vehicleType: 'BIKE' });
    RideOffer._set('o1', { captainId: 'c1', bookingId: 'b1', roundId: 'r1', status: 'PENDING' });

    const { offer, booking } = await acceptOffer('o1', 'c1', 'u1');
    expect(offer.status).toBe('ACCEPTED');
    expect(booking.status).toBe('ACCEPTED');
    expect(String(booking.captainId)).toBe('c1');
  });

  it('throws CONFLICT when offer is already accepted', async () => {
    RideOffer._set('o2', { captainId: 'c1', bookingId: 'b2', roundId: 'r1', status: 'EXPIRED' });
    await expect(acceptOffer('o2', 'c1', 'u1')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('throws CONFLICT when booking already taken by another captain', async () => {
    // Offer is PENDING but booking is already ACCEPTED (race condition).
    Booking._set('b3', { status: 'ACCEPTED', captainId: 'c2' });
    RideOffer._set('o3', { captainId: 'c1', bookingId: 'b3', roundId: 'r1', status: 'PENDING' });

    // findOneAndUpdate for offer succeeds but for booking returns null (already accepted).
    RideOffer.findOneAndUpdate.mockResolvedValueOnce({
      _id: 'o3', status: 'ACCEPTED', bookingId: 'b3', roundId: 'r1',
    });
    Booking.findOneAndUpdate.mockResolvedValueOnce(null);

    await expect(acceptOffer('o3', 'c1', 'u1')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects an offer for a different captain', async () => {
    RideOffer._set('o4', { captainId: 'c1', bookingId: 'b4', roundId: 'r1', status: 'PENDING' });
    await expect(acceptOffer('o4', 'c-wrong', 'u-wrong')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

// ── rejectOffer ────────────────────────────────────────────────────────────────
describe('rejectOffer', () => {
  it('marks offer as REJECTED', async () => {
    RideOffer._set('o5', { captainId: 'c1', bookingId: 'b5', status: 'PENDING' });
    const offer = await rejectOffer('o5', 'c1');
    expect(offer.status).toBe('REJECTED');
  });

  it('throws CONFLICT when offer already responded', async () => {
    RideOffer._set('o6', { captainId: 'c1', bookingId: 'b6', status: 'EXPIRED' });
    await expect(rejectOffer('o6', 'c1')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});