'use strict';

// ============================================================================
// Intake mapper.
// ----------------------------------------------------------------------------
// Pure functions that translate between the PepNationRX intake representation
// and the medical network's expected schema. No DOM, no database, no network -
// this module is fully unit-testable.
// ============================================================================

// States whose telemedicine rules require a synchronous (phone or video)
// visit rather than an asynchronous-only encounter. Representative list;
// the medical network remains the source of truth and may override it.
const SYNC_VISIT_STATES = ['AR', 'DE', 'ID', 'KS', 'LA', 'MS', 'WV'];

// True when a patient's state requires a synchronous visit.
function requiresSyncVisit(state) {
  if (!state) return false;
  return SYNC_VISIT_STATES.indexOf(String(state).toUpperCase()) !== -1;
}

// Build the payload the medical network expects for a new intake submission.
// `answers` is the decrypted PHI answer set; it is sent only over the
// client's TLS channel and is never logged.
function toNetworkPayload(input) {
  const submission = input.submission || {};
  const patient = input.patient || {};
  return {
    externalSubmissionId: submission.id,
    protocol: submission.protocolCategory,
    preliminaryRiskLevel: submission.riskLevel || 'low',
    triageFlags: submission.triageFlags || {},
    patient: {
      externalPatientId: patient.userId,
      state: patient.state || null,
      dateOfBirth: patient.dateOfBirth || null,
      sexAtBirth: patient.sexAtBirth || null,
    },
    encounter: {
      modality: requiresSyncVisit(patient.state) ? 'synchronous' : 'asynchronous',
    },
    intakeAnswers: input.answers || {},
  };
}

// Translate a status string from the medical network onto the intake_status
// enum used in the database. Unknown values fall back to 'in_review'.
function mapNetworkStatusToIntakeStatus(networkStatus) {
  const map = {
    received: 'in_review',
    in_review: 'in_review',
    pending: 'in_review',
    needs_more_info: 'needs_more_info',
    information_requested: 'needs_more_info',
    approved: 'approved',
    prescribed: 'approved',
    denied: 'denied',
    declined: 'denied',
  };
  return map[networkStatus] || 'in_review';
}

module.exports = {
  SYNC_VISIT_STATES: SYNC_VISIT_STATES,
  requiresSyncVisit: requiresSyncVisit,
  toNetworkPayload: toNetworkPayload,
  mapNetworkStatusToIntakeStatus: mapNetworkStatusToIntakeStatus,
};
