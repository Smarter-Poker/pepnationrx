'use strict';

// ============================================================================
// Auth controller.
// Thin HTTP layer over auth.service. Each handler extracts request metadata,
// delegates to the service, manages the refresh-token cookie, and shapes the
// JSON response. All business rules live in the service.
// ============================================================================

const config = require('../config/env');
const authService = require('../services/auth.service');
const userModel = require('../models/user.model');
const errors = require('../utils/errors');

// Name of the httpOnly cookie that carries the refresh token.
const REFRESH_COOKIE = 'pnrx_refresh';

// Collect the non-PHI request metadata the service records in audit_log.
function requestMeta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}

// Cookie options for the refresh token. httpOnly blocks JS access; Secure is
// enabled in production; SameSite=strict blocks cross-site delivery.
function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000,
  };
}

// Write the refresh token to its cookie and return the access-token payload.
function sendSession(res, statusCode, result) {
  res.cookie(REFRESH_COOKIE, result.tokens.refreshToken, refreshCookieOptions());
  return res.status(statusCode).json({
    user: result.user,
    accessToken: result.tokens.accessToken,
    expiresIn: result.tokens.accessExpiresIn,
    tokenType: 'Bearer',
  });
}

// Resolve the refresh token from the cookie, falling back to the request body.
function readRefreshToken(req) {
  if (req.cookies && req.cookies[REFRESH_COOKIE]) {
    return req.cookies[REFRESH_COOKIE];
  }
  return req.body && req.body.refreshToken ? req.body.refreshToken : null;
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const result = await authService.register(req.body, requestMeta(req));
    sendSession(res, 201, result);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const result = await authService.login(req.body, requestMeta(req));
    sendSession(res, 200, result);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/refresh
async function refresh(req, res, next) {
  try {
    const token = readRefreshToken(req);
    const result = await authService.refresh(token, requestMeta(req));
    sendSession(res, 200, result);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout
async function logout(req, res, next) {
  try {
    const token = readRefreshToken(req);
    await authService.logout(token, requestMeta(req));
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.status(200).json({ message: 'Signed Out.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me - returns the authenticated user's public profile.
async function me(req, res, next) {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) {
      // The token was valid but the account was removed since it was issued.
      return next(errors.unauthorized('Account no longer exists.'));
    }
    res.status(200).json({ user: user });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register: register,
  login: login,
  refresh: refresh,
  logout: logout,
  me: me,
};
