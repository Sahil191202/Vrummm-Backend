import { randomUUID } from 'node:crypto';
import { REQUEST_ID_HEADER } from '@vrumm/contracts';

// Accept a client-supplied id only if it is short and safe. This stops log injection.
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function requestId(req, res, next) {
  const incoming = req.get(REQUEST_ID_HEADER);
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
