'use strict';

// ============================================================================
// Unit tests for services/stripe/connect.js.
// ----------------------------------------------------------------------------
// Confirms the tri-party split math and the Stripe Connect parameter builders.
// The connect module loads config/env, so the test sets the minimum required
// environment before requiring it. Run with: npm test
// ============================================================================

process.env.NODE_ENV = 'development';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'b'.repeat(48);
process.env.PHI_ENCRYPTION_KEY =
  process.env.PHI_ENCRYPTION_KEY || 'c'.repeat(64);

const test = require('node:test');
const assert = require('node:assert/strict');

const connect = require('../../src/services/stripe/connect');

test('computeSplit returns a balanced breakdown', function () {
  const split = connect.computeSplit({
    grossAmountCents: 59700,
    consultFeeCents: 3900,
    managementFeeCents: 11940,
  });
  assert.equal(split.grossAmountCents, 59700);
  assert.equal(split.consultFeeCents, 3900);
  assert.equal(split.managementFeeCents, 11940);
  assert.equal(split.medicalRevenueCents, 59700 - 3900 - 11940);
});

test('computeSplit defaults missing fees to zero', function () {
  const split = connect.computeSplit({ grossAmountCents: 10000 });
  assert.equal(split.consultFeeCents, 0);
  assert.equal(split.managementFeeCents, 0);
  assert.equal(split.medicalRevenueCents, 10000);
});

test('computeSplit rejects a negative gross amount', function () {
  assert.throws(function () {
    connect.computeSplit({ grossAmountCents: -1 });
  });
});

test('computeSplit rejects fees that exceed the gross amount', function () {
  assert.throws(function () {
    connect.computeSplit({
      grossAmountCents: 1000,
      consultFeeCents: 800,
      managementFeeCents: 800,
    });
  });
});

test('buildConnectedPaymentIntent routes the application fee and merchant', function () {
  const intent = connect.buildConnectedPaymentIntent({
    grossAmountCents: 59700,
    consultFeeCents: 3900,
    managementFeeCents: 11940,
    merchantOfRecord: 'acct_medical_practice',
    userId: 'user-1',
    subscriptionId: 'sub-1',
  });
  assert.equal(intent.amount, 59700);
  assert.equal(intent.currency, 'usd');
  assert.equal(intent.application_fee_amount, 11940);
  assert.equal(intent.on_behalf_of, 'acct_medical_practice');
  assert.equal(intent.transfer_data.destination, 'acct_medical_practice');
});

test('buildProviderTransfer carries the consult fee to the provider', function () {
  const transfer = connect.buildProviderTransfer({
    grossAmountCents: 59700,
    consultFeeCents: 3900,
    managementFeeCents: 11940,
    providerAccountId: 'acct_provider',
  });
  assert.equal(transfer.amount, 3900);
  assert.equal(transfer.destination, 'acct_provider');
});
