'use strict';

// ============================================================================
// Membership controller - PepNationRX Plus.
// ----------------------------------------------------------------------------
// The patient-facing membership surface: read the current membership and its
// perks, enroll, and cancel. Member plan pricing is applied automatically at
// checkout by the membership service; this controller only manages the
// membership record itself.
// ============================================================================

const membershipModel = require('../models/membership.model');
const membershipService = require('../services/membership');
const audit = require('../services/audit.service');
const errors = require('../utils/errors');

// Shape a membership row for the API.
function presentMembership(row) {
  if (!row) return null;
  return {
    id: row.id,
    tier: row.tier,
    status: row.status,
    priceCents: row.price_cents,
    startedAt: row.started_at,
    renewsAt: row.renews_at,
    canceledAt: row.canceled_at,
  };
}

// Shape a perk row for the API.
function presentPerk(row) {
  return {
    perkKey: row.perk_key,
    label: row.label,
    description: row.description,
  };
}

// GET /api/patient/membership
// The patient's active membership (or null), the Plus perk list, and the
// pricing the upsell needs to render.
async function getMembership(req, res, next) {
  try {
    const [membership, perks] = await Promise.all([
      membershipModel.findActiveByUserId(req.user.id),
      membershipModel.findPerks(membershipService.PLUS_TIER),
    ]);
    res.status(200).json({
      membership: presentMembership(membership),
      perks: perks.map(presentPerk),
      pricing: {
        tier: membershipService.PLUS_TIER,
        membershipPriceCents: membershipService.MEMBERSHIP_PRICE_CENTS,
        planDiscountPct: membershipService.PLAN_DISCOUNT_PCT,
        renewalIntervalDays: membershipService.RENEWAL_INTERVAL_DAYS,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/patient/membership
// Enroll the patient in PepNationRX Plus. The price is server-authoritative -
// it is never taken from the request body.
async function enroll(req, res, next) {
  try {
    const membership = await membershipModel.create({
      userId: req.user.id,
      tier: membershipService.PLUS_TIER,
      priceCents: membershipService.MEMBERSHIP_PRICE_CENTS,
      renewalIntervalDays: membershipService.RENEWAL_INTERVAL_DAYS,
    });
    // A null row means the partial unique index rejected the insert: the
    // patient already has an active membership.
    if (!membership) {
      return next(
        errors.conflict('You Already Have An Active PepNationRX Plus Membership.')
      );
    }

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'membership.enrolled',
      entityType: 'membership',
      entityId: membership.id,
      phiAccessed: false,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(201).json({ membership: presentMembership(membership) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/patient/membership
// Cancel the patient's active membership.
async function cancel(req, res, next) {
  try {
    const active = await membershipModel.findActiveByUserId(req.user.id);
    if (!active) {
      return next(
        errors.notFound('You Do Not Have An Active Membership To Cancel.')
      );
    }

    const canceled = await membershipModel.cancel(active.id);
    if (!canceled) {
      return next(
        errors.conflict('Your Membership Could Not Be Canceled.')
      );
    }

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'membership.canceled',
      entityType: 'membership',
      entityId: canceled.id,
      phiAccessed: false,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(200).json({ membership: presentMembership(canceled) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMembership: getMembership,
  enroll: enroll,
  cancel: cancel,
};
