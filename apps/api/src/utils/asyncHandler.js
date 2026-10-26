'use strict';

/**
 * Wraps an async Express route handler and forwards any rejected promise
 * to next(), so the global error handler can process it.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }));
 *
 * @param {function} fn - Async route handler
 * @returns {function}
 */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
