'use strict';

// ============================================================================
// Stripe affiliate payouts.
// ----------------------------------------------------------------------------
// Computes the tracked revenue-share owed to an affiliate (a partner gym or
// clinic) and builds the Stripe transfer parameters that move it to the
// affiliate's connected account. Amounts are always whole cents; fractional
// cents are rounded down so a payout never exceeds the share that was earned.
// ============================================================================

const { AppError } = require('../../utils/errors');

// Compute an affiliate payout in cents from the revenue attributed to that
// affiliate and their revenue_share_pct. Throws a 422 AppError when the
// percentage is outside the 0 to 100 range allowed by the affiliates table.
function computePayoutCents(grossRevenueCents, revenueSharePct) {
  const gross = Number(grossRevenueCents);
  const pct = Number(revenueSharePct);

  if (!Number.isInteger(gross) || gross < 0) {
    throw new AppError(422, 'invalid_payout', 'Revenue must be a non-negative integer.');
  }
  if (Number.isNaN(pct) || pct < 0 || pct > 100) {
    throw new AppError(422, 'invalid_payout', 'Revenue share must be between 0 and 100.');
  }
  // Round down so the platform never pays out more than was earned.
  return Math.floor((gross * pct) / 100);
}

// Build the parameter object for a Stripe transfer of an affiliate payout to
// the affiliate's connected account.
function buildAffiliateTransfer(params) {
  if (!params.affiliateStripeAccountId) {
    throw new AppError(
      422,
      'invalid_payout',
      'The affiliate has no connected Stripe account.'
    );
  }
  const amount = Number(params.amountCents);
  if (!Number.isInteger(amount) || amount < 0) {
    throw new AppError(422, 'invalid_payout', 'Payout amount must be a non-negative integer.');
  }
  return {
    amount: amount,
    currency: (params.currency || 'usd').toLowerCase(),
    destination: params.affiliateStripeAccountId,
    metadata: {
      pepnationrx_affiliate_id: params.affiliateId || '',
      period_start: params.periodStart || '',
      period_end: params.periodEnd || '',
      purpose: 'affiliate_revenue_share',
    },
  };
}

module.exports = {
  computePayoutCents: computePayoutCents,
  buildAffiliateTransfer: buildAffiliateTransfer,
};
