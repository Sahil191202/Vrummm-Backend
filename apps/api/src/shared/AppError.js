import { ERROR_CODES, ERROR_STATUS } from '@vrumm/contracts';

// Throw this from services for any expected failure. Anything else becomes a generic 500.
export class AppError extends Error {
  constructor(code, message, { details, cause } = {}) {
    super(message, { cause });
    if (!ERROR_STATUS[code]) throw new Error(`Unknown error code: ${code}`);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }
}

export const errors = {
  badRequest: (message, details) => new AppError(ERROR_CODES.BAD_REQUEST, message, { details }),
  validation: (details) =>
    new AppError(ERROR_CODES.VALIDATION_ERROR, 'Request validation failed', { details }),
  unauthenticated: (message = 'Authentication required') =>
    new AppError(ERROR_CODES.UNAUTHENTICATED, message),
  forbidden: (message = 'You do not have permission to do this') =>
    new AppError(ERROR_CODES.FORBIDDEN, message),
  notFound: (message = 'Resource not found') => new AppError(ERROR_CODES.NOT_FOUND, message),
  conflict: (message, details) => new AppError(ERROR_CODES.CONFLICT, message, { details }),
  businessRule: (message, details) =>
    new AppError(ERROR_CODES.BUSINESS_RULE_VIOLATION, message, { details }),
  unavailable: (message, details) =>
    new AppError(ERROR_CODES.SERVICE_UNAVAILABLE, message, { details }),
};
