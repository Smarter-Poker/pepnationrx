'use strict';

// ============================================================================
// Affiliate payout endpoints.
// ----------------------------------------------------------------------------
// POST /api/affiliate/payouts/request
//   An affiliate requests a payout for a settled period. Creates a 'pending'
//   payout row. Actual Stripe transfer execution is STUBBED — payment
//   processing integration will be added in a later phase. The row will stay
//   'pending' until the payment phase activates the Stripe Transfer call.
//
// GET /api/affiliate/payouts
//   Lists all payout rows for the authenticated affiliate.
//
// Admin only:
// POST /api/affiliate/payouts/:payoutId/schedule
//   Marks a pending payout as 'scheduled' (confirms it is queued for payment).
// POST /api/affiliate/payouts/:payoutId/mark-paid
//   Admin manually marks a payout as paid (for test/override purposes until
//   Stripe Transfers are wired). Sets stripe_transfer_id to 'manual' and
//   paid_at to now().
// ============================================================================

const errors = require('../utils/errors');
const logger = require('../utils/logger');
const payoutModel = require('../models/affiliate-payout.model');
const affiliateModel = require('../models/affiliate.model');
const subscriptionModel = require('../models/subscription.model');
const audit = require('../services/audit.service');
const { withTransaction } = require('../db/query');

const ADMIN_ROLES = ['admin', 'support'];

// Resolve the affiliate record for the requesting user, or throw 403.
async function requireAffiliate(req) {
  const affiliate = await affiliateModel.findByUserId(req.user.id);
  if (!affiliate) {
    throw errors.forbidden('This Account Is Not Registered As An Affiliate.');
  }
  return affiliate;
}

// ── GET /api/affiliate/payouts ─────────────────────────────────────────────
// List all payout rows for the authenticated affiliate, plus totals.
async function list(req, res, next) {
  try {
    const affiliate = await requireAffiliate(req);
    const [payouts, totals] = await Promise.all([
      payoutModel.findByAffiliateId(affiliate.id),
      payoutModel.totalsForAffiliate(affiliate.id),
    ]);
    res.status(200).json({
      payouts: payouts,
      totals: {
        paidCents: totals.paidCents,
        pendingCents: totals.pendingCents,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/affiliate/payouts/request ────────────────────────────────────
// An affiliate requests a payout for a billing period.
// Body: { periodStart: 'YYYY-MM-DD', periodEnd: 'YYYY-MM-DD' }
//
// Validates that the period has already ended (today >= periodEnd) and that
// the affiliate has a positive MRR balance attributed to them in that window.
// Creates a 'pending' payout row. DOES NOT execute the Stripe Transfer —
// payment processing will be wired in a later phase.
async function request(req, res, next) {
  try {
    const affiliate = await requireAffiliate(req);
    const { periodStart, periodEnd } = req.body;

    if (!periodStart || !periodEnd) {
      throw errors.badRequest('periodStart And periodEnd Are Required (YYYY-MM-DD).');
    }

    const now = new Date();
    const endDate = new Date(periodEnd);
    if (isNaN(endDate.getTime())) {
      throw errors.badRequest('periodEnd Is Not A Valid Date.');
    }
    if (endDate > now) {
      throw errors.badRequest('Payout Period Has Not Yet Ended.');
    }

    // Check idempotency: a payout for this exact period must not already exist.
    const alreadyExists = await payoutModel.existsForPeriod(
      affiliate.id,
      periodStart,
      periodEnd
    );
    if (alreadyExists) {
      throw errors.conflict('A Payout For This Period Has Already Been Requested.');
    }

    // Compute the affiliate's earned balance from active MRR in this period.
    // The commission rate is stored on the affiliate record.
    const activeMrr = await subscriptionModel.activeMrrCentsForAffiliate(affiliate.id);
    const commissionRate = Number(affiliate.commission_rate) || 0.20;
    const amountCents = Math.floor(activeMrr * commissionRate);

    if (amountCents <= 0) {
      throw errors.badRequest('No Affiliate Revenue Balance Available For This Period.');
    }

    const payout = await payoutModel.create({
      affiliateId: affiliate.id,
      periodStart: periodStart,
      periodEnd: periodEnd,
      amountCents: amountCents,
      currency: 'USD',
    });

    // Payout row created in 'pending' state.
    // STUB: Stripe Transfer execution is deferred to the payment processing phase.
    // When that phase activates, a background job will pick up 'pending' rows,
    // call stripe.transfers.create(), and update stripe_transfer_id + paid_at.
    logger.info('Affiliate Payout Requested (Stripe Transfer Deferred)', {
      affiliateId: affiliate.id,
      payoutId: payout ? payout.id : null,
      amountCents: amountCents,
      periodStart: periodStart,
      periodEnd: periodEnd,
    });

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'affiliate.payout.requested',
      entityType: 'affiliate_payout',
      entityId: payout ? payout.id : null,
      phiAccessed: false,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(201).json({
      payout: payout,
      note: 'Payout Request Received. Payment Processing Will Be Initiated In The Next Payout Run.',
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/affiliate/payouts/:payoutId/schedule  (admin only) ───────────
// Admin marks a pending payout as 'scheduled' — confirming it is queued for
// the next Stripe Transfer batch.
async function schedule(req, res, next) {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      throw errors.forbidden('Admin Access Required.');
    }
    const { payoutId } = req.params;
    const result = await withTransaction(async (client) => {
      return client.query(
        "UPDATE affiliate_payouts SET status = 'scheduled', updated_at = now() " +
          "WHERE id = $1 AND status = 'pending' RETURNING *",
        [payoutId]
      );
    });
    if (!result || result.rowCount === 0) {
      throw errors.notFound('Payout Not Found Or Not In Pending Status.');
    }
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'affiliate.payout.scheduled',
      entityType: 'affiliate_payout',
      entityId: payoutId,
      phiAccessed: false,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });
    res.status(200).json({ payout: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/affiliate/payouts/:payoutId/mark-paid  (admin only) ─────────
// Admin manually marks a payout as paid. Used for manual bank transfers or
// testing until Stripe Transfers are wired. Sets stripe_transfer_id to
// 'manual' unless provided in the body.
async function markPaid(req, res, next) {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      throw errors.forbidden('Admin Access Required.');
    }
    const { payoutId } = req.params;
    const transferId = req.body.stripeTransferId || 'manual';

    const result = await withTransaction(async (client) => {
      return client.query(
        "UPDATE affiliate_payouts " +
          "SET status = 'paid', stripe_transfer_id = $2, paid_at = now(), updated_at = now() " +
          "WHERE id = $1 AND status IN ('pending', 'scheduled') RETURNING *",
        [payoutId, transferId]
      );
    });
    if (!result || result.rowCount === 0) {
      throw errors.notFound('Payout Not Found Or Already Paid.');
    }
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'affiliate.payout.paid',
      entityType: 'affiliate_payout',
      entityId: payoutId,
      phiAccessed: false,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });
    res.status(200).json({ payout: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list: list,
  request: request,
  schedule: schedule,
  markPaid: markPaid,
};
