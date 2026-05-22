'use strict';

// ============================================================================
// Payout run job.
// ----------------------------------------------------------------------------
// Settles affiliate revenue share for a calendar month. For each active
// affiliate it computes the payout owed on the revenue attributed to them and
// creates a pending affiliate_payouts row. The actual Stripe transfer is
// issued separately once the payout is reviewed and scheduled.
//
// The job is idempotent: existsForPeriod skips an affiliate that already has a
// payout for the period, so a re-run never double-pays. A monthly cron is
// expected; the default period is the previous calendar month.
// ============================================================================

const logger = require('../utils/logger');
const audit = require('../services/audit.service');
const affiliateModel = require('../models/affiliate.model');
const affiliatePayoutModel = require('../models/affiliate-payout.model');
const subscriptionModel = require('../models/subscription.model');
const { computePayoutCents } = require('../services/stripe/payout');

// Format a Date as an ISO date string (YYYY-MM-DD).
function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

// The first and last day of the calendar month before `now`, in UTC.
function previousMonthPeriod(now) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    periodStart: isoDate(new Date(Date.UTC(year, month - 1, 1))),
    periodEnd: isoDate(new Date(Date.UTC(year, month, 0))),
  };
}

// Run the job. `options` may carry an explicit periodStart and periodEnd
// (ISO date strings); otherwise the previous calendar month is settled.
async function run(options) {
  const opts = options || {};
  const period =
    opts.periodStart && opts.periodEnd
      ? { periodStart: opts.periodStart, periodEnd: opts.periodEnd }
      : previousMonthPeriod(new Date());

  const summary = {
    period: period,
    affiliatesProcessed: 0,
    payoutsCreated: 0,
    skipped: 0,
    totalCents: 0,
  };

  const affiliates = await affiliateModel.findAllActive();
  for (let i = 0; i < affiliates.length; i += 1) {
    const affiliate = affiliates[i];
    summary.affiliatesProcessed += 1;

    // Idempotency: never settle the same period twice.
    const already = await affiliatePayoutModel.existsForPeriod(
      affiliate.id,
      period.periodStart,
      period.periodEnd
    );
    if (already) {
      summary.skipped += 1;
      continue;
    }

    const mrrCents = await subscriptionModel.activeMrrCentsForAffiliate(affiliate.id);
    let amountCents = 0;
    try {
      amountCents = computePayoutCents(mrrCents, affiliate.revenue_share_pct);
    } catch (err) {
      logger.warn('Skipping affiliate payout; invalid revenue share', {
        affiliateId: affiliate.id,
      });
      summary.skipped += 1;
      continue;
    }

    // Nothing earned means no payout row.
    if (amountCents <= 0) {
      summary.skipped += 1;
      continue;
    }

    const payout = await affiliatePayoutModel.create({
      affiliateId: affiliate.id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      amountCents: amountCents,
    });
    // A null return means the period-unique constraint rejected a duplicate:
    // a concurrent run already settled this affiliate. Count it as skipped.
    if (payout) {
      summary.payoutsCreated += 1;
      summary.totalCents += amountCents;
    } else {
      summary.skipped += 1;
    }
  }

  await audit.record({
    action: 'job.payout_run.run',
    entityType: 'job',
    metadata: summary,
  });
  logger.info('Payout run complete', summary);
  return summary;
}

module.exports = {
  run: run,
  previousMonthPeriod: previousMonthPeriod,
};
