'use strict';

// ============================================================================
// Coupon routes: validate a discount code.
// The endpoint requires a valid access token - the per-user redemption limit
// is checked against the authenticated patient, so an anonymous validate would
// be meaningless. Admin coupon management lives under /api/admin/coupons.
// ============================================================================

const express = require('express');

const couponController = require('../controllers/coupon.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { validateCouponSchema } = require('../validators/coupon.validator');

const router = express.Router();

// Confirm a coupon code is usable by the authenticated patient before they
// reach checkout.
router.post(
  '/validate',
  authenticate,
  validate(validateCouponSchema),
  couponController.validateCoupon
);

module.exports = router;
