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

// Record a referral landing: a visit through an affiliate's /?ref= link,
// before the visitor has registered or converted. referred_user_id,
// subscription_id, and converted_at stay null until the referral converts.
// landed_at defaults to now(). Returns the created row.
async function recordLanding(data) {
  return queryOne(
    'INSERT INTO affiliate_referrals (affiliate_id, referral_link_slug) ' +
      'VALUES ($1, $2) RETURNING ' + COLUMNS,
    [data.affiliateId, data.referralLinkSlug]
  );
}

// Mark a landed referral converted: the referred patient has subscribed.
// Only a still-unconverted row belonging to the named affiliate is updated,
// so a replay - or a referral id that does not match this affiliate - is a
// no-op. Returns the updated row, or null when nothing matched. An optional
// `client` runs the update inside an open transaction.
async function markConverted(id, data, client) {
  return queryOne(
    'UPDATE affiliate_referrals ' +
      'SET converted_at = now(), referred_user_id = $2, subscription_id = $3 ' +
      'WHERE id = $1 AND affiliate_id = $4 AND converted_at IS NULL ' +
      'RETURNING ' + COLUMNS,
    [id, data.referredUserId || null, data.subscriptionId || null, data.affiliateId],
    client
  );
}

// Record a referral that converted with no tracked landing: a patient who
// entered an affiliate code directly at checkout. landed_at and converted_at
// are both stamped now. An optional `client` runs the insert in a transaction.
async function recordDirectConversion(data, client) {
  return queryOne(
    'INSERT INTO affiliate_referrals ' +
      '(affiliate_id, referred_user_id, subscription_id, referral_link_slug, ' +
      ' converted_at) ' +
      'VALUES ($1, $2, $3, $4, now()) RETURNING ' + COLUMNS,
    [
      data.affiliateId,
      data.referredUserId || null,
      data.subscriptionId || null,
      data.referralLinkSlug,
    ],
    client
  );
}

module.exports = {
  findByAffiliateId: findByAffiliateId,
  countsForAffiliate: countsForAffiliate,
  recordLanding: recordLanding,
  markConverted: markConverted,
  recordDirectConversion: recordDirectConversion,
};
