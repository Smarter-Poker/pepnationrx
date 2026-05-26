'use strict';

// ============================================================================
// Coupon controller - discount codes.
// ----------------------------------------------------------------------------
// Two surfaces share the coupon model:
//   - Patient side  (POST /api/coupons/validate) - confirm a code is good
//     before checkout, so the patient sees the discount terms up front.
//   - Admin side    (/api/admin/coupons/*)        - the staff coupon panel:
//     list every coupon, create one, update its mutable terms.
//
// The actual money math - turning a validated coupon into a cent discount and
// recording the redemption - happens in the checkout controller, where the
// order subtotal is known. This controller only manages the coupon record and
// answers "is this code usable".
// ============================================================================

const couponModel = require('../models/coupon.model');
const couponService = require('../services/coupon');
const audit = require('../services/audit.service');
const errors = require('../utils/errors');

// Collect the non-PHI request metadata recorded on audit_log.
function requestMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') || null };
}

// Shape a coupon for the patient: only the terms a patient needs to see. The
// redemption counts and internal caps are never exposed on this surface.
function presentCouponPublic(row) {
  return {
    code: row.code,
    type: row.type,
    value: row.value,
    minSubtotalCents: row.min_subtotal_cents,
    description: row.description,
  };
}

// Shape a coupon for the admin panel: the full record.
function presentCouponAdmin(row) {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: row.value,
    maxRedemptions: row.max_redemptions,
    redemptionCount: row.redemption_count,
    perUserLimit: row.per_user_limit,
    minSubtotalCents: row.min_subtotal_cents,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// -- Patient surface ---------------------------------------------------------

// POST /api/coupons/validate
// Confirm a coupon code may be redeemed by the authenticated patient. The
// service throws a typed error when the code is unknown, inactive, outside its
// window, or already used up; on success the discount terms are returned.
async function validateCoupon(req, res, next) {
  try {
    const coupon = await couponService.validateCoupon(
      req.body.code,
      req.user.id
    );
    res.status(200).json({ coupon: presentCouponPublic(coupon) });
  } catch (err) {
    next(err);
  }
}

// -- Admin surface -----------------------------------------------------------

// GET /api/admin/coupons
// Every coupon, newest first, for the staff coupon panel.
async function listCoupons(req, res, next) {
  try {
    const rows = await couponModel.findAll();
    res.status(200).json({ coupons: rows.map(presentCouponAdmin) });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/coupons
// Create a coupon. A duplicate code is a 409 - the model's ON CONFLICT yields
// null rather than throwing a raw constraint error.
async function createCoupon(req, res, next) {
  try {
    const coupon = await couponModel.create({
      code: req.body.code,
      type: req.body.type,
      value: req.body.value,
      maxRedemptions:
        req.body.maxRedemptions === undefined ? null : req.body.maxRedemptions,
      perUserLimit: req.body.perUserLimit,
      minSubtotalCents: req.body.minSubtotalCents,
      startsAt: req.body.startsAt || null,
      expiresAt: req.body.expiresAt || null,
      isActive: req.body.isActive,
      description: req.body.description || null,
    });
    if (!coupon) {
      return next(
        errors.conflict('A Coupon With That Code Already Exists.')
      );
    }

    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'coupon.created',
      entityType: 'coupon',
      entityId: coupon.id,
      phiAccessed: false,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    res.status(201).json({ coupon: presentCouponAdmin(coupon) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/coupons/:couponId
// Update a coupon's mutable terms. The code, type, and value are immutable, so
// the update schema and the model both omit them.
async function updateCoupon(req, res, next) {
  try {
    const { couponId } = req.params;
    // S3-03: validate the couponId is a proper UUID before passing to pg;
    // a malformed value causes a pg parse error (unhandled 500), not a 404.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(couponId)) {
      return next(errors.notFound('Coupon Not Found.'));
    }
    const updated = await couponModel.update(couponId, req.body);
    if (!updated) {
      return next(errors.notFound('Coupon Not Found.'));
    }

    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'coupon.updated',
      entityType: 'coupon',
      entityId: updated.id,
      phiAccessed: false,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    res.status(200).json({ coupon: presentCouponAdmin(updated) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  validateCoupon: validateCoupon,
  listCoupons: listCoupons,
  createCoupon: createCoupon,
  updateCoupon: updateCoupon,
};
