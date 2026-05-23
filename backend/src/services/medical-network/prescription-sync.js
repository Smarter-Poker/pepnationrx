'use strict';

// ============================================================================
// Prescription sync.
// ----------------------------------------------------------------------------
// Applies the outcome of a clinical review delivered by the medical network
// webhook. A signed prescription creates a prescriptions row and advances the
// intake submission; a denial or information request only advances the intake
// submission. Every PHI-touching write is audited.
// ============================================================================

const { withTransaction } = require('../../db/query');
const logger = require('../../utils/logger');
const intakeModel = require('../../models/intake-submission.model');
const providerModel = require('../../models/provider.model');
const prescriptionModel = require('../../models/prescription.model');
const audit = require('../audit.service');
const { mapNetworkStatusToIntakeStatus } = require('./intake-mapper');

// Apply a signed prescription. `payload` is the verified webhook body:
//   medicalNetworkSubmissionId  the network's id for the intake
//   provider                    { externalId, fullName, npi, credentials,
//                                 licensedStates }
//   prescription                { drugCompound, strength, dosageProtocol,
//                                 sigDirections, quantity, daysSupply,
//                                 refillsAuthorized, writtenDate,
//                                 expirationDate, signedPayloadRef }
// Returns the created prescription, or null when the submission is unknown.
async function applySignedPrescription(payload) {
  const submission = await intakeModel.findByMedicalNetworkId(
    payload.medicalNetworkSubmissionId
  );
  if (!submission) {
    logger.warn('Signed prescription for an unknown intake submission', {
      medicalNetworkSubmissionId: payload.medicalNetworkSubmissionId,
    });
    return null;
  }

  // Idempotency guard: a re-delivered signed-prescription webhook (a network
  // retry, or a retry of a previously failed event) must not create a second
  // prescription. If one already exists for this submission, return it.
  const existing = await prescriptionModel.findByIntakeSubmissionId(submission.id);
  if (existing) {
    logger.info('Signed prescription already applied; treating webhook as a replay', {
      intakeSubmissionId: submission.id,
    });
    return existing;
  }

  const rx = payload.prescription || {};
  const provider = await providerModel.findOrCreateByExternalId({
    externalProviderId: payload.provider && payload.provider.externalId,
    fullName: payload.provider && payload.provider.fullName,
    npiNumber: payload.provider && payload.provider.npi,
    credentials: payload.provider && payload.provider.credentials,
    licensedStates: (payload.provider && payload.provider.licensedStates) || [],
  });

  // The prescription insert and the intake-status advance must be atomic, so
  // both run on the transaction's client - a failure after the insert rolls
  // the prescription back rather than orphaning it against a stale intake.
  const prescription = await withTransaction(async function (client) {
    const created = await prescriptionModel.create(
      {
        userId: submission.user_id,
        intakeSubmissionId: submission.id,
        providerId: provider.id,
        drugCompound: rx.drugCompound,
        strength: rx.strength,
        dosageProtocol: rx.dosageProtocol,
        sigDirections: rx.sigDirections,
        quantity: rx.quantity,
        daysSupply: rx.daysSupply,
        refillsAuthorized: rx.refillsAuthorized || 0,
        status: 'approved',
        writtenDate: rx.writtenDate,
        expirationDate: rx.expirationDate,
        signedPayloadRef: rx.signedPayloadRef,
      },
      client
    );
    await intakeModel.updateStatus(submission.id, 'approved', client);
    return created;
  });

  await audit.record({
    actorUserId: submission.user_id,
    action: 'prescription.created',
    entityType: 'prescription',
    entityId: prescription.id,
    phiAccessed: true,
    metadata: { intakeSubmissionId: submission.id },
  });

  return prescription;
}

// Apply a non-prescription review decision (denied or needs_more_info).
// Returns the updated intake submission, or null when it is unknown.
async function applyReviewDecision(payload) {
  const submission = await intakeModel.findByMedicalNetworkId(
    payload.medicalNetworkSubmissionId
  );
  if (!submission) {
    logger.warn('Review decision for an unknown intake submission', {
      medicalNetworkSubmissionId: payload.medicalNetworkSubmissionId,
    });
    return null;
  }

  const status = mapNetworkStatusToIntakeStatus(payload.decision);
  // A review-decision webhook may only deny or request more information. An
  // 'approved' outcome must come from applySignedPrescription, which also
  // creates the prescription - never from this path, which creates none. This
  // blocks a denied-typed event whose decision field claims approval.
  if (status !== 'denied' && status !== 'needs_more_info') {
    logger.warn('Review decision mapped to an unexpected status; ignoring', {
      decision: payload.decision,
      mapped: status,
    });
    return null;
  }
  await intakeModel.updateStatus(submission.id, status);

  await audit.record({
    actorUserId: submission.user_id,
    action: 'intake.review_decision',
    entityType: 'intake_submission',
    entityId: submission.id,
    phiAccessed: true,
    metadata: { decision: status },
  });

  return intakeModel.findById(submission.id);
}

module.exports = {
  applySignedPrescription: applySignedPrescription,
  applyReviewDecision: applyReviewDecision,
};
