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
// and a partial unique index makes the database the final arbiter, so it is
// safe to run on any cadence (a daily cron is expected).
// ============================================================================

const logger = require('../utils/logger');
const audit = require('../services/audit.service');
const notificationService = require('../services/notification');
const subscriptionModel = require('../models/subscription.model');
const monthlyCheckinModel = require('../models/monthly-checkin.model');

// A check-in is scheduled this many days ahead of the next billing date.
const CHECKIN_LEAD_DAYS = 7;
// When a subscription has no billing date, a check-in is due in this many days.
const DEFAULT_CHECKIN_DAYS = 23;

// Format a Date as an ISO date string (YYYY-MM-DD) from its calendar-date
// components. Using the components rather than toISOString keeps the result
// independent of the process timezone: pg parses a DATE column into a Date
// whose local components are exactly the stored calendar date, so a
// next_billing_date is never shifted a day by a non-UTC server clock.
function dateOnlyIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

// Run the job. Returns a summary suitable for logging and auditing.
async function run() {
  const today = new Date();
  const todayIso = dateOnlyIso(today);
  const summary = { scheduled: 0, skipped: 0, missed: 0, notified: 0 };

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
    const dueDate = due.getTime() < today.getTime() ? todayIso : dateOnlyIso(due);

    const created = await monthlyCheckinModel.create({
      userId: sub.user_id,
      subscriptionId: sub.id,
      dueDate: dueDate,
    });
    if (created) {
      summary.scheduled += 1;
      // Tell the patient a check-in is due. The dedupe key ties the email to
      // this exact check-in row, so a re-run never sends a second reminder.
      // The notification service never throws, so a send failure here cannot
      // disrupt scheduling.
      const sent = await notificationService.send({
        userId: sub.user_id,
        template: 'checkin_due',
        payload: { dueDate: dueDate },
        dedupeKey: 'checkin-due:' + created.id,
      });
      if (sent && sent.ok && !sent.duplicate && !sent.skipped) {
        summary.notified += 1;
      }
    } else {
      // A concurrent run scheduled this subscription's check-in first; the
      // partial unique index turned the duplicate insert into a no-op.
      summary.skipped += 1;
    }
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
