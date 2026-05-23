'use strict';

// ============================================================================
// Affiliate payout model - data-access layer for the affiliate_payouts table.
// ----------------------------------------------------------------------------
// A payout row is a periodic settlement of an affiliate's tracked revenue
// share. This model backs the payout ledger and the paid / pending totals on
// the affiliate dashboard. Amounts are in cents.
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, affiliate_id, period_start, period_end, amount_cents, currency, ' +
  'status, stripe_transfer_id, paid_at, created_at, updated_at';

// All payouts for an affiliate, newest period first.
async function findByAffiliateId(affiliateId) {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM affiliate_payouts WHERE affiliate_id = $1 ' +
      'ORDER BY period_end DESC',
    [affiliateId]
  );
  return result.rows;
}

// Paid and pending payout totals, in cents, for an affiliate. "Paid" is
// status 'paid'. "Pending" is money genuinely still on its way - status
// 'pending' or 'scheduled'. A 'failed' payout is neither paid nor pending:
// it is excluded from both totals and surfaces only as a row in the payout
// ledger, so a failed transfer is never miscounted as money owed-and-coming.
async function totalsForAffiliate(affiliateId) {
  const row = await queryOne(
    "SELECT " +
      "COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0)::bigint AS paid, " +
      "COALESCE(SUM(amount_cents) FILTER (WHERE status IN ('pending', 'scheduled')), 0)::bigint AS pending " +
      'FROM affiliate_payouts WHERE affiliate_id = $1',
    [affiliateId]
  );
  return {
    paidCents: row ? Number(row.paid) : 0,
    pendingCents: row ? Number(row.pending) : 0,
  };
}

// True when a payout already covers an affiliate's exact settlement period.
// The payout-run job uses this to avoid issuing a period's payout twice.
async function existsForPeriod(affiliateId, periodStart, periodEnd) {
  const row = await queryOne(
    'SELECT 1 AS present FROM affiliate_payouts ' +
      'WHERE affiliate_id = $1 AND period_start = $2 AND period_end = $3 LIMIT 1',
    [affiliateId, periodStart, periodEnd]
  );
  return row !== null;
}

// Insert a payout in the 'pending' state. period_start / period_end are ISO
// date strings (YYYY-MM-DD); amount_cents is a non-negative integer.
//
// The ON CONFLICT clause relies on the affiliate_payouts_period_unique
// constraint (migration 0002): if a payout for this affiliate and period
// already exists, the insert is a no-op and this returns null. Callers must
// treat a null return as "already settled", not as an error.
async function create(data) {
  return queryOne(
    'INSERT INTO affiliate_payouts ' +
      '(affiliate_id, period_start, period_end, amount_cents, currency, status) ' +
      "VALUES ($1, $2, $3, $4, $5, 'pending') " +
      'ON CONFLICT (affiliate_id, period_start, period_end) DO NOTHING ' +
      'RETURNING ' + COLUMNS,
    [
      data.affiliateId,
      data.periodStart,
      data.periodEnd,
      data.amountCents,
      data.currency || 'USD',
    ]
  );
}

module.exports = {
  findByAffiliateId: findByAffiliateId,
  totalsForAffiliate: totalsForAffiliate,
  existsForPeriod: existsForPeriod,
  create: create,
};
