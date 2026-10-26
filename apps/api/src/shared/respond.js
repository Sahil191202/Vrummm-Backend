import { successEnvelope } from '@vrumm/contracts';

export function sendSuccess(req, res, data, { status = 200, meta } = {}) {
  return res.status(status).json(successEnvelope({ data, meta, requestId: req.id }));
}
