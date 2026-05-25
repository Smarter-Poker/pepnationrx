'use strict';

// ============================================================================
// Membership model - data-access layer for memberships and membership_perks.
// ----------------------------------------------------------------------------
// Backs the PepNationRX Plus membership. A patient with no row is implicitly a
// non-member; only paid members have a memberships row. At most one membership
// per patient is active at a time (a partial unique index enforces this).
// ============================================================================

const { query, queryOne } = require('../db/query');

const MEMBERSHIP_COLUMNS =
  'id, user_id, tier, status, price_cents, started_at, renews_at, ' +
  'canceled_at, created_at, updated_at';

const PERK_COLUMNS = 'id, tier, perk_key, label, description, sort_order';

// Enroll a patient in a membership. The renewal date is set `intervalDays`
// out from now. The partial unique index makes the insert race-safe: a
// concurrent enroll yields null (ON CONFLICT DO NOTHING) so the caller can
// surface a conflict rather than creating a duplicate active membership.
async function create(data, client) {
  return queryOne(
    'INSERT INTO memberships (user_id, tier, price_cents, renews_at) ' +
      'VALUES ($1, $2, $3, now() + make_interval(days => $4)) ' +
      "ON CONFLICT (user_id) WHERE status = 'active' DO NOTHING " +
      'RETURNING ' + MEMBERSHIP_COLUMNS,
    [
      data.userId,
      data.tier || 'plus',
      data.priceCents,
      Number.isInteger(data.renewalIntervalDays) ? data.renewalIntervalDays : 30,
    ],
    client
  );
}

// A membership by primary key.
async function findById(id) {
  return queryOne(
    'SELECT ' + MEMBERSHIP_COLUMNS + ' FROM memberships WHERE id = $1',
    [id]
  );
}

// The patient's active membership, or null when they are a non-member.
async function findActiveByUserId(userId) {
  return queryOne(
    'SELECT ' + MEMBERSHIP_COLUMNS + ' FROM memberships ' +
      "WHERE user_id = $1 AND status = 'active'",
    [userId]
  );
}

// Every membership row a patient has had, newest first (their history).
async function findByUserId(userId) {
  const result = await query(
    'SELECT ' + MEMBERSHIP_COLUMNS + ' FROM memberships ' +
      'WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

// Cancel an active membership. A no-op (returns null) when the membership is
// not active, so the call is idempotent.
async function cancel(membershipId, client) {
  return queryOne(
    "UPDATE memberships SET status = 'canceled', canceled_at = now() " +
      "WHERE id = $1 AND status = 'active' " +
      'RETURNING ' + MEMBERSHIP_COLUMNS,
    [membershipId],
    client
  );
}

// Advance an active membership's renewal date by `intervalDays`. Used by the
// renewal sweep. Acts only on an active membership; returns null otherwise.
async function renew(membershipId, intervalDays, client) {
  return queryOne(
    'UPDATE memberships ' +
      'SET renews_at = COALESCE(renews_at, now()) + make_interval(days => $2) ' +
      "WHERE id = $1 AND status = 'active' " +
      'RETURNING ' + MEMBERSHIP_COLUMNS,
    [membershipId, Number.isInteger(intervalDays) ? intervalDays : 30],
    client
  );
}

// The reference list of perks for a tier, in display order.
async function findPerks(tier) {
  const result = await query(
    'SELECT ' + PERK_COLUMNS + ' FROM membership_perks ' +
      'WHERE tier = $1 ORDER BY sort_order ASC',
    [tier]
  );
  return result.rows;
}

module.exports = {
  create: create,
  findById: findById,
  findActiveByUserId: findActiveByUserId,
  findByUserId: findByUserId,
  cancel: cancel,
  renew: renew,
  findPerks: findPerks,
};
