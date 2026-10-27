import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCustomerService } from '../customer.service.js';
import { errors } from '../../../shared/AppError.js';

vi.mock('../schemas/customer.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const Customer = {
    findOne: vi.fn(async ({ userId } = {}) => {
      for (const c of store.values()) if (c.userId === userId) return c;
      return null;
    }),
    create: vi.fn(async (data) => {
      const id = String(++seq);
      const record = { _id: id, savedPlaces: [], totalRides: 0, totalSpentPaise: 0, ...data };
      store.set(id, record);
      return record;
    }),
    _reset() { store.clear(); seq = 0; },
  };
  return { Customer };
});

vi.mock('../../rbac/schemas/user.schema.js', () => ({
  User: {
    findByIdAndUpdate: vi.fn(async (_id, update) => ({ _id, ...update.$set })),
  },
}));

const { Customer } = await import('../schemas/customer.schema.js');

const service = createCustomerService();

beforeEach(() => { Customer._reset(); vi.clearAllMocks(); });

describe('getOrCreateProfile', () => {
  it('creates a profile on first call', async () => {
    const p = await service.getOrCreateProfile('user1');
    expect(p.userId).toBe('user1');
  });

  it('returns the existing profile on second call', async () => {
    await service.getOrCreateProfile('user2');
    await service.getOrCreateProfile('user2');
    expect(Customer.create).toHaveBeenCalledTimes(1);
  });
});

describe('addSavedPlace', () => {
  it('adds a place to the profile', async () => {
    // Pre-create profile so findOne returns it
    Customer._reset();
    const initial = { _id: '1', userId: 'u1', savedPlaces: [], save: vi.fn(async function() { return this; }) };
    Customer.findOne.mockResolvedValueOnce(initial);

    const result = await service.addSavedPlace('u1', {
      label: 'Home',
      address: 'Andheri West',
      coordinates: [72.836, 19.136],
    });
    expect(result.savedPlaces).toHaveLength(1);
    expect(result.savedPlaces[0].label).toBe('Home');
  });

  it('throws BUSINESS_RULE_VIOLATION when 5 places exist', async () => {
    const places = Array.from({ length: 5 }, (_, i) => ({ _id: String(i), label: `Place ${i}` }));
    Customer.findOne.mockResolvedValueOnce({ savedPlaces: places });
    await expect(
      service.addSavedPlace('u1', { label: 'Extra', address: 'x', coordinates: [0, 0] }),
    ).rejects.toMatchObject({ code: 'BUSINESS_RULE_VIOLATION' });
  });
});