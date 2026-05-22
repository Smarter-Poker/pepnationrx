'use strict';

// ============================================================================
// Refresh token model - data-access layer for the refresh_tokens table.
// Tokens are stored only as SHA-256 hashes. A token is "live" when it has not
// expired and has not been revoked. Rotation is implemented by revoking the
// presented token and issuing a fresh row inside one transaction.
// ============================================================================

const { query, queryOne } = require('../db/query');

// Persist a new refresh token hash. expiresAt is an ISO timestamp string.
// An optional `client` runs the insert inside an open transaction so token
// rotation (revoke old + insert new) commits or rolls back as one unit.
async function create(data, client) {
  return queryOne(
    'INSERT INTO refresh_tokens ' +
      '(user_id, token_hash, ip_address, user_agent, expires_at) ' +
      'VALUES ($1, $2, $3, $4, $5) ' +
      'RETURNING id, user_id, expires_at, created_at',
    [
      data.userId,
      data.tokenHash,
      data.ipAddress || null,
      data.userAgent || null,
      data.expiresAt,
    ],
    client
  );
}

// Find a token row by its stored hash, regardless of revoked or expired state.
// The caller inspects revoked_at and expires_at to decide how to react; a
// presented-but-revoked token is a reuse signal worth auditing.
async function findByHash(tokenHash) {
  return queryOne(
    'SELECT id, user_id, token_hash, expires_at, revoked_at, created_at ' +
      'FROM refresh_tokens WHERE token_hash = $1',
    [tokenHash]
  );
}

// Revoke a single token row by id (idempotent). An optional `client` runs the
// update inside an open transaction alongside the replacement token insert.
async function revokeById(id, client) {
  await query(
    'UPDATE refresh_tokens SET revoked_at = now() ' +
      'WHERE id = $1 AND revoked_at IS NULL',
    [id],
    client
  );
}

// Revoke every live token for a user. Used on logout-all and on detected
// token reuse, where the whole family is considered compromised.
async function revokeAllForUser(userId) {
  await query(
    'UPDATE refresh_tokens SET revoked_at = now() ' +
      'WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );
}

// Delete expired rows. Invoked by a maintenance job in a later phase.
async function deleteExpired() {
  const result = await query(
    'DELETE FROM refresh_tokens WHERE expires_at < now()'
  );
  return result.rowCount;
}

module.exports = {
  create: create,
  findByHash: findByHash,
  revokeById: revokeById,
  revokeAllForUser: revokeAllForUser,
  deleteExpired: deleteExpired,
};
