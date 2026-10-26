import { errors } from '../shared/AppError.js';

// validate({ body, query, params }) with Zod schemas.
// Parsed values land on req.validated (Express 5 makes req.query read-only).
export function validate(schemas) {
  return (req, _res, next) => {
    const validated = {};
    const details = [];
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (result.success) {
        validated[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({ in: part, path: issue.path.join('.'), message: issue.message });
        }
      }
    }
    if (details.length > 0) return next(errors.validation(details));
    req.validated = validated;
    return next();
  };
}
