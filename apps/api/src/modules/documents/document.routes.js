import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole, requirePermission } from '../../middleware/requirePermission.js';
import { validate } from '../../middleware/validate.js';
import { PERMISSIONS } from '../rbac/permissions.js';
import { createDocumentController } from './document.controller.js';
import { createDocumentService } from './document.service.js';
import { createCaptainService } from '../captains/captain.service.js';
import {
  uploadDocumentSchema,
  reviewDocumentSchema,
  docIdParamSchema,
  captainIdParamSchema as captainIdDocParamSchema,
} from './schemas/document.schemas.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  },
});

export function createDocumentRouter({ authService, storageProvider }) {
  const documentService = createDocumentService({ storageProvider });
  const captainService = createCaptainService();
  const controller = createDocumentController({ documentService, captainService });
  const router = Router();
  const auth = authenticate(authService);

  function ensureCaptainProfile(req, _res, next) {
    captainService
      .getOrCreateProfile(req.user.sub)
      .then(() => next())
      .catch(next);
  }

  // Captain self-service
  router.post('/', auth, requireRole('CAPTAIN'), ensureCaptainProfile, upload.single('file'), validate({ body: uploadDocumentSchema }), controller.uploadDocument);
  router.get('/mine', auth, requireRole('CAPTAIN'), ensureCaptainProfile, controller.listDocuments);
  router.get('/:docId/url', auth, requireRole('CAPTAIN'), ensureCaptainProfile, validate({ params: docIdParamSchema }), controller.getSignedUrl);

  // Admin / Compliance
  router.get('/captain/:captainId', auth, requirePermission(PERMISSIONS.DOCUMENTS_REVIEW), validate({ params: captainIdDocParamSchema }), controller.listCaptainDocuments);
  router.patch('/:docId/review', auth, requirePermission(PERMISSIONS.DOCUMENTS_REVIEW), validate({ params: docIdParamSchema, body: reviewDocumentSchema }), controller.reviewDocument);

  return router;
}