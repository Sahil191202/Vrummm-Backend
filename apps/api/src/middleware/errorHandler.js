import { ERROR_CODES, ERROR_STATUS, errorEnvelope } from '@vrumm/contracts';
import { AppError } from '../shared/AppError.js';

// Turns any thrown value into the standard error envelope. Never leaks stack traces or internals.
function normalise(err) {
  if (err instanceof AppError) {
    return { code: err.code, status: err.status, message: err.message, details: err.details };
  }
  if (err?.type === 'entity.parse.failed') {
    return {
      code: ERROR_CODES.BAD_REQUEST,
      status: 400,
      message: 'Request body is not valid JSON',
    };
  }
  if (err?.type === 'entity.too.large') {
    return {
      code: ERROR_CODES.PAYLOAD_TOO_LARGE,
      status: 413,
      message: 'Request body is too large',
    };
  }
  return {
    code: ERROR_CODES.INTERNAL_ERROR,
    status: ERROR_STATUS.INTERNAL_ERROR,
    message: 'Something went wrong on our side',
  };
}

export function errorHandler(logger) {
  // Express identifies error handlers by their 4 arguments. Keep all four.
  return (err, req, res, next) => {
    if (res.headersSent) return next(err);
    const { code, status, message, details } = normalise(err);
    if (status >= 500) {
      logger.error({ requestId: req.id, err }, 'unhandled error');
    }
    return res.status(status).json(errorEnvelope({ code, message, details, requestId: req.id }));
  };
}
