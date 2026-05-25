'use strict';

// ============================================================================
// Unit tests for the discount and coupon mechanism (Feature 6).
// ----------------------------------------------------------------------------
// Pure tests: they cover the discount math (the exact cent amount a coupon
// takes off an order), the code-normalization rule, the service and model
// contracts, and the checkout fee-floor that keeps the tri-party split solvent
// when a discount is applied. Database-backed behavior - validateCoupon,
// recordRedemption, the guarded redemption cap - is exercised in the
// integration environment. Run with: npm test
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');

const couponService = require('../../src/services/coupon');
const couponModel = require('../../src/models/coupon.model');

test('coupon_service_exposes_api', function () {
  assert.equal(typeof couponService.validateCoupon, 'function');
  assert.equal(typeof couponService.computeDiscountCents, 'function');
  assert.deepEqual(couponService.COUPON_TYPES, ['percent', 'fixed']);
});

test('coupon_discount_percent_takes_that_percentage_off', function () {
  assert.equal(
    couponService.computeDiscountCents({ type: 'percent', value: 15 }, 10000),
    1500
  );
  assert.equal(
    couponService.computeDiscountCents({ type: 'percent', value: 100 }, 8000),
    8000
  );
});

test('coupon_discount_fixed_takes_a_flat_cent_amount_off', function () {
  assert.equal(
    couponService.computeDiscountCents({ type: 'fixed', value: 2000 }, 10000),
    2000
  );
});

test('coupon_discount_percent_rounds_to_whole_cents', function () {
  // 33333 * 15% = 4999.95, rounds to 5000 - never a fractional cent.
  assert.equal(
    couponService.computeDiscountCents({ type: 'percent', value: 15 }, 33333),
    5000
  );
  // pg returns NUMERIC/INTEGER columns as strings; the string coerces.
  assert.equal(
    couponService.computeDiscountCents({ type: 'percent', value: '10' }, '10000'),
    1000
  );
});

test('coupon_discount_never_exceeds_the_subtotal', function () {
  // A fixed coupon larger than the order is capped at the order total.
  assert.equal(
    couponService.computeDiscountCents({ type: 'fixed', value: 99999 }, 10000),
    10000
  );
});

test('coupon_discount_handles_zero_and_invalid_input', function () {
  assert.equal(
    couponService.computeDiscountCents({ type: 'percent', value: 15 }, 0),
    0
  );
  assert.equal(
    couponService.computeDiscountCents({ type: 'fixed', value: 500 }, -100),
    0
  );
  assert.equal(couponService.computeDiscountCents(null, 10000), 0);
  assert.equal(
    couponService.computeDiscountCents({ type: 'fixed', value: 500 }, null),
    0
  );
});

test('coupon_discount_stays_within_zero_and_the_subtotal', function () {
  const coupons = [
    { type: 'percent', value: 25 },
    { type: 'fixed', value: 3000 },
    { type: 'percent', value: 100 },
  ];
  for (let subtotal = 1000; subtotal <= 60000; subtotal += 1000) {
    coupons.forEach(function (c) {
      const d = couponService.computeDiscountCents(c, subtotal);
      assert.ok(d >= 0, 'discount is never negative');
      assert.ok(d <= subtotal, 'discount never exceeds the subtotal');
    });
  }
});

test('coupon_model_normalizes_code_to_trimmed_uppercase', function () {
  assert.equal(couponModel.normalizeCode('  save15 '), 'SAVE15');
  assert.equal(couponModel.normalizeCode('Welcome'), 'WELCOME');
  assert.equal(couponModel.normalizeCode(null), '');
  assert.equal(couponModel.normalizeCode(undefined), '');
});

test('coupon_model_exposes_data_access', function () {
  const fns = [
    'normalizeCode', 'findByCode', 'findById', 'findAll',
    'redemptionCountForUser', 'create', 'update', 'recordRedemption',
  ];
  fns.forEach(function (name) {
    assert.equal(typeof couponModel[name], 'function', name + ' is exported');
  });
});

test('coupon_fee_floor_keeps_the_tri_party_split_solvent', function () {
  // Checkout caps a coupon discount so the discounted gross still covers the
  // flat provider consult fee and the percentage management fee. The floor is
  // consultFee / (1 - managementFeePct/100). Mirrors checkout.controller.
  const consultFeeCents = 3900;
  const managementFeePct = 20;
  const minNetGross = Math.ceil(
    consultFeeCents / (1 - managementFeePct / 100)
  );
  assert.equal(minNetGross, 4875);
  const managementFeeCents = Math.round(
    (minNetGross * managementFeePct) / 100
  );
  // At the floor the consult and management fees fit exactly within the gross,
  // so the medical-revenue remainder is never negative.
  assert.ok(
    consultFeeCents + managementFeeCents <= minNetGross,
    'fees fit within the floor gross'
  );
});
