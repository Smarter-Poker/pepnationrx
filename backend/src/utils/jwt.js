'use strict';

// ============================================================================
// JWT helpers.
// Access tokens are short-lived and stateless. Refresh tokens are also signed
// but additionally stored server-side (hashed) so they can be revoked; this
// module only signs and verifies them. The two token types use distinct
// secrets so an access token can never be replayed as a refresh token.
// ============================================================================

const jwt = require('jsonwebtoken');
const config = require('../config/env');

// Sign a short-lived access token. The payload carries identity and role
// only; never PHI. The subject claim is supplied directly in the payload as
// "sub", so it is not duplicated in the options object.
function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtlSeconds,
    issuer: config.jwt.issuer,
  });
}

// Sign a refresh token. The payload carries "sub" (user id) and "role"; the
// stored SHA-256 hash of the signed token is what enables server-side
// revocation and rotation.
function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTtlDays + 'd',
    issuer: config.jwt.issuer,
  });
}

// Verify an access token. Throws a jsonwebtoken error on failure; callers
// translate that into a 401. The algorithm allowlist is pinned to HS256 so a
// token presenting a different "alg" header (an algorithm-confusion attack)
// is rejected outright rather than verified against the wrong scheme.
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret, {
    issuer: config.jwt.issuer,
    algorithms: ['HS256'],
  });
}

// Verify a refresh token signature and expiry. The algorithm is pinned for
// the same reason as the access token above.
function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret, {
    issuer: config.jwt.issuer,
    algorithms: ['HS256'],
  });
}

module.exports = {
  signAccessToken: signAccessToken,
  signRefreshToken: signRefreshToken,
  verifyAccessToken: verifyAccessToken,
  verifyRefreshToken: verifyRefreshToken,
};
