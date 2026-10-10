'use strict';

const { ApiError } = require('../utils/helpers');

/**
 * Zod request validation middleware.
 * Usage: validate({ body: schema, query: schema, params: schema })
 * Parsed (and coerced) values replace req.body / req.query / req.params.
 */
function validate(schemas) {
  return (req, _res, next) => {
    for (const key of ['body', 'query', 'params']) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        const details = result.error.issues.map((i) => ({
          field: i.path.join('.') || key,
          message: i.message,
        }));
        return next(ApiError.badRequest('Validation failed', details));
      }
      if (key === 'query') req.validatedQuery = result.data;
      else req[key] = result.data;
    }
    return next();
  };
}

module.exports = { validate };
