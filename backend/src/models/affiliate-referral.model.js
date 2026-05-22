'use strict';

// ============================================================================
// Affiliate referral model - data-access layer for the affiliate_referrals
// table.
// ----------------------------------------------------------------------------
// A referral row records a landing through an affiliate's link and, once the
// referred patient subscribes, the conversion. converted_at is null until the
// referral converts. This model backs the referral list and the funnel
// counts on the affiliate dashboard.
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, affiliate_id, referred_user_id, subscription_id, referral_link_slug, ' +
  'landed_at, converted_at, created_at';

// All referrals for an affiliate, newest first, capped to a recent window.
async function findByAffiliateId(affiliateId, limit) {
  const cap = Number.isInteger(limit) && limit > 0 ? limit : 50;
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM affiliate_referrals WHERE affiliate_id = $1 ' +
      'ORDER BY landed_at DESC LIMIT $2',
    [affiliateId, cap]
  );
  return result.rows;
}

// Funnel counts for an affiliate: total landings and converted referrals.
async function countsForAffiliate(affiliateId) {
  const row = await queryOne(
    'SELECT ' +
      'COUNT(*)::int AS landed, ' +
      'COUNT(converted_at)::int AS converted ' +
      'FROM affiliate_referrals WHERE affiliate_id = $1',
    [affiliateId]
  );
  return {
    landed: row ? row.landed : 0,
    converted: row ? row.converted : 0,
  };
}

module.exports = {
  findByAffiliateId: findByAffiliateId,
  countsForAffiliate: countsForAffiliate,
};
