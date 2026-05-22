'use strict';

// ============================================================================
// Webhook event model - data-access layer for the webhook_events table.
// ----------------------------------------------------------------------------
// This table is the idempotency and audit ledger for every inbound event from
// the Triad. (source, external_event_id) is unique, so recordReceived returns
// null when an event has already been seen - that is how replays are made
// safe. The payload may contain PHI and is stored encrypted.
// ============================================================================

const { query, queryOne } = require('../db/query');

// Insert a newly received event. Returns the row, or null when this
// (source, external_event_id) pair has already been recorded (a replay).
async function recordReceived(data) {
  return queryOne(
    'INSERT INTO webhook_events ' +
      '(source, event_type, external_event_id, payload_encrypted, status) ' +
      "VALUES ($1, $2, $3, $4, 'received') " +
      'ON CONFLICT (source, external_event_id) DO NOTHING ' +
      'RETURNING id, source, event_type, external_event_id, status, received_at',
    [data.source, data.eventType, data.externalEventId, data.payloadEncrypted || null]
  );
}

// Look up an event by its natural key.
async function findByExternalId(source, externalEventId) {
  return queryOne(
    'SELECT id, source, event_type, external_event_id, status, ' +
      ' retry_count, error_detail, received_at, processed_at ' +
      'FROM webhook_events WHERE source = $1 AND external_event_id = $2',
    [source, externalEventId]
  );
}

// Move an event to the processing state.
async function markProcessing(id) {
  await query("UPDATE webhook_events SET status = 'processing' WHERE id = $1", [id]);
}

// Mark an event successfully processed.
async function markProcessed(id) {
  await query(
    "UPDATE webhook_events SET status = 'processed', processed_at = now() WHERE id = $1",
    [id]
  );
}

// Mark an event failed, recording the reason and incrementing the retry count.
async function markFailed(id, errorDetail) {
  await query(
    "UPDATE webhook_events SET status = 'failed', " +
      'retry_count = retry_count + 1, error_detail = $2 WHERE id = $1',
    [id, errorDetail || null]
  );
}

// Mark an event intentionally ignored (a known event type with no action).
async function markIgnored(id) {
  await query("UPDATE webhook_events SET status = 'ignored' WHERE id = $1", [id]);
}

module.exports = {
  recordReceived: recordReceived,
  findByExternalId: findByExternalId,
  markProcessing: markProcessing,
  markProcessed: markProcessed,
  markFailed: markFailed,
  markIgnored: markIgnored,
};
