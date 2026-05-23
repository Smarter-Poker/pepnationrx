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
const pharmacyModel = require('../../models/pharmacy.model');
const addressModel = require('../../models/address.model');
const audit = require('../audit.service');
const orderRouter = require('../pharmacy/order-router');
const { mapNetworkStatusToIntakeStatus } = require('./intake-mapper');

// Route a signed prescription to the default 503A compounding pharmacy for
// fulfillment. Best-effort: a failure - including no pharmacy contracted yet -
// is logged and leaves the prescription un-routed rather than failing the
// webhook. DTC telehealth platforms transmit an approved prescription to their
// fulfillment pharmacy immediately on signing; the prescription is written
// only after the patient has subscribed, so a signed prescription already
// implies a paid patient. Routing is idempotent in the order router, so a
// webhook replay that re-enters this path returns the existing pharmacy order
// rather than creating a duplicate.
async function routeToPharmacy(prescription) {
  try {
    const pharmacy = await pharmacyModel.findDefaultActive();
    if (!pharmacy) {
      logger.warn('No active pharmacy configured; prescription left un-routed', {
        prescriptionId: prescription.id,
      });
      return;
    }
    // addresses are returned default-first, so the first row is the patient's
    // default shipping address when one has been recorded.
    const addresses = await addressModel.findByUserId(prescription.user_id);
    const shippingAddress = addresses[0] || null;
    await orderRouter.routeApprovedPrescription({
      prescription: prescription,
      pharmacyId: pharmacy.id,
      shippingAddressId: shippingAddress ? shippingAddress.id : null,
    });
  } catch (err) {
    logger.error('Pharmacy routing failed; prescription left un-routed', {
      prescriptionId: prescription.id,
      message: err.message,
    });
  }
}

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
    // A replay still ensures the prescription is routed: if the first
    // delivery created the prescription but routing was skipped (no pharmacy
    // contracted at the time), this re-attempts it. Routing is idempotent.
    await routeToPharmacy(existing);
    return existing;
  }

  const rx = payload.prescription || {};
  // B-11: providerModel.findOrCreateByExternalId is an upsert that can INSERT.
  // Running it outside the prescription transaction risks an orphaned provider
  // row if the transaction later rolls back. Move it inside the transaction
  // so it commits or rolls back as part of the same unit of work.

  let prescription;
  try {
    prescription = await withTransaction(async function (client) {
      // B-11: run the provider upsert inside the transaction so a rollback
      // doesn't leave an orphaned provider row.
      const provider = await providerModel.findOrCreateByExternalId(
        {
          externalProviderId: payload.provider && payload.provider.externalId,
          fullName: payload.provider && payload.provider.fullName,
          npiNumber: payload.provider && payload.provider.npi,
          credentials: payload.provider && payload.provider.credentials,
          licensedStates: (payload.provider && payload.provider.licensedStates) || [],
        },
        client
      );
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
  } catch (err) {
    // A second signed-prescription event for this submission, processed
    // concurrently, can slip past the findByIntakeSubmissionId check above and
    // trip the prescriptions_one_per_intake unique index (SQLSTATE 23505).
    // Resolve to the prescription the winning event created rather than
    // failing: the end state - one prescription, intake approved - already
    // holds, and routeToPharmacy is idempotent.
    if (err && err.code === '23505') {
      const winner = await prescriptionModel.findByIntakeSubmissionId(submission.id);
      if (winner) {
        logger.info('Concurrent signed-prescription race; using the winning prescription', {
          intakeSubmissionId: submission.id,
        });
        await routeToPharmacy(winner);
        return winner;
      }
    }
    throw err;
  }

  await audit.record({
    actorUserId: submission.user_id,
    action: 'prescription.created',
    entityType: 'prescription',
    entityId: prescription.id,
    phiAccessed: true,
    metadata: { intakeSubmissionId: submission.id },
  });

  // Route the signed prescription to the fulfillment pharmacy. Best-effort:
  // it never fails the webhook, and it is idempotent on replay.
  await routeToPharmacy(prescription);

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

  // B-08: wrap both the status update and the audit record in a single
  // transaction. Without this, a crash between the two leaves the intake
  // status changed but no audit event — a HIPAA compliance gap.
  await withTransaction(async function (client) {
    await intakeModel.updateStatus(submission.id, status, client);
    await audit.record({
      actorUserId: submission.user_id,
      action: 'intake.review_decision',
      entityType: 'intake_submission',
      entityId: submission.id,
      phiAccessed: true,
      metadata: { decision: status },
    });
  });

  return intakeModel.findById(submission.id);
}

module.exports = {
  applySignedPrescription: applySignedPrescription,
  applyReviewDecision: applyReviewDecision,
};
