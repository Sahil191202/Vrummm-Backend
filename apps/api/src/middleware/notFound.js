import { errors } from '../shared/AppError.js';

export function notFound(_req, _res, next) {
  next(errors.notFound('Route not found'));
}
