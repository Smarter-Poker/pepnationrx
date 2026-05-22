'use strict';

// ============================================================================
// Stripe recurring billing management.
// ----------------------------------------------------------------------------
// Builds the parameter objects for Stripe Connect subscriptions and maps
// Stripe subscription statuses onto the subscription_status enum used in the
// database. The live API call is made by the caller once Stripe is configured.
// ============================================================================

const { AppError } = require('../../utils/errors');

// Build the parameter object for a Stripe Connect subscription. The recurring
// charge runs on behalf of the medical practice; the platform collects its
// management share via application_fee_percent.
function buildSubscriptionParams(params) {
  if (!params.stripeCustomerId || !params.stripePriceId) {
    throw new AppError(
      422,
      'invalid_subscription',
      'A Stripe customer and price are required to start a subscription.'
    );
  }
  return {
    customer: params.stripeCustomerId,
    items: [{ price: params.stripePriceId }],
    on_behalf_of: params.merchantOfRecord,
    transfer_data: { destination: params.merchantOfRecord },
    application_fee_percent: params.managementFeePercent || 0,
    metadata: {
      pepnationrx_user_id: params.userId || '',
      pepnationrx_treatment_plan_id: params.treatmentPlanId || '',
      cadence_months: String(params.cadenceMonths || 1),
    },
  };
}

// Translate a Stripe subscription status onto the subscription_status enum.
// Unknown values fall back to 'pending_clinical_review' so a subscription is
// never assumed active without an explicit signal.
function mapStripeStatusToSubscriptionStatus(stripeStatus) {
  const map = {
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    unpaid: 'past_due',
    canceled: 'canceled',
    paused: 'paused',
    incomplete: 'pending_clinical_review',
    incomplete_expired: 'expired',
  };
  return map[stripeStatus] || 'pending_clinical_review';
}

// Derive the monthly recurring revenue contribution of a plan, in cents.
// price_cents in the catalog is already a per-month figure.
function monthlyRecurringRevenueCents(planPriceCents) {
  const value = Number(planPriceCents);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

module.exports = {
  buildSubscriptionParams: buildSubscriptionParams,
  mapStripeStatusToSubscriptionStatus: mapStripeStatusToSubscriptionStatus,
  monthlyRecurringRevenueCents: monthlyRecurringRevenueCents,
};
