'use strict';

// ============================================================================
// Refill reminders job.
// ----------------------------------------------------------------------------
// Keeps the monthly clinical check-in cadence running. On each run it:
//   1. marks every overdue 'due' check-in as 'missed', and
//   2. schedules a new check-in for every active subscription that does not
//      already have an open one.
//
// The job is idempotent: hasOpenCheckin guards against scheduling a duplicate,
// so it is safe to run on any cadence (a daily cron is expected).
// ============================================================================

const logger = require('../utils/logger');
const audit = require('../services/audit.service');
const subscriptionModel = require('../models/subscription.model');
const monthlyCheckinModel = require('../models/monthly-checkin.model');

// A check-in is scheduled this many days ahead of the next billing date.
const CHECKIN_LEAD_DAYS = 7;
// When a subscription has no billing date, a check-in is due in this many days.
const DEFAULT_CHECKIN_DAYS = 23;

// Format a Date as an ISO date string (YYYY-MM-DD).
function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

// Run the job. Returns a summary suitable for logging and auditing.
async function run() {
  const today = new Date();
  const todayIso = isoDate(today);
  const summary = { scheduled: 0, skipped: 0, missed: 0 };

  // 1. Any 'due' check-in past its date is now missed.
  summary.missed = await monthlyCheckinModel.markOverdueMissed(todayIso);

  // 2. Ensure every active subscription has an open check-in.
  const subscriptions = await subscriptionModel.findActive();
  for (let i = 0; i < subscriptions.length; i += 1) {
    const sub = subscriptions[i];
    if (await monthlyCheckinModel.hasOpenCheckin(sub.id)) {
      summary.skipped += 1;
      continue;
    }

    const due = sub.next_billing_date ? new Date(sub.next_billing_date) : new Date(today);
    if (sub.next_billing_date) {
      due.setDate(due.getDate() - CHECKIN_LEAD_DAYS);
    } else {
      due.setDate(due.getDate() + DEFAULT_CHECKIN_DAYS);
    }
    // A check-in is never scheduled in the past.
    const dueDate = due.getTime() < today.getTime() ? todayIso : isoDate(due);

    await monthlyCheckinModel.create({
      userId: sub.user_id,
      subscriptionId: sub.id,
      dueDate: dueDate,
    });
    summary.scheduled += 1;
  }

  await audit.record({
    action: 'job.refill_reminders.run',
    entityType: 'job',
    metadata: summary,
  });
  logger.info('Refill reminders job complete', summary);
  return summary;
}

module.exports = { run: run };
