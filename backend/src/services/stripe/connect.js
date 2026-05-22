'use strict';

// ============================================================================
// Stripe Connect - tri-party split routing logic.
// ----------------------------------------------------------------------------
// PepNationRX is the designated billing agent, not the merchant of record.
// Each charge is split three ways, mirroring the transactions table:
//   - the medical practice is the Merchant of Record and keeps the medical
//     revenue (gross minus the two fees below)
//   - the provider account receives the consult fee
//   - the PepNationRX LLC platform account receives the management fee
//
// This module computes and validates that split and builds the parameter
// objects for the Stripe Connect API. The live API call is made by the caller
// once a Stripe secret key is configured.
// ============================================================================

const config = require('../../config/env');
const { AppError } = require('../../utils/errors');

const settings = config.integrations.stripe;

// True when a Stripe secret key is configured.
function isConfigured() {
  return Boolean(settings.secretKey);
}

// Validate a tri-party split and return the full breakdown. Throws a 422
// AppError when any amount is negative or the fees exceed the gross amount,
// which mirrors the txn_amounts_nonneg and txn_split_balances checks in the
// database schema.
function computeSplit(input) {
  const gross = Number(input.grossAmountCents);
  const consultFee = Number(input.consultFeeCents) || 0;
  const managementFee = Number(input.managementFeeCents) || 0;

  if (!Number.isInteger(gross) || gross < 0) {
    throw new AppError(422, 'invalid_split', 'Gross amount must be a non-negative integer.');
  }
  // Fees must be whole cents: Stripe rejects fractional amounts, and the
  // transactions table stores integer cents.
  if (!Number.isInteger(consultFee) || !Number.isInteger(managementFee)) {
    throw new AppError(422, 'invalid_split', 'Fee amounts must be whole cents.');
  }
  if (consultFee < 0 || managementFee < 0) {
    throw new AppError(422, 'invalid_split', 'Fee amounts must not be negative.');
  }
  if (consultFee + managementFee > gross) {
    throw new AppError(
      422,
      'invalid_split',
      'The consult and management fees may not exceed the gross amount.'
    );
  }

  return {
    grossAmountCents: gross,
    consultFeeCents: consultFee,
    managementFeeCents: managementFee,
    medicalRevenueCents: gross - consultFee - managementFee,
  };
}

// Build the parameter object for a Stripe Connect PaymentIntent. The charge is
// taken on behalf of the medical practice (the Merchant of Record); the
// management fee is collected by the platform as the application fee.
function buildConnectedPaymentIntent(params) {
  const split = computeSplit(params);
  return {
    amount: split.grossAmountCents,
    currency: (params.currency || 'usd').toLowerCase(),
    customer: params.stripeCustomerId,
    on_behalf_of: params.merchantOfRecord,
    application_fee_amount: split.managementFeeCents,
    transfer_data: { destination: params.merchantOfRecord },
    metadata: {
      pepnationrx_user_id: params.userId || '',
      pepnationrx_subscription_id: params.subscriptionId || '',
      consult_fee_cents: String(split.consultFeeCents),
      management_fee_cents: String(split.managementFeeCents),
    },
  };
}

// Build the parameter object for the separate transfer of the consult fee to
// the provider's connected account.
function buildProviderTransfer(params) {
  const split = computeSplit(params);
  return {
    amount: split.consultFeeCents,
    currency: (params.currency || 'usd').toLowerCase(),
    destination: params.providerAccountId,
    metadata: {
      pepnationrx_user_id: params.userId || '',
      purpose: 'provider_consult_fee',
    },
  };
}

module.exports = {
  isConfigured: isConfigured,
  computeSplit: computeSplit,
  buildConnectedPaymentIntent: buildConnectedPaymentIntent,
  buildProviderTransfer: buildProviderTransfer,
};
