'use strict';

// ============================================================================
// Billing sweep job.
// ----------------------------------------------------------------------------
// Detects subscriptions whose recurring charge is due and applies dunning. A
// successful renewal charge is confirmed asynchronously by the Stripe webhook
// (invoice.paid), so this sweep does not itself charge a card. Instead it:
//   - counts renewals that are due within the grace window (the billing
//     system processes these), and
//   - flags subscriptions whose renewal is overdue beyond the grace window as
//     past_due, because no payment confirmation has arrived.
//
// Marking past_due is idempotent (markPastDue only acts on 'active' rows), so
// the sweep is safe to run repeatedly. A daily cron is expected.
// ============================================================================

const logger = require('../utils/logger');
const audit = require('../services/audit.service');
const subscriptionModel = require('../models/subscription.model');

// Days a renewal may sit unconfirmed before the subscription is marked
// past_due and dunning begins.
const GRACE_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Format a Date as an ISO date string (YYYY-MM-DD) from its calendar-date
// components. Using the components rather than toISOString keeps the result
// independent of the process timezone: pg parses a DATE column into a Date
// whose local components are exactly the stored calendar date.
function dateOnlyIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

// Whole days from one YYYY-MM-DD date to another. Both ends are anchored at
// UTC midnight so the day count is exact and never skewed by the timezone.
function daysBetween(fromIso, toIso) {
  const fromMs = Date.parse(fromIso + 'T00:00:00Z');
  const toMs = Date.parse(toIso + 'T00:00:00Z');
  return Math.round((toMs - fromMs) / MS_PER_DAY);
}

// Run the job. Returns a summary suitable for logging and auditing.
async function run() {
  const todayIso = dateOnlyIso(new Date());
  const summary = { renewalsDue: 0, markedPastDue: 0 };

  const due = await subscriptionModel.findDueForBilling(todayIso);
  for (let i = 0; i < due.length; i += 1) {
    const sub = due[i];
    const overdueDays = daysBetween(dateOnlyIso(sub.next_billing_date), todayIso);

    if (overdueDays > GRACE_DAYS) {
      // The renewal window has lapsed with no confirmed payment.
      await subscriptionModel.markPastDue(sub.id);
      summary.markedPastDue += 1;
    } else {
      // Within grace: a renewal the billing system should be processing.
      summary.renewalsDue += 1;
    }
  }

  await audit.record({
    action: 'job.billing_sweep.run',
    entityType: 'job',
    metadata: summary,
  });
  logger.info('Billing sweep complete', summary);
  return summary;
}

module.exports = { run: run };
