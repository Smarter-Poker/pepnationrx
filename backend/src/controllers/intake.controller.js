'use strict';

// ============================================================================
// Intake controller.
// ----------------------------------------------------------------------------
// Accepts a completed triage submission, stores it with the PHI answer set
// encrypted, and forwards it to the medical network for clinical review when
// the integration is configured. A forwarding failure does not fail the
// request: the submission is persisted and can be retried.
// ============================================================================

const errors = require('../utils/errors');
const logger = require('../utils/logger');
const encryptionService = require('../services/encryption.service');
const intakeModel = require('../models/intake-submission.model');
const userModel = require('../models/user.model');
const audit = require('../services/audit.service');
const medicalNetworkClient = require('../services/medical-network/client');
const intakeMapper = require('../services/medical-network/intake-mapper');

// Roles permitted to read a submission that is not their own.
const STAFF_ROLES = ['admin', 'support'];

// Collect the non-PHI request metadata recorded in audit_log.
function requestMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') || null };
}

// POST /api/intake - submit a completed triage questionnaire.
async function submit(req, res, next) {
  try {
    const input = req.body;
    const meta = requestMeta(req);

    // Persist the submission with the answer set encrypted at the app layer.
    const submission = await intakeModel.create({
      userId: req.user.id,
      protocolCategory: input.protocolCategory,
      status: 'submitted',
      riskLevel: input.riskLevel,
      answersEncrypted: encryptionService.encryptJson(input.answers),
      triageFlags: input.triageFlags || {},
    });

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'intake.submitted',
      entityType: 'intake_submission',
      entityId: submission.id,
      phiAccessed: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    // Forward to the medical network when configured. A failure here is
    // logged, not surfaced; the submission stays 'submitted' for retry.
    let forwarded = submission;
    if (medicalNetworkClient.isConfigured()) {
      try {
        const user = await userModel.findById(req.user.id);
        const payload = intakeMapper.toNetworkPayload({
          submission: {
            id: submission.id,
            protocolCategory: submission.protocol_category,
            riskLevel: submission.risk_level,
            triageFlags: submission.triage_flags,
          },
          patient: {
            userId: req.user.id,
            dateOfBirth: user ? user.date_of_birth : null,
            sexAtBirth: user ? user.sex_at_birth : null,
            // The patient's state of residence drives the medical network's
            // sync vs async visit routing; it is captured at registration.
            state: user ? user.state : null,
          },
          answers: input.answers,
        });
        const result = await medicalNetworkClient.submitIntake(payload);
        if (result && result.submissionId) {
          forwarded = await intakeModel.attachMedicalNetworkId(
            submission.id,
            result.submissionId
          );
        }
      } catch (err) {
        logger.error('Intake forwarding to the medical network failed', {
          intakeSubmissionId: submission.id,
          message: err.message,
        });
      }
    }

    res.status(201).json({ submission: forwarded });
  } catch (err) {
    next(err);
  }
}

// GET /api/intake/:id - read one submission's status (no PHI is returned).
async function getOne(req, res, next) {
  try {
    const submission = await intakeModel.findById(req.params.id);
    if (!submission) {
      throw errors.notFound('Intake submission not found.');
    }
    const isOwner = submission.user_id === req.user.id;
    const isStaff = STAFF_ROLES.indexOf(req.user.role) !== -1;
    if (!isOwner && !isStaff) {
      throw errors.forbidden('You may not view this intake submission.');
    }

    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'intake.viewed',
      entityType: 'intake_submission',
      entityId: submission.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    res.status(200).json({ submission: submission });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submit: submit,
  getOne: getOne,
};
