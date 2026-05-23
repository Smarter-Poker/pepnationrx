'use strict';

// ============================================================================
// Notification model - data-access layer for the notification tables.
// ----------------------------------------------------------------------------
// Backs migration 0010. A notification row is the durable record of a message
// the platform sent or attempted. dedupe_key gives send idempotency: create()
// uses ON CONFLICT against the partial unique index, so a job that runs twice
// produces one row, not two. notification_preferences holds per-user channel
// opt-in; a missing row means the platform defaults (email on, SMS off).
// ============================================================================

const { queryOne, queryRows } = require('../db/query');

const COLUMNS =
  'id, user_id, channel, template, subject, payload, status, ' +
  'dedupe_key, sent_at, error, created_at, updated_at';

// The defaults applied when a user has no notification_preferences row.
const DEFAULT_PREFERENCES = { email_enabled: true, sms_enabled: false };

// Insert a queued notification. When dedupeKey is supplied and a row with that
// key already exists, the partial unique index turns the insert into a no-op
// and this returns null - the caller treats null as "already handled".
async function create(data, client) {
  return queryOne(
    'INSERT INTO notifications ' +
      '(user_id, channel, template, subject, payload, dedupe_key) ' +
      'VALUES ($1, $2, $3, $4, $5, $6) ' +
      'ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING ' +
      'RETURNING ' + COLUMNS,
    [
      data.userId,
      data.channel || 'email',
      data.template,
      data.subject || null,
      JSON.stringify(data.payload || {}),
      data.dedupeKey || null,
    ],
    client
  );
}

// Mark a notification delivered.
async function markSent(id) {
  return queryOne(
    "UPDATE notifications SET status = 'sent', sent_at = now(), error = NULL " +
      'WHERE id = $1 RETURNING ' + COLUMNS,
    [id]
  );
}

// Mark a notification failed, recording the error for diagnostics.
async function markFailed(id, errorMessage) {
  return queryOne(
    "UPDATE notifications SET status = 'failed', error = $2 " +
      'WHERE id = $1 RETURNING ' + COLUMNS,
    [id, errorMessage || 'unknown error']
  );
}

// Mark a notification skipped (the user opted out of the channel).
async function markSkipped(id) {
  return queryOne(
    "UPDATE notifications SET status = 'skipped' " +
      'WHERE id = $1 RETURNING ' + COLUMNS,
    [id]
  );
}

// The most recent notifications for a user, newest first.
async function listForUser(userId, limit) {
  const cap = Number.isInteger(limit) && limit > 0 && limit <= 100 ? limit : 25;
  return queryRows(
    'SELECT ' + COLUMNS + ' FROM notifications ' +
      'WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, cap]
  );
}

// A user's channel preferences, or the platform defaults when no row exists.
async function getPreferences(userId) {
  const row = await queryOne(
    'SELECT user_id, email_enabled, sms_enabled, created_at, updated_at ' +
      'FROM notification_preferences WHERE user_id = $1',
    [userId]
  );
  if (row) return row;
  return Object.assign({ user_id: userId }, DEFAULT_PREFERENCES);
}

// Insert or update a user's channel preferences.
async function upsertPreferences(userId, data) {
  return queryOne(
    'INSERT INTO notification_preferences (user_id, email_enabled, sms_enabled) ' +
      'VALUES ($1, $2, $3) ' +
      'ON CONFLICT (user_id) DO UPDATE SET ' +
      'email_enabled = EXCLUDED.email_enabled, ' +
      'sms_enabled = EXCLUDED.sms_enabled ' +
      'RETURNING user_id, email_enabled, sms_enabled, created_at, updated_at',
    [
      userId,
      data.emailEnabled !== false,
      data.smsEnabled === true,
    ]
  );
}

module.exports = {
  DEFAULT_PREFERENCES: DEFAULT_PREFERENCES,
  create: create,
  markSent: markSent,
  markFailed: markFailed,
  markSkipped: markSkipped,
  listForUser: listForUser,
  getPreferences: getPreferences,
  upsertPreferences: upsertPreferences,
};
