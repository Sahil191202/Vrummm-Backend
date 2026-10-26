'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Middleware: attach a unique request ID to every incoming request.
 *
 * - If the client sends an X-Request-Id header, that value is used as-is.
 * - Otherwise a new UUID v4 is generated.
 * - The ID is set as req.id and echoed back in the X-Request-Id response header.
 */
function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || uuidv4();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

module.exports = { requestId };
