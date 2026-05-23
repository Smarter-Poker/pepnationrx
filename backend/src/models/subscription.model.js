'use strict';

// ============================================================================
// Subscription model - data-access layer for the subscriptions table.
// ----------------------------------------------------------------------------
// A subscription is an active recurring protocol. Monthly recurring revenue is
// stored in cents (mrr_cents) to avoid floating-point drift. This model backs
// both the patient dashboard (a patient's own subscriptions) and the affiliate
// dashboard (revenue attributed to an affiliate).
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, user_id, protocol_category, plan_name, status, stripe_subscription_id, ' +
  'mrr_cents, currency, refill_count, refills_remaining, current_period_start, ' +
  'current_period_end, next_billing_date, affiliate_id, ' +
  'started_at, paused_at, canceled_at, created_at, updated_at';
  // Note: treatment_plan_id and intake_submission_id are not yet in the DB
  // schema. Add them via migration before selecting them here.

// Subscription statuses that count as live revenue.
const ACTIVE_STATUSES = ['trialing', 'active', 'past_due'];

// Create a subscription. Checkout creates the row in 'pending_clinical_review':
// a recurring protocol is not live revenue until a licensed provider has
// reviewed the patient's intake. mrr_cents is the per-month price; affiliateId
// and treatmentPlanId are optional. status defaults to 'pending_clinical_review'
// and may be overridden only with another subscription_status enum value. An
// optional `client` runs the insert inside an open transaction (checkout pairs
// it with the consent, address, and transaction inserts as one unit).
async function create(data, client) {
  return queryOne(
    'INSERT INTO subscriptions ' +
      '(user_id, protocol_category, plan_name, status, mrr_cents, currency, ' +
      ' refill_count, refills_remaining, next_billing_date, affiliate_id) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ' +
      'RETURNING ' + COLUMNS,
    [
      data.userId,
      data.protocolCategory,
      data.planName,
      data.status || 'pending_clinical_review',
      data.mrrCents,
      data.currency || 'USD',
      Number.isInteger(data.refillCount) ? data.refillCount : 0,
      Number.isInteger(data.refillsRemaining) ? data.refillsRemaining : 0,
      data.nextBillingDate || null,
      data.affiliateId || null,
    ],
    client
  );
}

// Find a subscription by primary key.
async function findById(id) {
  return queryOne('SELECT ' + COLUMNS + ' FROM subscriptions WHERE id = $1', [id]);
}

// All subscriptions for a patient, newest first.
async function findByUserId(userId) {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM subscriptions WHERE user_id = $1 ' +
      'ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

// All subscriptions attributed to an affiliate, newest first.
async function findByAffiliateId(affiliateId) {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM subscriptions WHERE affiliate_id = $1 ' +
      'ORDER BY created_at DESC',
    [affiliateId]
  );
  return result.rows;
}

// Sum the monthly recurring revenue, in cents, of an affiliate's currently
// active subscriptions. Returns 0 when the affiliate has none.
async function activeMrrCentsForAffiliate(affiliateId) {
  const row = await queryOne(
    'SELECT COALESCE(SUM(mrr_cents), 0)::bigint AS total ' +
      'FROM subscriptions ' +
      'WHERE affiliate_id = $1 AND status = ANY($2)',
    [affiliateId, ACTIVE_STATUSES]
  );
  return row ? Number(row.total) : 0;
}

// All subscriptions currently in an active billing state. Used by the
// refill-reminders job to decide which patients need a check-in scheduled.
async function findActive() {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM subscriptions WHERE status = ANY($1) ' +
      'ORDER BY created_at',
    [ACTIVE_STATUSES]
  );
  return result.rows;
}

// Subscriptions whose next billing date has arrived. Used by the billing
// sweep. asOfDate is an ISO date string (YYYY-MM-DD).
async function findDueForBilling(asOfDate) {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM subscriptions ' +
      "WHERE status = 'active' AND next_billing_date IS NOT NULL " +
      'AND next_billing_date <= $1 ORDER BY next_billing_date',
    [asOfDate]
  );
  return result.rows;
}

// Move a subscription's next billing date forward after a successful renewal.
async function advanceBillingDate(id, nextBillingDate) {
  await query('UPDATE subscriptions SET next_billing_date = $2 WHERE id = $1', [
    id,
    nextBillingDate,
  ]);
}

// Flag a subscription past due after a failed renewal charge.
async function markPastDue(id) {
  await query(
    "UPDATE subscriptions SET status = 'past_due' WHERE id = $1 AND status = 'active'",
    [id]
  );
}

// Cancel a subscription. A no-op (returns null) when the subscription is
// already canceled or expired, letting the caller decide how to surface that.
async function cancel(subscriptionId, client) {
  return queryOne(
    'UPDATE subscriptions SET status = $1, canceled_at = now(), updated_at = now() ' +
      'WHERE id = $2 AND status NOT IN ($3, $4) ' +
      'RETURNING ' + COLUMNS,
    ['canceled', subscriptionId, 'canceled', 'expired'],
    client
  );
}

module.exports = {
  ACTIVE_STATUSES: ACTIVE_STATUSES,
  create: create,
  findById: findById,
  findByUserId: findByUserId,
  findByAffiliateId: findByAffiliateId,
  activeMrrCentsForAffiliate: activeMrrCentsForAffiliate,
  findActive: findActive,
  findDueForBilling: findDueForBilling,
  advanceBillingDate: advanceBillingDate,
  markPastDue: markPastDue,
  cancel: cancel,
};
