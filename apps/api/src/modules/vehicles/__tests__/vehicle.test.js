import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVehicleService } from '../vehicle.service.js';

vi.mock('../schemas/vehicle.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const Vehicle = {
    findOne: vi.fn(async ({ captainId } = {}) => {
      for (const v of store.values()) if (v.captainId === captainId) return v;
      return null;
    }),
    create: vi.fn(async (data) => {
      const id = String(++seq);
      const r = { _id: id, isActive: true, ...data };
      store.set(id, r);
      return r;
    }),
    findOneAndUpdate: vi.fn(async ({ captainId }, update) => {
      for (const [k, v] of store.entries()) {
        if (v.captainId === captainId) {
          if (update.$set) Object.assign(v, update.$set);
          store.set(k, v);
          return v;
        }
      }
      return null;
    }),
    _reset() { store.clear(); seq = 0; },
  };
  return { Vehicle };
});

vi.mock('../../captains/schemas/captain.schema.js', () => ({
  Captain: { updateOne: vi.fn(async () => {}) },
}));

const { Vehicle } = await import('../schemas/vehicle.schema.js');
const service = createVehicleService();

beforeEach(() => { Vehicle._reset(); vi.clearAllMocks(); });

describe('registerVehicle', () => {
  it('creates a vehicle and returns it', async () => {
    const v = await service.registerVehicle('u1', 'c1', {
      type: 'BIKE', make: 'Honda', model: 'Activa', year: 2022, registrationNumber: 'MH01AB1234',
    });
    expect(v.registrationNumber).toBe('MH01AB1234');
    expect(v.captainId).toBe('c1');
  });

  it('throws CONFLICT on duplicate registration', async () => {
    await service.registerVehicle('u1', 'c1', {
      type: 'BIKE', make: 'Honda', model: 'Activa', year: 2022, registrationNumber: 'MH01AB1234',
    });
    await expect(
      service.registerVehicle('u1', 'c1', {
        type: 'AUTO', make: 'Bajaj', model: 'RE', year: 2020, registrationNumber: 'MH01CD5678',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});