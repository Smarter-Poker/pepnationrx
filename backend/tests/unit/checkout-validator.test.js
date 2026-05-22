'use strict';

// ============================================================================
// Unit tests for validators/checkout.validator.js.
// ----------------------------------------------------------------------------
// Confirms the checkout schema accepts a well-formed order and rejects the
// malformed shapes the controller must never see. The schema is the first
// line of the server-authoritative pricing fix: it requires a treatmentSlug
// and refuses any client-supplied price field. Run with: npm test
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');

const { checkoutSchema } = require('../../src/validators/checkout.validator');

// A minimal valid checkout body, cloned per test so mutations do not leak.
function validOrder() {
  return {
    protocolCategory: 'peptide_therapy',
    treatmentSlug: 'bpc-157',
    cadenceMonths: 3,
    shippingAddress: {
      line1: '1 Test Street',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
    },
    consents: [
      {
        consentType: 'mso_billing_agent',
        documentVersion: '2026-05-checkout-v1',
        accepted: true,
      },
      {
        consentType: 'telehealth_informed_consent',
        documentVersion: '2026-05-checkout-v1',
        accepted: true,
      },
    ],
  };
}

test('checkout_schema_well_formed_body_is_accepted', function () {
  const result = checkoutSchema.safeParse(validOrder());
  assert.equal(result.success, true);
});

test('checkout_schema_unknown_protocol_category_is_rejected', function () {
  const order = validOrder();
  order.protocolCategory = 'not_a_category';
  assert.equal(checkoutSchema.safeParse(order).success, false);
});

test('checkout_schema_non_standard_cadence_is_rejected', function () {
  const order = validOrder();
  order.cadenceMonths = 4;
  assert.equal(checkoutSchema.safeParse(order).success, false);
});

test('checkout_schema_missing_treatment_slug_is_rejected', function () {
  const order = validOrder();
  delete order.treatmentSlug;
  assert.equal(checkoutSchema.safeParse(order).success, false);
});

test('checkout_schema_client_supplied_price_is_rejected', function () {
  // The price is server-authoritative: a client price field must not be
  // accepted, even with an otherwise valid body. (Regression: a patient
  // could previously set their own pricePerMonthCents.)
  const withPrice = validOrder();
  withPrice.pricePerMonthCents = 1;
  assert.equal(checkoutSchema.safeParse(withPrice).success, false);

  const withPlanName = validOrder();
  withPlanName.planName = 'Smuggled Plan';
  assert.equal(checkoutSchema.safeParse(withPlanName).success, false);
});

test('checkout_schema_empty_consents_array_is_rejected', function () {
  const order = validOrder();
  order.consents = [];
  assert.equal(checkoutSchema.safeParse(order).success, false);
});

test('checkout_schema_both_address_forms_is_rejected', function () {
  const order = validOrder();
  order.shippingAddressId = '11111111-1111-1111-1111-111111111111';
  assert.equal(checkoutSchema.safeParse(order).success, false);
});

test('checkout_schema_unknown_top_level_key_is_rejected', function () {
  const order = validOrder();
  order.injectedField = 'unexpected';
  assert.equal(checkoutSchema.safeParse(order).success, false);
});

test('checkout_schema_non_two_letter_state_is_rejected', function () {
  const order = validOrder();
  order.shippingAddress.state = 'Texas';
  assert.equal(checkoutSchema.safeParse(order).success, false);
});
