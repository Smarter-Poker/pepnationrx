'use strict';

// ============================================================================
// Monthly check-in model - data-access layer for the monthly_checkins table.
// ----------------------------------------------------------------------------
// A monthly check-in is the brief clinical form a patient must complete to
// keep a recurring protocol authorized. The refill-reminders job schedules
// these; a separate sweep marks overdue ones missed. answers_encrypted holds
// PHI and is written encrypted by the patient-facing flow.
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, user_id, subscription_id, prescription_id, status, due_date, ' +
  'submitted_at, reviewed_at, created_at, updated_at';

// Statuses that count as an open (not yet resolved) check-in.
const OPEN_STATUSES = ['due', 'submitted'];

// Insert a check-in in the 'due' state. dueDate is an ISO date string. The
// partial unique index from migration 0005 allows at most one open check-in
// per subscription; ON CONFLICT against it turns a duplicate insert from a
// racing job run into a no-op, so this returns null when the subscription
// already has an open ('due' or 'submitted') check-in.
async function create(data) {
  return queryOne(
    'INSERT INTO monthly_checkins ' +
      '(user_id, subscription_id, prescription_id, status, due_date) ' +
      "VALUES ($1, $2, $3, 'due', $4) " +
      "ON CONFLICT (subscription_id) WHERE status IN ('due', 'submitted') " +
      'DO NOTHING ' +
      'RETURNING ' + COLUMNS,
    [
      data.userId,
      data.subscriptionId,
      data.prescriptionId || null,
      data.dueDate,
    ]
  );
}

// Find a check-in by primary key.
async function findById(id) {
  return queryOne('SELECT ' + COLUMNS + ' FROM monthly_checkins WHERE id = $1', [id]);
}

// True when a subscription already has an open ('due' or 'submitted')
// check-in. The refill-reminders job uses this to stay idempotent.
async function hasOpenCheckin(subscriptionId) {
  const row = await queryOne(
    'SELECT 1 AS present FROM monthly_checkins ' +
      'WHERE subscription_id = $1 AND status = ANY($2) LIMIT 1',
    [subscriptionId, OPEN_STATUSES]
  );
  return row !== null;
}

// Mark every 'due' check-in whose due_date is before the cutoff as 'missed'.
// Returns the number of rows updated. B-14: a null/undefined cutoffDate
// would cause due_date < NULL to evaluate as NULL in PostgreSQL, silently
// updating zero rows and causing the job to no-op without any error.
async function markOverdueMissed(cutoffDate) {
  if (cutoffDate === null || cutoffDate === undefined || cutoffDate === '') {
    throw new Error('markOverdueMissed: cutoffDate is required.');
  }
  const result = await query(
    "UPDATE monthly_checkins SET status = 'missed' " +
      "WHERE status = 'due' AND due_date < $1",
    [cutoffDate]
  );
  return result.rowCount;
}

// All check-ins for a subscription, newest first.
async function findBySubscriptionId(subscriptionId) {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM monthly_checkins WHERE subscription_id = $1 ' +
      'ORDER BY created_at DESC',
    [subscriptionId]
  );
  return result.rows;
}

// Mark a check-in submitted and store the (already-encrypted) answers buffer.
async function submit(checkinId, answersEncrypted) {
  return queryOne(
    "UPDATE monthly_checkins SET status = 'submitted', answers_encrypted = $2, " +
      'submitted_at = now(), updated_at = now() ' +
      'WHERE id = $1 ' +
      'RETURNING ' + COLUMNS,
    [checkinId, answersEncrypted]
  );
}


module.exports = {
  OPEN_STATUSES: OPEN_STATUSES,
  create: create,
  findById: findById,
  findBySubscriptionId: findBySubscriptionId,
  hasOpenCheckin: hasOpenCheckin,
  markOverdueMissed: markOverdueMissed,
  submit: submit,
};
