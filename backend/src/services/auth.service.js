'use strict';

// ============================================================================
// Authentication service.
// Owns the business logic for registration, login, refresh-token rotation,
// and logout. Controllers stay thin and delegate here. Refresh tokens are
// signed JWTs that are ALSO stored server-side as SHA-256 hashes, which
// enables revocation, single-use rotation, and reuse detection.
// ============================================================================

const bcrypt = require('bcrypt');

const config = require('../config/env');
const { AUDIT_ACTIONS, LOGIN_BLOCKED_STATUS } = require('../config/constants');
const errors = require('../utils/errors');
const jwtUtil = require('../utils/jwt');
const { hashToken } = require('../utils/tokens');
const { withTransaction } = require('../db/query');
const userModel = require('../models/user.model');
const refreshTokenModel = require('../models/refresh-token.model');
const audit = require('./audit.service');

// A real bcrypt hash compared against when an email is not found, so a missing
// account and a wrong password take indistinguishable time. It is generated at
// load from a throwaway value: a hand-written hash literal risks being
// malformed, which makes bcrypt.compare throw and breaks the timing guarantee.
const DUMMY_HASH = bcrypt.hashSync(
  'pepnationrx-timing-equalizer',
  config.security.bcryptRounds
);

// Strip the secret column before a user object leaves the service.
function toPublicUser(row) {
  if (!row) return null;
  const copy = Object.assign({}, row);
  delete copy.password_hash;
  return copy;
}

// Sign an access token and a refresh token, persist the refresh hash, and
// return the pair plus the access lifetime in seconds. An optional `client`
// runs the refresh-token insert inside an open transaction; rotation passes
// one so the revoke and the insert are atomic.
async function issueTokenPair(user, requestMeta, client) {
  const claims = { sub: user.id, role: user.role };
  const accessToken = jwtUtil.signAccessToken(claims);
  const refreshToken = jwtUtil.signRefreshToken(claims);

  const expiresAt = new Date(
    Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000
  ).toISOString();

  await refreshTokenModel.create(
    {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
      expiresAt: expiresAt,
    },
    client
  );

  return {
    accessToken: accessToken,
    refreshToken: refreshToken,
    accessExpiresIn: config.jwt.accessTtlSeconds,
  };
}

// Register a new account and immediately issue a session.
async function register(input, requestMeta) {
  if (await userModel.emailExists(input.email)) {
    throw errors.conflict('An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(input.password, config.security.bcryptRounds);

  // Create the account and issue its first session on one transaction: a
  // failure issuing tokens rolls the user insert back rather than leaving an
  // orphaned account that can never be registered again.
  let user;
  let tokens;
  try {
    const session = await withTransaction(async (client) => {
      const created = await userModel.create(
        {
          email: input.email,
          phone: input.phone,
          passwordHash: passwordHash,
          role: 'patient',
          firstName: input.firstName,
          lastName: input.lastName,
          dateOfBirth: input.dateOfBirth,
          sexAtBirth: input.sexAtBirth,
          state: input.state,
        },
        client
      );
      const issued = await issueTokenPair(created, requestMeta, client);
      return { user: created, tokens: issued };
    });
    user = session.user;
    tokens = session.tokens;
  } catch (err) {
    // A concurrent registration can slip past the emailExists check above and
    // trip the users_email unique constraint (SQLSTATE 23505). Surface that as
    // a 409 conflict rather than letting it fall through as a generic 500.
    if (err && err.code === '23505') {
      throw errors.conflict('An account with this email already exists.');
    }
    throw err;
  }

  await audit.record({
    actorUserId: user.id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.USER_REGISTERED,
    entityType: 'user',
    entityId: user.id,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return { user: toPublicUser(user), tokens: tokens };
}

// Verify credentials and issue a session.
async function login(input, requestMeta) {
  const row = await userModel.findByEmailWithSecret(input.email);

  // Always run a bcrypt comparison to keep timing constant.
  const passwordOk = await bcrypt.compare(
    input.password,
    row ? row.password_hash : DUMMY_HASH
  );

  if (!row || !passwordOk) {
    await audit.record({
      actorUserId: row ? row.id : null,
      actorRole: row ? row.role : null,
      action: AUDIT_ACTIONS.USER_LOGIN_FAILURE,
      entityType: 'user',
      entityId: row ? row.id : null,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
      metadata: { reason: 'invalid_credentials' },
    });
    throw errors.unauthorized('Invalid email or password.');
  }

  if (LOGIN_BLOCKED_STATUS.includes(row.account_status)) {
    await audit.record({
      actorUserId: row.id,
      actorRole: row.role,
      action: AUDIT_ACTIONS.USER_LOGIN_FAILURE,
      entityType: 'user',
      entityId: row.id,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
      metadata: { reason: 'account_' + row.account_status },
    });
    throw errors.forbidden('This account is not permitted to sign in.');
  }

  await userModel.touchLastLogin(row.id);
  const tokens = await issueTokenPair(row, requestMeta);

  await audit.record({
    actorUserId: row.id,
    actorRole: row.role,
    action: AUDIT_ACTIONS.USER_LOGIN_SUCCESS,
    entityType: 'user',
    entityId: row.id,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return { user: toPublicUser(row), tokens: tokens };
}

// A refresh token revoked within this window, presented again, is treated as
// a benign double-submit (a retry, or two tabs refreshing at once) rather than
// theft: the duplicate request is rejected without revoking the session the
// legitimate rotation just issued.
const ROTATION_GRACE_MS = 10 * 1000;

// Rotate a refresh token: verify it, revoke it, and issue a fresh pair. A
// token revoked outside the grace window, presented again, indicates theft:
// the whole token family is revoked and the event audited.
async function refresh(refreshToken, requestMeta) {
  let claims;
  try {
    claims = jwtUtil.verifyRefreshToken(refreshToken);
  } catch (err) {
    throw errors.unauthorized('Refresh token is invalid or expired.');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await refreshTokenModel.findByHash(tokenHash);

  if (!stored) {
    throw errors.unauthorized('Refresh token is not recognized.');
  }

  if (stored.revoked_at) {
    const revokedAgeMs = Date.now() - new Date(stored.revoked_at).getTime();
    if (revokedAgeMs <= ROTATION_GRACE_MS) {
      // A token revoked moments ago, presented again, is almost always a
      // benign double-submit; reject this one request without tearing down
      // the user's other sessions.
      throw errors.unauthorized('Refresh token already used. Please retry.');
    }
    // A long-revoked token resurfacing is a genuine reuse/theft signal: treat
    // the whole token family as compromised.
    await refreshTokenModel.revokeAllForUser(stored.user_id);
    await audit.record({
      actorUserId: stored.user_id,
      action: AUDIT_ACTIONS.TOKEN_REUSE_DETECTED,
      entityType: 'refresh_token',
      entityId: stored.id,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    throw errors.unauthorized('Session has been revoked. Please sign in again.');
  }

  if (new Date(stored.expires_at).getTime() <= Date.now()) {
    throw errors.unauthorized('Refresh token is invalid or expired.');
  }

  const user = await userModel.findById(claims.sub);
  if (!user) {
    throw errors.unauthorized('Account no longer exists.');
  }
  if (LOGIN_BLOCKED_STATUS.includes(user.account_status)) {
    throw errors.forbidden('This account is not permitted to refresh a session.');
  }

  // Revoke the old token and issue the new pair on one transaction. revokeById
  // only updates a still-live row, so a 0 row count means a concurrent request
  // already rotated this exact token - a simultaneous double-submit, handled
  // below as a benign retry rather than as theft.
  const rotation = await withTransaction(async (client) => {
    const revokedCount = await refreshTokenModel.revokeById(stored.id, client);
    if (revokedCount === 0) {
      return { reuse: true };
    }
    const issued = await issueTokenPair(user, requestMeta, client);
    return { tokens: issued };
  });

  if (rotation.reuse) {
    // A concurrent request rotated this token during this one's transaction:
    // a simultaneous double-submit, not theft. Reject only this request - the
    // concurrent rotation succeeded and the user's session is intact.
    throw errors.unauthorized('Refresh token already used. Please retry.');
  }
  const tokens = rotation.tokens;

  await audit.record({
    actorUserId: user.id,
    actorRole: user.role,
    action: AUDIT_ACTIONS.TOKEN_REFRESHED,
    entityType: 'refresh_token',
    entityId: stored.id,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });

  return { user: user, tokens: tokens };
}

// Revoke the presented refresh token. Best-effort: an unknown token is a
// no-op, since the desired end state (no live session) is already true.
async function logout(refreshToken, requestMeta) {
  if (!refreshToken) return;
  const stored = await refreshTokenModel.findByHash(hashToken(refreshToken));
  if (!stored || stored.revoked_at) return;

  await refreshTokenModel.revokeById(stored.id);
  await audit.record({
    actorUserId: stored.user_id,
    action: AUDIT_ACTIONS.USER_LOGOUT,
    entityType: 'refresh_token',
    entityId: stored.id,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
  });
}

module.exports = {
  register: register,
  login: login,
  refresh: refresh,
  logout: logout,
};
