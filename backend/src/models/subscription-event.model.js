'use strict';

// ============================================================================
// Subscription event model - data-access layer for the subscription_events
// table.
// ----------------------------------------------------------------------------
// An append-only audit log of patient-driven subscription state changes
// (pause, resume, cancel, plan change). The patient dashboard reads this log
// to show an accurate plan history; support tooling reads it to explain why a
// subscription is in its current state. Rows are never updated or deleted.
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, subscription_id, user_id, event_type, from_status, to_status, ' +
  'metadata, created_at';

// The four event types, mirrored from the subscription_event_type enum in
// migration 0011.
const EVENT_TYPES = ['paused', 'resumed', 'canceled', 'plan_changed'];

// Record a subscription state change. `data` carries:
//   subscriptionId   the subscription the change applies to
//   userId           the subscription owner
//   eventType        one of EVENT_TYPES
//   fromStatus       the subscription_status before the change (optional)
//   toStatus         the subscription_status after the change (optional)
//   metadata         a non-PHI JSON object of extra context (optional)
// An optional `client` runs the insert inside an open transaction so the
// event row and the subscription update commit as one unit.
async function record(data, client) {
  return queryOne(
    'INSERT INTO subscription_events ' +
      '(subscription_id, user_id, event_type, from_status, to_status, metadata) ' +
      'VALUES ($1, $2, $3, $4, $5, $6) ' +
      'RETURNING ' + COLUMNS,
    [
      data.subscriptionId,
      data.userId,
      data.eventType,
      data.fromStatus || null,
      data.toStatus || null,
      JSON.stringify(data.metadata || {}),
    ],
    client
  );
}

// The change history for one subscription, newest first.
async function findBySubscriptionId(subscriptionId) {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM subscription_events ' +
      'WHERE subscription_id = $1 ORDER BY created_at DESC',
    [subscriptionId]
  );
  return result.rows;
}

// The change history across all of a patient's subscriptions, newest first.
async function findByUserId(userId) {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM subscription_events ' +
      'WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

module.exports = {
  EVENT_TYPES: EVENT_TYPES,
  record: record,
  findBySubscriptionId: findBySubscriptionId,
  findByUserId: findByUserId,
};
