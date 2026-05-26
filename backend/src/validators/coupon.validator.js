'use strict';

// ============================================================================
// Coupon request schemas (Zod).
// ----------------------------------------------------------------------------
// validateCouponSchema  - POST /api/coupons/validate    (patient)
// createCouponSchema    - POST /api/admin/coupons       (staff)
// updateCouponSchema    - PATCH /api/admin/coupons/:id   (staff)
//
// A coupon's code, type, and value are immutable once created - a different
// discount is a different coupon - so the update schema omits them.
// ============================================================================

const { z } = require('zod');

// Mirror of the coupon_type enum in migration 0015.
const couponType = z.enum(['percent', 'fixed']);

// The code a patient types at checkout, or admin assigns. Case is irrelevant:
// the model uppercases it for storage and lookup.
const couponCode = z.string().trim().min(1).max(64);

// POST /api/coupons/validate - confirm a code before checkout.
const validateCouponSchema = z
  .object({
    code: couponCode,
  })
  .strict();

// POST /api/admin/coupons - create a coupon. `value` is range-checked against
// `type`: a percent coupon is 1..100, a fixed coupon is a positive cent amount
// capped at 100 000 cents ($1 000.00) to prevent runaway discounts.
const createCouponSchema = z
  .object({
    code: couponCode,
    type: couponType,
    value: z.number().int().positive(),
    maxRedemptions: z.number().int().positive().nullable().optional(),
    perUserLimit: z.number().int().positive().max(1000).optional(),
    minSubtotalCents: z.number().int().min(0).optional(),
    startsAt: z.string().datetime().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    isActive: z.boolean().optional(),
    description: z.string().trim().max(200).optional(),
  })
  .strict()
  .refine(
    function (data) {
      return data.type !== 'percent' || (data.value >= 1 && data.value <= 100);
    },
    {
      message: 'A percent coupon value must be between 1 and 100.',
      path: ['value'],
    }
  )
  .refine(
    function (data) {
      // B3-08: cap fixed coupon values so a data-entry error cannot create a
      // coupon that discounts an arbitrarily large amount. 100 000 cents =
      // $1 000.00; a legitimate single-order coupon should never exceed this.
      return data.type !== 'fixed' || data.value <= 100_000;
    },
    {
      message: 'A fixed coupon value may not exceed 100000 cents ($1,000.00).',
      path: ['value'],
    }
  );

// PATCH /api/admin/coupons/:couponId - update the mutable terms. Every field is
// optional; an omitted field keeps its current value.
const updateCouponSchema = z
  .object({
    isActive: z.boolean().optional(),
    maxRedemptions: z.number().int().positive().nullable().optional(),
    perUserLimit: z.number().int().positive().max(1000).optional(),
    minSubtotalCents: z.number().int().min(0).optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    description: z.string().trim().max(200).optional(),
  })
  .strict();

module.exports = {
  validateCouponSchema: validateCouponSchema,
  createCouponSchema: createCouponSchema,
  updateCouponSchema: updateCouponSchema,
};
