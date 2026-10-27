import { sendSuccess } from '../../shared/respond.js';
import { Captain } from '../captains/schemas/captain.schema.js';
import { logAudit } from '../audit/audit.service.js';
import { errors } from '../../shared/AppError.js';

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? fwd.split(',')[0].trim() : req.ip) ?? 'unknown';
}

export function createDocumentController({ documentService, captainService }) {
  return {
    async uploadDocument(req, res) {
      if (!req.file) throw errors.badRequest('No file was uploaded');

      const captain = await captainService.getProfileByUserId(req.user.sub);
      const { documentType, expiresAt } = req.validated.body;

      const doc = await documentService.uploadDocument(req.user.sub, captain._id, {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalName: req.file.originalname,
        documentType,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      return sendSuccess(req, res, doc, { status: 201 });
    },

    async listDocuments(req, res) {
      const captain = await captainService.getProfileByUserId(req.user.sub);
      const result = await documentService.listDocuments(
        captain._id.toString(),
        req.user.sub,
        req.user.role,
      );
      return sendSuccess(req, res, result);
    },

    async getSignedUrl(req, res) {
      const result = await documentService.getSignedUrl(
        req.validated.params.docId,
        req.user.sub,
        req.user.role,
      );
      return sendSuccess(req, res, result);
    },

    // Admin: list documents for any captain.
    async listCaptainDocuments(req, res) {
      const { captainId } = req.validated.params;
      const result = await documentService.listDocuments(captainId, req.user.sub, req.user.role);
      return sendSuccess(req, res, result);
    },

    async reviewDocument(req, res) {
      const { docId } = req.validated.params;
      const { status, rejectionReason } = req.validated.body;

      const doc = await documentService.reviewDocument(docId, {
        status,
        rejectionReason,
        reviewerUserId: req.user.sub,
      });

      await logAudit({
        actorId: req.user.sub,
        actorRole: req.user.role,
        action: `document.review.${status.toLowerCase()}`,
        targetType: 'Document',
        targetId: docId,
        requestId: req.id,
        reason: rejectionReason,
        ipAddress: clientIp(req),
      });

      return sendSuccess(req, res, doc);
    },
  };
}