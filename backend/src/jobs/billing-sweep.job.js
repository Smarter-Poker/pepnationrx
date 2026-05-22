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

// Format a Date as an ISO date string (YYYY-MM-DD).
function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

// Run the job. Returns a summary suitable for logging and auditing.
async function run() {
  const today = new Date();
  const summary = { renewalsDue: 0, markedPastDue: 0 };

  const due = await subscriptionModel.findDueForBilling(isoDate(today));
  for (let i = 0; i < due.length; i += 1) {
    const sub = due[i];
    const billDate = new Date(sub.next_billing_date);
    const overdueDays = Math.floor((today.getTime() - billDate.getTime()) / MS_PER_DAY);

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
