'use strict';

// ============================================================================
// Insurance model - data-access layer for insurance_policies and
// insurance_eligibility_checks.
// ----------------------------------------------------------------------------
// Backs the insurance eligibility and concierge feature. The member id and
// group number are stored encrypted (the *_encrypted BYTEA columns); this
// model never encrypts or decrypts - the controller does that at the
// application boundary, exactly as the messaging and intake layers do.
// ============================================================================

const { query, queryOne } = require('../db/query');

const POLICY_COLUMNS =
  'id, user_id, carrier_name, plan_name, member_id_encrypted, ' +
  'group_number_encrypted, is_active, created_at, updated_at';

const CHECK_COLUMNS =
  'id, policy_id, user_id, protocol_category, status, coverage_summary, ' +
  'copay_cents, deductible_cents, concierge_state, concierge_notes, ' +
  'checked_at, created_at, updated_at';

// Concierge states that count as an open item on the work queue.
const OPEN_CONCIERGE_STATES = ['requested', 'in_progress'];

// -- Policies ----------------------------------------------------------------

// Create an insurance policy. `data` carries userId, carrierName, planName,
// memberIdEncrypted (a Buffer), and groupNumberEncrypted (a Buffer or null).
async function createPolicy(data, client) {
  return queryOne(
    'INSERT INTO insurance_policies ' +
      '(user_id, carrier_name, plan_name, member_id_encrypted, ' +
      ' group_number_encrypted) ' +
      'VALUES ($1, $2, $3, $4, $5) ' +
      'RETURNING ' + POLICY_COLUMNS,
    [
      data.userId,
      data.carrierName,
      data.planName || null,
      data.memberIdEncrypted,
      data.groupNumberEncrypted || null,
    ],
    client
  );
}

// A policy by primary key.
async function findPolicyById(id) {
  return queryOne(
    'SELECT ' + POLICY_COLUMNS + ' FROM insurance_policies WHERE id = $1',
    [id]
  );
}

// Every policy a patient has on file, newest first.
async function findPoliciesByUser(userId) {
  const result = await query(
    'SELECT ' + POLICY_COLUMNS + ' FROM insurance_policies ' +
      'WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

// -- Eligibility checks ------------------------------------------------------

// Record an eligibility check. The adapter resolves the check synchronously,
// so a row is always created already-checked: checked_at is stamped now.
async function createCheck(data, client) {
  return queryOne(
    'INSERT INTO insurance_eligibility_checks ' +
      '(policy_id, user_id, protocol_category, status, coverage_summary, ' +
      ' copay_cents, deductible_cents, checked_at) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, now()) ' +
      'RETURNING ' + CHECK_COLUMNS,
    [
      data.policyId,
      data.userId,
      data.protocolCategory || null,
      data.status,
      data.coverageSummary || null,
      Number.isInteger(data.copayCents) ? data.copayCents : null,
      Number.isInteger(data.deductibleCents) ? data.deductibleCents : null,
    ],
    client
  );
}

// A check by primary key.
async function findCheckById(id) {
  return queryOne(
    'SELECT ' + CHECK_COLUMNS + ' FROM insurance_eligibility_checks WHERE id = $1',
    [id]
  );
}

// Every eligibility check a patient has run, newest first.
async function findChecksByUser(userId) {
  const result = await query(
    'SELECT ' + CHECK_COLUMNS + ' FROM insurance_eligibility_checks ' +
      'WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

// The concierge work queue: open assisted reviews, oldest first so the
// longest-waiting patient is handled next.
async function findConciergeQueue() {
  const result = await query(
    'SELECT ' + CHECK_COLUMNS + ' FROM insurance_eligibility_checks ' +
      'WHERE concierge_state = ANY($1) ORDER BY created_at ASC',
    [OPEN_CONCIERGE_STATES]
  );
  return result.rows;
}

// Move a check from 'not_requested' to 'requested'. Acts only on a check that
// has not already asked for concierge help, so the call is idempotent and a
// re-request never resets an in-progress review. Returns the updated row, or
// null when the check was not in 'not_requested'.
async function requestConcierge(checkId, client) {
  return queryOne(
    "UPDATE insurance_eligibility_checks SET concierge_state = 'requested' " +
      "WHERE id = $1 AND concierge_state = 'not_requested' " +
      'RETURNING ' + CHECK_COLUMNS,
    [checkId],
    client
  );
}

// Set the concierge state of a check, optionally appending a note. Used by the
// staff-facing concierge queue. The update is guarded by `fromState`: it only
// applies when the check is still in the state the caller validated the
// transition against, so two staff members acting on the same review at once
// cannot apply a transition against a stale state. A no-op returns null.
async function setConciergeState(checkId, toState, notes, fromState, client) {
  return queryOne(
    'UPDATE insurance_eligibility_checks ' +
      'SET concierge_state = $2, ' +
      '    concierge_notes = COALESCE($3, concierge_notes) ' +
      'WHERE id = $1 AND concierge_state = $4 ' +
      'RETURNING ' + CHECK_COLUMNS,
    [checkId, toState, notes || null, fromState],
    client
  );
}

module.exports = {
  OPEN_CONCIERGE_STATES: OPEN_CONCIERGE_STATES,
  createPolicy: createPolicy,
  findPolicyById: findPolicyById,
  findPoliciesByUser: findPoliciesByUser,
  createCheck: createCheck,
  findCheckById: findCheckById,
  findChecksByUser: findChecksByUser,
  findConciergeQueue: findConciergeQueue,
  requestConcierge: requestConcierge,
  setConciergeState: setConciergeState,
};
