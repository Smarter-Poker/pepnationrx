'use strict';

// ============================================================================
// Membership service - PepNationRX Plus benefits and pricing.
// ----------------------------------------------------------------------------
// One place defines what a Plus membership costs and what it is worth: the
// per-period fee, the renewal cadence, and the discount applied to recurring
// plan pricing. Checkout calls resolvePlanPriceForUser() so a member is
// automatically charged the discounted price on the order and every renewal.
// ============================================================================

const membershipModel = require('../../models/membership.model');

// The only paid tier today.
const PLUS_TIER = 'plus';

// The membership fee charged per renewal period, in cents ($19.99 / month).
const MEMBERSHIP_PRICE_CENTS = 1999;

// Days between membership renewals.
const RENEWAL_INTERVAL_DAYS = 30;

// Percent off every recurring protocol plan for an active member.
const PLAN_DISCOUNT_PCT = 15;

// Apply the member plan discount to a base per-period price. Pure: rounds to
// the nearest whole cent and never returns a negative value.
function discountedPlanPriceCents(baseCents) {
  const base = Math.round(Number(baseCents) || 0);
  if (base <= 0) return 0;
  return Math.round((base * (100 - PLAN_DISCOUNT_PCT)) / 100);
}

// Resolve the price a given user pays for a plan: the member-discounted price
// when they hold an active membership, otherwise the base price unchanged.
// Returns { effectiveCents, baseCents, memberDiscountApplied }.
async function resolvePlanPriceForUser(baseCents, userId) {
  const base = Math.round(Number(baseCents) || 0);
  const membership = await membershipModel.findActiveByUserId(userId);
  if (!membership) {
    return {
      effectiveCents: base,
      baseCents: base,
      memberDiscountApplied: false,
    };
  }
  return {
    effectiveCents: discountedPlanPriceCents(base),
    baseCents: base,
    memberDiscountApplied: true,
  };
}

// Whether a user's clinical work should be flagged for priority review. True
// for any active member; the medical-network layer consumes this flag once
// that integration is live.
async function hasPriorityReview(userId) {
  const membership = await membershipModel.findActiveByUserId(userId);
  return Boolean(membership);
}

module.exports = {
  PLUS_TIER: PLUS_TIER,
  MEMBERSHIP_PRICE_CENTS: MEMBERSHIP_PRICE_CENTS,
  RENEWAL_INTERVAL_DAYS: RENEWAL_INTERVAL_DAYS,
  PLAN_DISCOUNT_PCT: PLAN_DISCOUNT_PCT,
  discountedPlanPriceCents: discountedPlanPriceCents,
  resolvePlanPriceForUser: resolvePlanPriceForUser,
  hasPriorityReview: hasPriorityReview,
};
