'use strict';

// ============================================================================
// Request validation middleware.
// validate(schema) parses req.body with a Zod schema. On success the parsed,
// typed value replaces req.body so handlers receive clean input. On failure
// it raises a 400 AppError whose details list each offending field.
// ============================================================================

const errors = require('../utils/errors');

// Build a body-validation middleware from a Zod schema.
function validate(schema) {
  return function validateMiddleware(req, res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(errors.badRequest('Request validation failed.', details));
    }
    req.body = result.data;
    next();
  };
}

module.exports = validate;
