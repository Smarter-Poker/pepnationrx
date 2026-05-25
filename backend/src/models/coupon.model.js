'use strict';

// ============================================================================
// Coupon model - data-access layer for coupons and coupon_redemptions.
// ----------------------------------------------------------------------------
// Backs the discount and coupon feature. A code is stored uppercased; every
// lookup uppercases its input so a code is effectively case-insensitive.
//
// recordRedemption claims a redemption slot with a single guarded UPDATE - the
// global redemption cap is enforced in SQL, not by a count-then-insert in JS,
// so two checkouts racing on the last redemption cannot both succeed.
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, code, type, value, max_redemptions, redemption_count, per_user_limit, ' +
  'min_subtotal_cents, starts_at, expires_at, is_active, description, ' +
  'created_at, updated_at';

// Normalize a code for storage and lookup: trimmed and uppercased.
function normalizeCode(raw) {
  return String(raw == null ? '' : raw).trim().toUpperCase();
}

// -- Lookups -----------------------------------------------------------------

// A coupon by its code, case-insensitively. Returns null when no code matches.
async function findByCode(code) {
  return queryOne(
    'SELECT ' + COLUMNS + ' FROM coupons WHERE code = $1',
    [normalizeCode(code)]
  );
}

// A coupon by primary key.
async function findById(id) {
  return queryOne('SELECT ' + COLUMNS + ' FROM coupons WHERE id = $1', [id]);
}

// Every coupon, newest first. Backs the admin coupon panel.
async function findAll() {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM coupons ORDER BY created_at DESC'
  );
  return result.rows;
}

// How many times a patient has already redeemed a coupon. Used to enforce the
// per-user redemption limit.
async function redemptionCountForUser(couponId, userId) {
  const row = await queryOne(
    'SELECT COUNT(*)::int AS n FROM coupon_redemptions ' +
      'WHERE coupon_id = $1 AND user_id = $2',
    [couponId, userId]
  );
  return row ? Number(row.n) : 0;
}

// -- Writes ------------------------------------------------------------------

// Create a coupon. The code is uppercased before storage. A duplicate code
// yields null (ON CONFLICT DO NOTHING) so the caller can surface a 409 rather
// than leaking a database constraint error.
async function create(data, client) {
  return queryOne(
    'INSERT INTO coupons ' +
      '(code, type, value, max_redemptions, per_user_limit, ' +
      ' min_subtotal_cents, starts_at, expires_at, is_active, description) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ' +
      'ON CONFLICT (code) DO NOTHING ' +
      'RETURNING ' + COLUMNS,
    [
      normalizeCode(data.code),
      data.type,
      data.value,
      Number.isInteger(data.maxRedemptions) ? data.maxRedemptions : null,
      Number.isInteger(data.perUserLimit) ? data.perUserLimit : 1,
      Number.isInteger(data.minSubtotalCents) ? data.minSubtotalCents : 0,
      data.startsAt || null,
      data.expiresAt || null,
      data.isActive === false ? false : true,
      data.description || null,
    ],
    client
  );
}

// Update the mutable terms of a coupon. Every field is optional: a field left
// undefined keeps its current value. The code, type, and value are immutable
// once created - a different discount is a different coupon. Returns the
// updated row, or null when no coupon has that id.
async function update(id, fields, client) {
  const f = fields || {};
  return queryOne(
    'UPDATE coupons SET ' +
      '  is_active = COALESCE($2, is_active), ' +
      '  max_redemptions = CASE WHEN $3::boolean THEN $4 ELSE max_redemptions END, ' +
      '  per_user_limit = COALESCE($5, per_user_limit), ' +
      '  min_subtotal_cents = COALESCE($6, min_subtotal_cents), ' +
      '  expires_at = CASE WHEN $7::boolean THEN $8 ELSE expires_at END, ' +
      '  description = CASE WHEN $9::boolean THEN $10 ELSE description END ' +
      'WHERE id = $1 ' +
      'RETURNING ' + COLUMNS,
    [
      id,
      typeof f.isActive === 'boolean' ? f.isActive : null,
      // maxRedemptions and expiresAt may legitimately be set to NULL (unlimited
      // / open-ended), so a separate "was it provided" flag drives the CASE.
      Object.prototype.hasOwnProperty.call(f, 'maxRedemptions'),
      Number.isInteger(f.maxRedemptions) ? f.maxRedemptions : null,
      Number.isInteger(f.perUserLimit) ? f.perUserLimit : null,
      Number.isInteger(f.minSubtotalCents) ? f.minSubtotalCents : null,
      Object.prototype.hasOwnProperty.call(f, 'expiresAt'),
      f.expiresAt || null,
      Object.prototype.hasOwnProperty.call(f, 'description'),
      f.description || null,
    ],
    client
  );
}

// Claim a redemption slot and write the ledger row, as one unit.
//
// The redemption_count increment is guarded: it applies only while the coupon
// is active and below its global cap, so a coupon on its last slot can be
// redeemed exactly once even under concurrent checkouts. When the guarded
// UPDATE matches nothing - the coupon was exhausted or deactivated by a
// concurrent request - this returns null and writes no ledger row; the caller
// rolls the checkout back.
//
// `client` is required: this must run inside the checkout transaction so the
// redemption commits atomically with the subscription and transaction.
async function recordRedemption(data, client) {
  const claimed = await queryOne(
    'UPDATE coupons SET redemption_count = redemption_count + 1 ' +
      'WHERE id = $1 AND is_active = TRUE ' +
      '  AND (max_redemptions IS NULL OR redemption_count < max_redemptions) ' +
      'RETURNING id',
    [data.couponId],
    client
  );
  if (!claimed) return null;

  return queryOne(
    'INSERT INTO coupon_redemptions ' +
      '(coupon_id, user_id, subscription_id, transaction_id, discount_cents) ' +
      'VALUES ($1, $2, $3, $4, $5) ' +
      'RETURNING id, coupon_id, user_id, subscription_id, transaction_id, ' +
      '  discount_cents, created_at',
    [
      data.couponId,
      data.userId,
      data.subscriptionId || null,
      data.transactionId || null,
      data.discountCents,
    ],
    client
  );
}

module.exports = {
  normalizeCode: normalizeCode,
  findByCode: findByCode,
  findById: findById,
  findAll: findAll,
  redemptionCountForUser: redemptionCountForUser,
  create: create,
  update: update,
  recordRedemption: recordRedemption,
};
