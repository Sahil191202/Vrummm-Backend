import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDocumentService } from '../document.service.js';
import { mockStorageProvider } from '../../../test-helpers.js';

vi.mock('../schemas/document.schema.js', () => {
  const store = new Map();
  let seq = 0;
  const Document = {
    find: vi.fn(async ({ captainId } = {}) =>
      [...store.values()].filter((d) => d.captainId === captainId),
    ),
    findById: vi.fn(async (id) => store.get(String(id)) ?? null),
    findByIdAndUpdate: vi.fn(async (id, update) => {
      const doc = store.get(String(id));
      if (!doc) return null;
      if (update.$set) Object.assign(doc, update.$set);
      store.set(String(id), doc);
      return doc;
    }),
    create: vi.fn(async (data) => {
      const id = String(++seq);
      const r = { _id: id, status: 'PENDING', ...data };
      store.set(id, r);
      return r;
    }),
    deleteMany: vi.fn(async () => {}),
    _reset() { store.clear(); seq = 0; },
  };
  return { Document, REQUIRED_DOCUMENT_TYPES: ['DRIVING_LICENCE_FRONT', 'VEHICLE_RC'] };
});

vi.mock('../../captains/schemas/captain.schema.js', () => ({
  Captain: { findOne: vi.fn(async (q) => ({ _id: q?.userId ?? 'c1' })) },
}));

const { Document } = await import('../schemas/document.schema.js');
const service = createDocumentService({ storageProvider: mockStorageProvider });

beforeEach(() => { Document._reset(); vi.clearAllMocks(); });

describe('uploadDocument', () => {
  it('stores a document record after upload', async () => {
    const doc = await service.uploadDocument('u1', 'c1', {
      buffer: Buffer.from('fake-image'),
      mimetype: 'image/jpeg',
      originalName: 'aadhar.jpg',
      documentType: 'AADHAAR_FRONT',
    });
    expect(doc.type).toBe('AADHAAR_FRONT');
    expect(doc.storagePublicId).toMatch(/mock\/documents/);
  });

  it('rejects files over 10 MB', async () => {
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024);
    await expect(
      service.uploadDocument('u1', 'c1', {
        buffer: bigBuffer, mimetype: 'image/jpeg',
        originalName: 'big.jpg', documentType: 'PAN_CARD',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('reviewDocument', () => {
  it('updates the status to APPROVED', async () => {
    const doc = await service.uploadDocument('u1', 'c1', {
      buffer: Buffer.from('x'), mimetype: 'image/jpeg',
      originalName: 'd.jpg', documentType: 'DRIVING_LICENCE_FRONT',
    });
    const reviewed = await service.reviewDocument(doc._id, {
      status: 'APPROVED', reviewerUserId: 'admin1',
    });
    expect(reviewed.status).toBe('APPROVED');
  });
});

describe('listDocuments', () => {
  it('returns missing required documents', async () => {
    const result = await service.listDocuments('c1', 'u1', 'OPERATIONS');
    expect(result.missingRequired).toContain('DRIVING_LICENCE_FRONT');
  });
});