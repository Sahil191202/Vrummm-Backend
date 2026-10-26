'use strict';

/**
 * Middleware factory: validate req.query against a Zod schema.
 *
 * On success, req.query is replaced with the parsed (and potentially
 * transformed) value from Zod. On failure, passes a ZodError to next()
 * which the global error handler converts to a 400 response.
 *
 * @param {import('zod').ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 */
function validateQuery(schema) {
  return function (req, _res, next) {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(result.error);
    }
    req.query = result.data;
    return next();
  };
}

module.exports = { validateQuery };
