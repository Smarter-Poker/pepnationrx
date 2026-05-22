'use strict';

// ============================================================================
// Affiliate model - data-access layer for the affiliates table.
// ----------------------------------------------------------------------------
// An affiliate is a partner organization (a gym or clinic) that earns a
// tracked revenue share on the patients it refers. This model resolves the
// affiliate record for a logged-in affiliate user and backs the affiliate
// dashboard.
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, user_id, affiliate_code, organization_name, organization_type, ' +
  'revenue_share_pct, stripe_connect_account_id, is_active, ' +
  'created_at, updated_at';

// Find an affiliate by primary key.
async function findById(id) {
  return queryOne('SELECT ' + COLUMNS + ' FROM affiliates WHERE id = $1', [id]);
}

// Find the affiliate record owned by a given user, or null. Each affiliate
// row has a unique user_id, so this resolves the dashboard owner.
async function findByUserId(userId) {
  return queryOne('SELECT ' + COLUMNS + ' FROM affiliates WHERE user_id = $1', [userId]);
}

// Find an affiliate by its public referral code.
async function findByCode(affiliateCode) {
  return queryOne(
    'SELECT ' + COLUMNS + ' FROM affiliates WHERE affiliate_code = $1',
    [affiliateCode]
  );
}

// Every active affiliate. Used by the payout-run job to settle revenue share.
async function findAllActive() {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM affiliates WHERE is_active = TRUE ' +
      'ORDER BY created_at'
  );
  return result.rows;
}

module.exports = {
  findById: findById,
  findByUserId: findByUserId,
  findByCode: findByCode,
  findAllActive: findAllActive,
};
