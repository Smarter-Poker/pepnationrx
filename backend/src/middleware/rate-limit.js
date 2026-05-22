'use strict';

// ============================================================================
// Rate limiting middleware.
// Two limiters are exported: a general per-IP limiter for the whole API and a
// stricter limiter for authentication routes, which are the prime target for
// credential-stuffing. Window and ceilings come from configuration.
// ============================================================================

const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const { AppError } = require('../utils/errors');

// Shared handler so a throttled request returns the standard error shape.
function limitHandler(req, res, next) {
  next(new AppError(429, 'too_many_requests', 'Too many requests. Please slow down.'));
}

// General API limiter.
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

// Stricter limiter for login, register, and refresh endpoints.
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

module.exports = {
  generalLimiter: generalLimiter,
  authLimiter: authLimiter,
};
