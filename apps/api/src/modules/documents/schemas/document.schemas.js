import { z } from 'zod';
import { DOCUMENT_TYPES } from './document.schema.js';

export const uploadDocumentSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  expiresAt: z
    .string()
    .datetime({ message: 'expiresAt must be an ISO 8601 date string' })
    .optional(),
});

export const reviewDocumentSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().trim().min(1).max(500).optional(),
}).refine(
  (d) => d.status !== 'REJECTED' || d.rejectionReason,
  { message: 'rejectionReason is required when rejecting a document', path: ['rejectionReason'] },
);

export const docIdParamSchema = z.object({
  docId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid document id'),
});

export const captainIdParamSchema = z.object({
  captainId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid captain id'),
});