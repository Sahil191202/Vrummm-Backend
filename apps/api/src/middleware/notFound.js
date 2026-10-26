'use strict';

const { ErrorCodes, HttpStatus } = require('@vrumm/contracts');

/**
 * 404 handler.
 * Mount this after all routes so it catches any unmatched request.
 */
function notFound(req, res) {
  res.status(HttpStatus.NOT_FOUND).json({
    success: false,
    code: ErrorCodes.NOT_FOUND,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    requestId: req.id || null,
  });
}

module.exports = { notFound };
