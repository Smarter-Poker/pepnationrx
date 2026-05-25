'use strict';

// ============================================================================
// Unit tests for the PepNationRX Plus membership (Feature 5).
// ----------------------------------------------------------------------------
// Pure tests: they cover the member plan-price resolution (the exact discount
// checkout applies), the membership pricing constants, and the model contract.
// Database-backed behavior - enroll, cancel, renewal - is exercised in the
// integration environment; the discount math below is the value-bearing,
// fully testable core. Run with: npm test
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');

const membershipService = require('../../src/services/membership');
const membershipModel = require('../../src/models/membership.model');

test('membership_service_pricing_constants', function () {
  assert.equal(membershipService.PLUS_TIER, 'plus');
  assert.equal(membershipService.PLAN_DISCOUNT_PCT, 15);
  assert.equal(membershipService.MEMBERSHIP_PRICE_CENTS, 1999);
  assert.equal(membershipService.RENEWAL_INTERVAL_DAYS, 30);
});

test('membership_discount_applies_fifteen_percent', function () {
  // The exact member price checkout charges: 15% off the base per-month price.
  assert.equal(membershipService.discountedPlanPriceCents(10000), 8500);
  assert.equal(membershipService.discountedPlanPriceCents(20000), 17000);
});

test('membership_discount_rounds_to_whole_cents', function () {
  // 9999 * 0.85 = 8499.15, rounds to 8499 - never a fractional cent.
  assert.equal(membershipService.discountedPlanPriceCents(9999), 8499);
  // pg returns NUMERIC columns as strings; the string is coerced.
  assert.equal(membershipService.discountedPlanPriceCents('10000'), 8500);
});

test('membership_discount_handles_zero_and_invalid_input', function () {
  assert.equal(membershipService.discountedPlanPriceCents(0), 0);
  assert.equal(membershipService.discountedPlanPriceCents(-100), 0);
  assert.equal(membershipService.discountedPlanPriceCents(null), 0);
  assert.equal(membershipService.discountedPlanPriceCents(undefined), 0);
});

test('membership_discount_is_always_below_base_and_positive', function () {
  for (let base = 1000; base <= 50000; base += 1000) {
    const discounted = membershipService.discountedPlanPriceCents(base);
    assert.ok(discounted < base, base + ' discounts below the base price');
    assert.ok(discounted > 0, base + ' stays a positive price');
  }
});

test('membership_service_exposes_pricing_resolution', function () {
  assert.equal(typeof membershipService.resolvePlanPriceForUser, 'function');
  assert.equal(typeof membershipService.hasPriorityReview, 'function');
});

test('membership_model_exposes_lifecycle_operations', function () {
  const fns = [
    'create', 'findById', 'findActiveByUserId', 'findByUserId',
    'cancel', 'renew', 'findPerks',
  ];
  fns.forEach(function (name) {
    assert.equal(typeof membershipModel[name], 'function', name + ' is exported');
  });
});
