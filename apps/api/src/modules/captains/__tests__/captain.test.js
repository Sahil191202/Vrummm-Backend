import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCaptainService } from '../captain.service.js';

vi.mock('../schemas/captain.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const Captain = {
    findOne: vi.fn(async ({ userId } = {}) => {
      for (const c of store.values()) if (c.userId === userId) return c;
      return null;
    }),
    findById: vi.fn(async (id) => store.get(String(id)) ?? null),
    create: vi.fn(async (data) => {
      const id = String(++seq);
      const r = { _id: id, approvalStatus: 'PENDING', isOnline: false, ...data };
      store.set(id, r);
      return r;
    }),
    updateOne: vi.fn(async (filter, update) => {
      const id = filter._id ? String(filter._id) : null;
      if (!id) return;
      const c = store.get(id);
      if (c && update.$set) { Object.assign(c, update.$set); store.set(id, c); }
    }),
    find: vi.fn(async () => []),
    countDocuments: vi.fn(async () => 0),
    _reset() { store.clear(); seq = 0; },
  };
  return { Captain };
});

vi.mock('../../rbac/schemas/user.schema.js', () => ({
  User: {
    findByIdAndUpdate: vi.fn(async (id, u) => ({ _id: id, ...u.$set })),
    find: vi.fn(async () => []),
  },
}));

vi.mock('../../documents/schemas/document.schema.js', () => ({
  Document: { find: vi.fn(async () => []) },
  REQUIRED_DOCUMENT_TYPES: ['DRIVING_LICENCE_FRONT', 'VEHICLE_RC'],
}));

const { Captain } = await import('../schemas/captain.schema.js');
const { Document } = await import('../../documents/schemas/document.schema.js');

const service = createCaptainService();

beforeEach(() => { Captain._reset(); vi.clearAllMocks(); });

describe('setAvailability', () => {
  it('throws BUSINESS_RULE_VIOLATION when trying to go online while PENDING', async () => {
    Captain.findOne.mockResolvedValueOnce({ _id: 'c1', userId: 'u1', approvalStatus: 'PENDING', isOnline: false });
    await expect(service.setAvailability('u1', true)).rejects.toMatchObject({
      code: 'BUSINESS_RULE_VIOLATION',
    });
  });

  it('throws BUSINESS_RULE_VIOLATION when required documents are missing', async () => {
    Captain.findOne.mockResolvedValueOnce({ _id: 'c1', userId: 'u1', approvalStatus: 'APPROVED', isOnline: false });
    Document.find.mockResolvedValueOnce([]); // no documents
    await expect(service.setAvailability('u1', true)).rejects.toMatchObject({
      code: 'BUSINESS_RULE_VIOLATION',
    });
  });

  it('allows going offline regardless of approval status', async () => {
    Captain.findOne.mockResolvedValueOnce({ _id: 'c1', userId: 'u1', approvalStatus: 'PENDING', isOnline: true });
    const result = await service.setAvailability('u1', false);
    expect(result.isOnline).toBe(false);
  });
});

describe('setApprovalStatus', () => {
  it('requires a reason for REJECTED', async () => {
    Captain.findById.mockResolvedValueOnce({ _id: 'c1', approvalStatus: 'PENDING' });
    await expect(
      service.setApprovalStatus('c1', { status: 'REJECTED', adminUserId: 'admin1' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('checkEligibility', () => {
  it('returns eligible false when documents are missing', async () => {
    Document.find.mockResolvedValueOnce([]);
    const result = await service.checkEligibility('c1');
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/Missing required documents/);
  });
});