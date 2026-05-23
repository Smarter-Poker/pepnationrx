'use strict';

// ============================================================================
// Rate limiting middleware.
// Three limiters are exported: a general per-IP limiter for the whole API, a
// strict limiter for the credential endpoints (the prime credential-stuffing
// targets), and a separate, more generous limiter for token refresh. Each is
// its own rate-limit instance, so the buckets do not bleed into one another.
// Window and ceilings come from configuration.
// ============================================================================

const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const { AppError } = require('../utils/errors');

// Shared handler so a throttled request returns the standard error shape.
function limitHandler(req, res, next) {
  next(new AppError(429, 'too_many_requests', 'Too many requests. Please slow down.'));
}

// Liveness and readiness probes must never be throttled. A monitor or load
// balancer polling them from a single IP could otherwise exhaust the per-IP
// budget and start receiving 429s, which an orchestrator misreads as the
// service being down - pulling a healthy instance out of rotation. These
// paths are exempted from the general limiter via `skip`.
const HEALTH_PATHS = ['/api/health', '/api/health/ready'];

// General API limiter.
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
  skip: (req) => HEALTH_PATHS.includes(req.path),
});

// Strict limiter for the credential endpoints (register, login): the prime
// credential-stuffing targets. This is its own rate-limit instance - a
// separate per-IP bucket - so it can neither exhaust nor be exhausted by the
// refresh endpoint.
const credentialLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

// Limiter for token refresh and logout. A normal single-page app refreshes
// its access token routinely, often from several tabs at once, so this bucket
// is far more generous than the credential limiter while still bounding
// abuse. It is a separate instance, so a burst of refreshes never locks a
// user out of logging in.
const refreshLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

module.exports = {
  generalLimiter: generalLimiter,
  credentialLimiter: credentialLimiter,
  refreshLimiter: refreshLimiter,
};
