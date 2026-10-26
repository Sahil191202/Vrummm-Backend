'use strict';

const { ZodError } = require('zod');
const { ErrorCodes, HttpStatus } = require('@vrumm/contracts');
const { logger } = require('../infrastructure/logger');

/**
 * AppError — operational error with a known HTTP status code and error code.
 * Throw this instead of raw Error objects inside route handlers.
 */
class AppError extends Error {
  /**
   * @param {string} message       - Human-readable message
   * @param {number} statusCode    - HTTP status code
   * @param {string} code          - Machine-readable code from ErrorCodes
   * @param {boolean} isOperational - true = expected failure, false = programmer error
   */
  constructor(
    message,
    statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    code = ErrorCodes.INTERNAL_ERROR,
    isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global Express error handler.
 * Must be registered as the last middleware (after all routes).
 *
 * Formats all errors as:
 *   { success: false, code, message, errors?, requestId }
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const requestId = req.id || null;
  const isProd = process.env.NODE_ENV === 'production';

  // ── ZodError (schema validation failure) ────────────────────────────────
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Validation failed',
      errors,
      requestId,
    });
  }

  // ── AppError (operational, known) ───────────────────────────────────────
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ err, requestId }, 'Non-operational AppError');
    }
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      requestId,
    });
  }

  // ── Mongoose ValidationError ─────────────────────────────────────────────
  if (err.name === 'ValidationError' && err.errors) {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Database validation failed',
      errors,
      requestId,
    });
  }

  // ── Mongoose duplicate key (E11000) ──────────────────────────────────────
  if (err.code === 11000 && err.keyValue) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(HttpStatus.CONFLICT).json({
      success: false,
      code: ErrorCodes.CONFLICT,
      message: `A record with that ${field} already exists`,
      requestId,
    });
  }

  // ── Unexpected / programmer error ────────────────────────────────────────
  logger.error({ err, requestId }, 'Unhandled error');

  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    success: false,
    code: ErrorCodes.INTERNAL_ERROR,
    message: isProd ? 'An unexpected error occurred' : err.message,
    requestId,
  });
}

module.exports = { errorHandler, AppError };
