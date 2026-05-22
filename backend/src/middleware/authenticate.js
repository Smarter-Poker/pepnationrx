'use strict';

// ============================================================================
// JWT authentication middleware.
// Extracts the Bearer access token, verifies it, confirms the account still
// exists and is permitted, and attaches a minimal req.user. Handlers behind
// this middleware can trust req.user.id and req.user.role.
// ============================================================================

const { LOGIN_BLOCKED_STATUS } = require('../config/constants');
const errors = require('../utils/errors');
const jwtUtil = require('../utils/jwt');
const userModel = require('../models/user.model');

// Pull a Bearer token out of the Authorization header.
function extractBearer(req) {
  const header = req.get('authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  return header.slice(7).trim();
}

// Require a valid access token. Rejects with 401 when absent or invalid.
async function authenticate(req, res, next) {
  try {
    const token = extractBearer(req);
    if (!token) {
      throw errors.unauthorized('An access token is required.');
    }

    let claims;
    try {
      claims = jwtUtil.verifyAccessToken(token);
    } catch (err) {
      throw errors.unauthorized('The access token is invalid or expired.');
    }

    // Confirm the account is still valid; a token outlives a suspension.
    const user = await userModel.findById(claims.sub);
    if (!user) {
      throw errors.unauthorized('The account no longer exists.');
    }
    if (LOGIN_BLOCKED_STATUS.includes(user.account_status)) {
      throw errors.forbidden('This account is not permitted to access the API.');
    }

    req.user = {
      id: user.id,
      role: user.role,
      accountStatus: user.account_status,
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authenticate;
