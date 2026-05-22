'use strict';

// ============================================================================
// Transaction model - data-access layer for the transactions table.
// ----------------------------------------------------------------------------
// A transaction is a Stripe Connect tri-party split charge. This model backs
// the billing history shown on the patient dashboard. Amounts are in cents.
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, user_id, subscription_id, stripe_payment_intent_id, stripe_charge_id, ' +
  'gross_amount_cents, consult_fee_cents, management_fee_cents, currency, ' +
  'status, processed_at, created_at, updated_at';

// Create a transaction. Checkout records the tri-party split before the Stripe
// charge settles, so the row starts in 'requires_payment'. merchant_of_record
// is the medical practice account (NOT NULL); providerAccountId and
// platformAccountId are the consult-fee and management-fee destinations and may
// be empty until the connected accounts are provisioned.
async function create(data) {
  return queryOne(
    'INSERT INTO transactions ' +
      '(user_id, subscription_id, merchant_of_record, provider_account_id, ' +
      ' platform_account_id, gross_amount_cents, consult_fee_cents, ' +
      ' management_fee_cents, currency, status) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ' +
      'RETURNING ' + COLUMNS,
    [
      data.userId,
      data.subscriptionId || null,
      data.merchantOfRecord,
      data.providerAccountId || null,
      data.platformAccountId || null,
      data.grossAmountCents,
      Number.isInteger(data.consultFeeCents) ? data.consultFeeCents : 0,
      Number.isInteger(data.managementFeeCents) ? data.managementFeeCents : 0,
      data.currency || 'USD',
      data.status || 'requires_payment',
    ]
  );
}

// Find a transaction by primary key.
async function findById(id) {
  return queryOne('SELECT ' + COLUMNS + ' FROM transactions WHERE id = $1', [id]);
}

// A patient's transactions, newest first, capped to a recent window.
async function findByUserId(userId, limit) {
  const cap = Number.isInteger(limit) && limit > 0 ? limit : 25;
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM transactions WHERE user_id = $1 ' +
      'ORDER BY created_at DESC LIMIT $2',
    [userId, cap]
  );
  return result.rows;
}

// Sum of the gross amount, in cents, a patient has been charged for
// successfully settled transactions.
async function lifetimeGrossCentsForUser(userId) {
  const row = await queryOne(
    "SELECT COALESCE(SUM(gross_amount_cents), 0)::bigint AS total " +
      "FROM transactions WHERE user_id = $1 AND status = 'succeeded'",
    [userId]
  );
  return row ? Number(row.total) : 0;
}

module.exports = {
  create: create,
  findById: findById,
  findByUserId: findByUserId,
  lifetimeGrossCentsForUser: lifetimeGrossCentsForUser,
};
