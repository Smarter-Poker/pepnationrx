'use strict';

// ============================================================================
// Intake submission model - data-access layer for the intake_submissions table.
// ----------------------------------------------------------------------------
// One row per clinical triage submission. answers_encrypted holds the full
// PHI answer set as an encrypted payload; triage_flags holds only the derived,
// non-identifying routing booleans. The medical_network_submission_id ties a
// local submission to the network's record once it has been forwarded.
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, user_id, protocol_category, status, risk_level, triage_flags, ' +
  'medical_network_submission_id, submitted_at, reviewed_at, created_at, updated_at';

// Insert a new intake submission. answersEncrypted is a Buffer or null.
async function create(data) {
  return queryOne(
    'INSERT INTO intake_submissions ' +
      '(user_id, protocol_category, status, risk_level, ' +
      ' answers_encrypted, triage_flags, submitted_at) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, now()) ' +
      'RETURNING ' + COLUMNS,
    [
      data.userId,
      data.protocolCategory,
      data.status || 'submitted',
      data.riskLevel || null,
      data.answersEncrypted || null,
      JSON.stringify(data.triageFlags || {}),
    ]
  );
}

// Find a submission by primary key.
async function findById(id) {
  return queryOne('SELECT ' + COLUMNS + ' FROM intake_submissions WHERE id = $1', [id]);
}

// Find a submission by the id assigned by the medical network.
async function findByMedicalNetworkId(medicalNetworkSubmissionId) {
  return queryOne(
    'SELECT ' + COLUMNS +
      ' FROM intake_submissions WHERE medical_network_submission_id = $1',
    [medicalNetworkSubmissionId]
  );
}

// Record the id the medical network returned for a forwarded submission and
// move the submission into clinical review.
async function attachMedicalNetworkId(id, medicalNetworkSubmissionId) {
  return queryOne(
    'UPDATE intake_submissions ' +
      "SET medical_network_submission_id = $2, status = 'in_review' " +
      'WHERE id = $1 RETURNING ' + COLUMNS,
    [id, medicalNetworkSubmissionId]
  );
}

// Update the submission status. reviewed_at is stamped when the status
// reflects a completed clinical review.
async function updateStatus(id, status) {
  const reviewedStates = ['approved', 'denied', 'needs_more_info'];
  const stampReviewed = reviewedStates.indexOf(status) !== -1;
  await query(
    'UPDATE intake_submissions SET status = $2' +
      (stampReviewed ? ', reviewed_at = now()' : '') +
      ' WHERE id = $1',
    [id, status]
  );
}

module.exports = {
  create: create,
  findById: findById,
  findByMedicalNetworkId: findByMedicalNetworkId,
  attachMedicalNetworkId: attachMedicalNetworkId,
  updateStatus: updateStatus,
};
