'use strict';

// ============================================================================
// Affiliate controller.
// ----------------------------------------------------------------------------
// Assembles the affiliate dashboard: the affiliate's organization profile,
// their referral funnel, attributed revenue, and payout ledger. The affiliate
// record is resolved from the authenticated user; a user with no affiliate
// record is not permitted here.
// ============================================================================

const errors = require('../utils/errors');
const affiliateModel = require('../models/affiliate.model');
const referralModel = require('../models/affiliate-referral.model');
const payoutModel = require('../models/affiliate-payout.model');
const subscriptionModel = require('../models/subscription.model');
const audit = require('../services/audit.service');

// Resolve the affiliate record for the authenticated user, or throw 403.
async function requireAffiliate(req) {
  const affiliate = await affiliateModel.findByUserId(req.user.id);
  if (!affiliate) {
    throw errors.forbidden('This account is not registered as an affiliate.');
  }
  return affiliate;
}

// Build the public referral path for an affiliate code. The host application
// resolves the ref query parameter and records a landing.
function referralPathFor(affiliateCode) {
  return '/?ref=' + encodeURIComponent(affiliateCode);
}

// GET /api/affiliate/dashboard - the authenticated affiliate's dashboard.
async function dashboard(req, res, next) {
  try {
    const affiliate = await requireAffiliate(req);

    const [referrals, counts, payouts, payoutTotals, activeMrrCents] =
      await Promise.all([
        referralModel.findByAffiliateId(affiliate.id, 50),
        referralModel.countsForAffiliate(affiliate.id),
        payoutModel.findByAffiliateId(affiliate.id),
        payoutModel.totalsForAffiliate(affiliate.id),
        subscriptionModel.activeMrrCentsForAffiliate(affiliate.id),
      ]);

    const sharePct = Number(affiliate.revenue_share_pct) || 0;
    // Estimated earnings this month from the current attributed MRR.
    const estimatedMonthlyEarningsCents = Math.floor(
      (activeMrrCents * sharePct) / 100
    );
    const conversionRate =
      counts.landed > 0 ? counts.converted / counts.landed : 0;

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'affiliate.dashboard.viewed',
      entityType: 'affiliate',
      entityId: affiliate.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(200).json({
      affiliate: affiliate,
      referralPath: referralPathFor(affiliate.affiliate_code),
      summary: {
        referralsLanded: counts.landed,
        referralsConverted: counts.converted,
        conversionRate: conversionRate,
        attributedMrrCents: activeMrrCents,
        revenueSharePct: sharePct,
        estimatedMonthlyEarningsCents: estimatedMonthlyEarningsCents,
        paidToDateCents: payoutTotals.paidCents,
        pendingPayoutCents: payoutTotals.pendingCents,
      },
      referrals: referrals,
      payouts: payouts,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/affiliate/referral-link - the affiliate's shareable referral link.
async function referralLink(req, res, next) {
  try {
    const affiliate = await requireAffiliate(req);
    res.status(200).json({
      affiliateCode: affiliate.affiliate_code,
      referralPath: referralPathFor(affiliate.affiliate_code),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboard: dashboard,
  referralLink: referralLink,
};
