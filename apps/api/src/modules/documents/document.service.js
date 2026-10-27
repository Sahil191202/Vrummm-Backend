import { Document, REQUIRED_DOCUMENT_TYPES } from './schemas/document.schema.js';
import { Captain } from '../captains/schemas/captain.schema.js';
import { errors } from '../../shared/AppError.js';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function createDocumentService({ storageProvider }) {
  async function uploadDocument(userId, captainId, { buffer, mimetype, originalName, documentType, expiresAt }) {
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw errors.badRequest('File exceeds the 10 MB limit');
    }

    // Upload to Cloudinary first.
    const folder = `vrumm/captains/${captainId}/documents`;
    const stored = await storageProvider.uploadDocument({ buffer, mimetype, originalName, folder });

    // If there is an existing doc of this type, mark it superseded by replacing it.
    await Document.deleteMany({ captainId, type: documentType });

    const doc = await Document.create({
      captainId,
      userId,
      type: documentType,
      storagePublicId: stored.publicId,
      storageResourceType: stored.resourceType,
      fileSizeBytes: stored.bytes,
      fileFormat: stored.format,
      expiresAt: expiresAt ?? null,
    });

    return doc;
  }

  async function getSignedUrl(docId, requestingUserId, requestingRole) {
    const doc = await Document.findById(docId);
    if (!doc) throw errors.notFound('Document not found');

    // Captains can only access their own documents.
    if (requestingRole === 'CAPTAIN' && doc.userId.toString() !== requestingUserId) {
      throw errors.forbidden('You can only access your own documents');
    }

    const url = await storageProvider.getSignedUrl({
      publicId: doc.storagePublicId,
      resourceType: doc.storageResourceType,
    });

    return { url, expiresInSeconds: 300, documentType: doc.type, status: doc.status };
  }

  async function listDocuments(captainId, requestingUserId, requestingRole) {
    // Captains can only list their own documents.
    if (requestingRole === 'CAPTAIN') {
      const captain = await Captain.findOne({ userId: requestingUserId });
      if (!captain || captain._id.toString() !== captainId) {
        throw errors.forbidden('You can only view your own documents');
      }
    }

    const docs = await Document.find({ captainId }).sort({ type: 1, createdAt: -1 });

    // Add a summary of what is missing.
    const approvedTypes = new Set(docs.filter((d) => d.status === 'APPROVED').map((d) => d.type));
    const missingRequired = REQUIRED_DOCUMENT_TYPES.filter((t) => !approvedTypes.has(t));

    return { documents: docs, missingRequired };
  }

  async function reviewDocument(docId, { status, rejectionReason, reviewerUserId }) {
    const doc = await Document.findByIdAndUpdate(
      docId,
      {
        $set: {
          status,
          reviewedBy: reviewerUserId,
          reviewedAt: new Date(),
          rejectionReason: status === 'REJECTED' ? rejectionReason : null,
        },
      },
      { new: true, runValidators: true },
    );
    if (!doc) throw errors.notFound('Document not found');
    return doc;
  }

  return { uploadDocument, getSignedUrl, listDocuments, reviewDocument };
}