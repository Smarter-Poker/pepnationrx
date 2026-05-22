'use strict';

// ============================================================================
// Opaque token and hashing helpers.
// Refresh tokens are stored in the database only as SHA-256 hashes, so a leak
// of the refresh_tokens table cannot be replayed against the API. This module
// generates the random secret and computes the storage hash.
// ============================================================================

const crypto = require('crypto');

// Generate a cryptographically random, URL-safe opaque token string.
function generateOpaqueToken() {
  return crypto.randomBytes(48).toString('base64url');
}

// Compute the deterministic SHA-256 hash stored in refresh_tokens.token_hash.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Constant-time comparison of two hex hashes, guarding against timing attacks.
function safeEqual(hashA, hashB) {
  const bufferA = Buffer.from(String(hashA), 'utf8');
  const bufferB = Buffer.from(String(hashB), 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

module.exports = {
  generateOpaqueToken: generateOpaqueToken,
  hashToken: hashToken,
  safeEqual: safeEqual,
};
