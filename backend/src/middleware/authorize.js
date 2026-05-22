'use strict';

// ============================================================================
// Role-based access control middleware.
// authorize(...roles) returns a middleware that admits a request only when
// req.user.role is in the allowed set. It must run after the authenticate
// middleware, which populates req.user.
// ============================================================================

const errors = require('../utils/errors');

// Build a guard for one or more roles. Example: authorize('admin', 'support').
function authorize() {
  const allowed = Array.prototype.slice.call(arguments);

  return function authorizeMiddleware(req, res, next) {
    if (!req.user) {
      // Defensive: authorize was mounted without authenticate ahead of it.
      return next(errors.unauthorized('Authentication is required.'));
    }
    if (allowed.length > 0 && !allowed.includes(req.user.role)) {
      return next(errors.forbidden('Your role may not perform this action.'));
    }
    next();
  };
}

module.exports = authorize;
