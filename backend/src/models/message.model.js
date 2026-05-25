'use strict';

// ============================================================================
// Message model - data-access layer for message_threads and messages.
// ----------------------------------------------------------------------------
// Backs the secure patient-to-provider care-team thread. Message bodies are
// stored encrypted (body_encrypted BYTEA); this model never encrypts or
// decrypts - the controller does that at the application boundary, exactly as
// the intake and medical-profile layers do for PHI.
//
// Each patient has at most one open thread (enforced by a partial unique
// index). Closed threads are retained for history.
// ============================================================================

const { query, queryOne } = require('../db/query');

const THREAD_COLUMNS =
  'id, patient_user_id, provider_id, subject, status, last_message_at, ' +
  'created_at, updated_at';

const MESSAGE_COLUMNS =
  'id, thread_id, sender_user_id, sender_role, body_encrypted, read_at, ' +
  'created_at';

// The open thread for a patient, or null when none exists yet.
async function findOpenThreadByPatient(patientUserId, client) {
  return queryOne(
    'SELECT ' + THREAD_COLUMNS + ' FROM message_threads ' +
      "WHERE patient_user_id = $1 AND status = 'open'",
    [patientUserId],
    client
  );
}

// A thread by primary key.
async function findThreadById(threadId, client) {
  return queryOne(
    'SELECT ' + THREAD_COLUMNS + ' FROM message_threads WHERE id = $1',
    [threadId],
    client
  );
}

// Every thread a patient owns, newest activity first.
async function findThreadsByPatient(patientUserId) {
  const result = await query(
    'SELECT ' + THREAD_COLUMNS + ' FROM message_threads ' +
      'WHERE patient_user_id = $1 ' +
      'ORDER BY COALESCE(last_message_at, created_at) DESC',
    [patientUserId]
  );
  return result.rows;
}

// Open threads across all patients, for the provider inbox. Newest activity
// first; `limit` caps the page (default 100).
async function findOpenThreads(limit) {
  const capped = Number.isInteger(limit) && limit > 0 ? limit : 100;
  const result = await query(
    'SELECT ' + THREAD_COLUMNS + ' FROM message_threads ' +
      "WHERE status = 'open' " +
      'ORDER BY COALESCE(last_message_at, created_at) DESC LIMIT $1',
    [capped]
  );
  return result.rows;
}

// Find the patient's open thread or create it. The partial unique index makes
// the insert race-safe: a concurrent creator's row is honored and re-read.
async function getOrCreateOpenThread(patientUserId, client) {
  const existing = await findOpenThreadByPatient(patientUserId, client);
  if (existing) return existing;
  const inserted = await queryOne(
    'INSERT INTO message_threads (patient_user_id) VALUES ($1) ' +
      "ON CONFLICT (patient_user_id) WHERE status = 'open' DO NOTHING " +
      'RETURNING ' + THREAD_COLUMNS,
    [patientUserId],
    client
  );
  if (inserted) return inserted;
  // A concurrent request won the insert; read its row.
  return findOpenThreadByPatient(patientUserId, client);
}

// Assign a provider to a thread, but only when it has none yet, so the first
// clinician to answer claims the thread without later replies reassigning it.
async function assignProviderIfUnset(threadId, providerId, client) {
  return queryOne(
    'UPDATE message_threads SET provider_id = $2 ' +
      'WHERE id = $1 AND provider_id IS NULL ' +
      'RETURNING ' + THREAD_COLUMNS,
    [threadId, providerId],
    client
  );
}

// Append a message and stamp the thread's last_message_at in one atomic
// statement. `data` carries threadId, senderUserId (may be null), senderRole,
// and bodyEncrypted (a Buffer). Returns the inserted message row.
async function addMessage(data, client) {
  return queryOne(
    'WITH inserted AS (' +
      '  INSERT INTO messages ' +
      '    (thread_id, sender_user_id, sender_role, body_encrypted) ' +
      '  VALUES ($1, $2, $3, $4) ' +
      '  RETURNING ' + MESSAGE_COLUMNS +
      '), touched AS (' +
      '  UPDATE message_threads SET last_message_at = now() WHERE id = $1' +
      ') ' +
      'SELECT ' + MESSAGE_COLUMNS + ' FROM inserted',
    [data.threadId, data.senderUserId || null, data.senderRole, data.bodyEncrypted],
    client
  );
}

// Every message in a thread, oldest first.
async function findMessagesByThread(threadId) {
  const result = await query(
    'SELECT ' + MESSAGE_COLUMNS + ' FROM messages ' +
      'WHERE thread_id = $1 ORDER BY created_at ASC',
    [threadId]
  );
  return result.rows;
}

// Mark every unread message in a thread sent by one of `senderRoles` as read.
// Returns the number of messages updated. Used when a reader opens a thread:
// a patient marks provider/support messages read; a clinician marks the
// patient's messages read.
async function markMessagesRead(threadId, senderRoles, client) {
  const result = await query(
    'UPDATE messages SET read_at = now() ' +
      'WHERE thread_id = $1 AND sender_role = ANY($2) AND read_at IS NULL',
    [threadId, senderRoles],
    client
  );
  return result.rowCount;
}

// Count the messages a patient has not yet read across all of their threads:
// messages from a clinician (not the patient) that are still unread.
async function unreadCountForPatient(patientUserId) {
  const row = await queryOne(
    'SELECT COUNT(*)::int AS count FROM messages m ' +
      'JOIN message_threads t ON t.id = m.thread_id ' +
      "WHERE t.patient_user_id = $1 AND m.sender_role <> 'patient' " +
      'AND m.read_at IS NULL',
    [patientUserId]
  );
  return row ? row.count : 0;
}

// Count the unread patient messages across all open threads, for the provider
// inbox badge.
async function unreadCountForClinicians() {
  const row = await queryOne(
    'SELECT COUNT(*)::int AS count FROM messages m ' +
      'JOIN message_threads t ON t.id = m.thread_id ' +
      "WHERE t.status = 'open' AND m.sender_role = 'patient' " +
      'AND m.read_at IS NULL'
  );
  return row ? row.count : 0;
}

// The count of unread messages within a single thread, for a given reader.
// `senderRoles` are the roles whose messages count as unread for this reader.
async function unreadCountForThread(threadId, senderRoles) {
  const row = await queryOne(
    'SELECT COUNT(*)::int AS count FROM messages ' +
      'WHERE thread_id = $1 AND sender_role = ANY($2) AND read_at IS NULL',
    [threadId, senderRoles]
  );
  return row ? row.count : 0;
}

module.exports = {
  findOpenThreadByPatient: findOpenThreadByPatient,
  findThreadById: findThreadById,
  findThreadsByPatient: findThreadsByPatient,
  findOpenThreads: findOpenThreads,
  getOrCreateOpenThread: getOrCreateOpenThread,
  assignProviderIfUnset: assignProviderIfUnset,
  addMessage: addMessage,
  findMessagesByThread: findMessagesByThread,
  markMessagesRead: markMessagesRead,
  unreadCountForPatient: unreadCountForPatient,
  unreadCountForClinicians: unreadCountForClinicians,
  unreadCountForThread: unreadCountForThread,
};
