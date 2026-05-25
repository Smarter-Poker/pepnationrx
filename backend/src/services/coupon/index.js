'use strict';

// ============================================================================
// Coupon service - discount validation and math.
// ----------------------------------------------------------------------------
// One place decides whether a coupon code may be redeemed and how large a
// discount it produces. The patient-facing validate endpoint and the checkout
// controller both call validateCoupon(); checkout additionally calls
// computeDiscountCents() to turn the validated coupon into a cent amount.
//
// validateCoupon performs the advisory checks (active, in window, caps not yet
// reached). The authoritative global-cap check is the guarded UPDATE in
// coupon.model.recordRedemption, which runs inside the checkout transaction -
// so a coupon validated here can still be rejected at redemption if its last
// slot was claimed concurrently, and the checkout rolls back cleanly.
// ============================================================================

const couponModel = require('../../models/coupon.model');
const errors = require('../../utils/errors');

// Mirror of the coupon_type enum in migration 0015.
const COUPON_TYPES = Object.freeze(['percent', 'fixed']);

// Resolve and validate a coupon code for a given patient. Returns the coupon
// row when the code may be redeemed; otherwise throws a typed AppError the
// route layer renders directly.
async function validateCoupon(code, userId) {
  const trimmed = typeof code === 'string' ? code.trim() : '';
  if (trimmed === '') {
    throw errors.badRequest('A Coupon Code Is Required.');
  }

  const coupon = await couponModel.findByCode(trimmed);
  if (!coupon) {
    throw errors.notFound('That Coupon Code Was Not Recognized.');
  }
  if (coupon.is_active !== true) {
    throw errors.unprocessable('That Coupon Code Is No Longer Active.');
  }

  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    throw errors.unprocessable('That Coupon Code Is Not Yet Available.');
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now) {
    throw errors.unprocessable('That Coupon Code Has Expired.');
  }

  if (
    coupon.max_redemptions != null &&
    coupon.redemption_count >= coupon.max_redemptions
  ) {
    throw errors.conflict(
      'That Coupon Code Has Reached Its Redemption Limit.'
    );
  }

  const usedByUser = await couponModel.redemptionCountForUser(
    coupon.id,
    userId
  );
  if (usedByUser >= coupon.per_user_limit) {
    throw errors.conflict('You Have Already Used That Coupon Code.');
  }

  return coupon;
}

// Compute the discount, in cents, a coupon applies to an order subtotal. Pure:
// rounds to whole cents and never returns more than the subtotal or less than
// zero. A percent coupon takes that percentage off; a fixed coupon takes its
// flat cent value off, capped so it cannot exceed the order.
function computeDiscountCents(coupon, subtotalCents) {
  const subtotal = Math.round(Number(subtotalCents) || 0);
  if (subtotal <= 0 || !coupon) return 0;

  let discount;
  if (coupon.type === 'percent') {
    discount = Math.round((subtotal * Number(coupon.value)) / 100);
  } else {
    discount = Math.round(Number(coupon.value) || 0);
  }

  if (!Number.isFinite(discount) || discount <= 0) return 0;
  return Math.min(discount, subtotal);
}

module.exports = {
  COUPON_TYPES: COUPON_TYPES,
  validateCoupon: validateCoupon,
  computeDiscountCents: computeDiscountCents,
};
