'use strict';

// ============================================================================
// Insurance controller - eligibility and concierge.
// ----------------------------------------------------------------------------
// Two surfaces share the insurance model:
//   - Patient side  (/api/patient/insurance/*)  - submit a policy, run a
//     self-service eligibility check, request a concierge review.
//   - Provider side (/api/provider/insurance/*) - the concierge work queue,
//     gated by the provider/support role.
//
// The member id and group number are insurance identifiers: they are encrypted
// with the PHI encryption service before storage and decrypted only here. The
// API never returns a full member id - only the last four digits, masked.
// ============================================================================

const insuranceModel = require('../models/insurance.model');
const insuranceService = require('../services/insurance');
const userModel = require('../models/user.model');
const encryptionService = require('../services/encryption.service');
const audit = require('../services/audit.service');
const errors = require('../utils/errors');

// The protocol_category enum values, mirrored from database/schema.sql. A
// check may target one of these, or none.
const PROTOCOL_CATEGORIES = [
  'mens_optimization', 'womens_wellness', 'peptide_therapy', 'trt',
  'longevity', 'weight_management', 'sexual_health',
];

// The concierge transitions a staff member may apply. The patient-driven
// 'not_requested' -> 'requested' step is handled separately by requestConcierge;
// 'resolved' and 'closed' are terminal.
const CONCIERGE_TRANSITIONS = {
  requested: ['in_progress', 'closed'],
  in_progress: ['resolved', 'closed'],
};

const MAX_MEMBER_ID_LENGTH = 64;
const MAX_CARRIER_LENGTH = 120;

// Mask a member id to its last four characters: "XXXXXX4321". Returns an empty
// string for a missing value.
function maskMemberId(plain) {
  const s = plain ? String(plain) : '';
  if (s.length === 0) return '';
  if (s.length <= 4) return s;
  return 'XXXXXX' + s.slice(-4);
}

// Shape a policy row for the API: decrypt and mask the member id, never expose
// the raw ciphertext or the group number value.
function presentPolicy(row) {
  return {
    id: row.id,
    carrierName: row.carrier_name,
    planName: row.plan_name,
    memberIdMasked: maskMemberId(encryptionService.decrypt(row.member_id_encrypted)),
    hasGroupNumber: row.group_number_encrypted != null,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

// Shape an eligibility-check row for the API. The checks table holds no
// encrypted data, so the row is returned as-is.
function presentCheck(row) {
  return {
    id: row.id,
    policyId: row.policy_id,
    protocolCategory: row.protocol_category,
    status: row.status,
    coverageSummary: row.coverage_summary,
    copayCents: row.copay_cents,
    deductibleCents: row.deductible_cents,
    conciergeState: row.concierge_state,
    conciergeNotes: row.concierge_notes,
    checkedAt: row.checked_at,
    createdAt: row.created_at,
  };
}

// Validate an optional protocol category. Returns the value (or null), or
// throws a 400 when a non-empty value is not a known category.
function normalizeProtocolCategory(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const value = String(raw).trim();
  if (PROTOCOL_CATEGORIES.indexOf(value) === -1) {
    throw errors.badRequest('That Protocol Category Is Not Recognized.');
  }
  return value;
}

// -- Patient surface ---------------------------------------------------------

// POST /api/patient/insurance/policies
// Submit an insurance policy. The member id and group number are encrypted
// before storage.
async function createPolicy(req, res, next) {
  try {
    const carrierName =
      typeof req.body.carrierName === 'string' ? req.body.carrierName.trim() : '';
    const memberId =
      typeof req.body.memberId === 'string' ? req.body.memberId.trim() : '';
    const groupNumber =
      typeof req.body.groupNumber === 'string' ? req.body.groupNumber.trim() : '';
    const planName =
      typeof req.body.planName === 'string' ? req.body.planName.trim() : '';

    if (carrierName === '' || memberId === '') {
      return next(
        errors.badRequest('A Carrier Name And Member ID Are Required.')
      );
    }
    if (carrierName.length > MAX_CARRIER_LENGTH) {
      return next(errors.unprocessable('That Carrier Name Is Too Long.'));
    }
    if (memberId.length > MAX_MEMBER_ID_LENGTH) {
      return next(errors.unprocessable('That Member ID Is Too Long.'));
    }

    const policy = await insuranceModel.createPolicy({
      userId: req.user.id,
      carrierName: carrierName,
      planName: planName || null,
      memberIdEncrypted: encryptionService.encrypt(memberId),
      groupNumberEncrypted: groupNumber
        ? encryptionService.encrypt(groupNumber)
        : null,
    });

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'insurance_policy.created',
      entityType: 'insurance_policy',
      entityId: policy.id,
      phiAccessed: true,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(201).json({ policy: presentPolicy(policy) });
  } catch (err) {
    next(err);
  }
}

// GET /api/patient/insurance/policies
// The patient's policies, member ids masked.
async function listPolicies(req, res, next) {
  try {
    const rows = await insuranceModel.findPoliciesByUser(req.user.id);
    res.status(200).json({ policies: rows.map(presentPolicy) });
  } catch (err) {
    next(err);
  }
}

// POST /api/patient/insurance/checks
// Run a self-service eligibility check against a policy the patient owns.
async function runCheck(req, res, next) {
  try {
    const policyId = req.body.policyId;
    if (typeof policyId !== 'string' || policyId === '') {
      return next(errors.badRequest('A Policy Must Be Selected.'));
    }
    const protocolCategory = normalizeProtocolCategory(req.body.protocolCategory);

    const policy = await insuranceModel.findPolicyById(policyId);
    if (!policy) {
      return next(errors.notFound('Insurance Policy Not Found.'));
    }
    if (policy.user_id !== req.user.id) {
      return next(
        errors.forbidden('You May Only Check Your Own Insurance Policies.')
      );
    }

    const memberId = encryptionService.decrypt(policy.member_id_encrypted);
    const groupNumber = policy.group_number_encrypted
      ? encryptionService.decrypt(policy.group_number_encrypted)
      : '';

    const outcome = await insuranceService.runEligibilityCheck({
      userId: req.user.id,
      policyId: policy.id,
      carrierName: policy.carrier_name,
      memberId: memberId,
      groupNumber: groupNumber,
      protocolCategory: protocolCategory,
    });

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'insurance.eligibility_checked',
      entityType: 'insurance_eligibility_check',
      entityId: outcome.check.id,
      phiAccessed: true,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(201).json({
      check: presentCheck(outcome.check),
      conciergeRecommended: outcome.conciergeRecommended,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/patient/insurance/checks
// The patient's eligibility-check history.
async function listChecks(req, res, next) {
  try {
    const rows = await insuranceModel.findChecksByUser(req.user.id);
    res.status(200).json({ checks: rows.map(presentCheck) });
  } catch (err) {
    next(err);
  }
}

// POST /api/patient/insurance/checks/:checkId/concierge
// Request an assisted concierge review of a check the patient owns.
async function requestConcierge(req, res, next) {
  try {
    const check = await insuranceModel.findCheckById(req.params.checkId);
    if (!check) {
      return next(errors.notFound('Eligibility Check Not Found.'));
    }
    if (check.user_id !== req.user.id) {
      return next(
        errors.forbidden('You May Only Manage Your Own Eligibility Checks.')
      );
    }

    const updated = await insuranceModel.requestConcierge(check.id);
    if (!updated) {
      return next(
        errors.conflict('A Concierge Review Has Already Been Requested.')
      );
    }

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'insurance.concierge_requested',
      entityType: 'insurance_eligibility_check',
      entityId: check.id,
      phiAccessed: false,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(200).json({ check: presentCheck(updated) });
  } catch (err) {
    next(err);
  }
}

// -- Provider / concierge surface --------------------------------------------

// GET /api/provider/insurance/concierge
// The concierge work queue: open assisted reviews with the patient's name.
async function listConciergeQueue(req, res, next) {
  try {
    const rows = await insuranceModel.findConciergeQueue();

    // Collect unique patient user IDs to avoid duplicate queries
    const userIds = [];
    for (let i = 0; i < rows.length; i += 1) {
      const id = rows[i].user_id;
      if (userIds.indexOf(id) === -1) {
        userIds.push(id);
      }
    }

    // Fetch all patient profiles in a single batch query
    const users = await userModel.findManyByIds(userIds);

    // Map profiles for O(1) in-memory lookup
    const userMap = {};
    for (let i = 0; i < users.length; i += 1) {
      userMap[users[i].id] = users[i];
    }

    const items = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const patient = userMap[row.user_id] || null;
      items.push({
        check: presentCheck(row),
        patient: patient
          ? {
              id: patient.id,
              firstName: patient.first_name,
              lastName: patient.last_name,
            }
          : null,
      });
    }
    res.status(200).json({ queue: items });
  } catch (err) {
    next(err);
  }
}

// POST /api/provider/insurance/concierge/:checkId
// Advance a concierge review. The body carries `state` (the new concierge
// state) and an optional `notes` string.
async function advanceConcierge(req, res, next) {
  try {
    const toState =
      typeof req.body.state === 'string' ? req.body.state.trim() : '';
    const notes =
      typeof req.body.notes === 'string' ? req.body.notes.trim() : '';

    const check = await insuranceModel.findCheckById(req.params.checkId);
    if (!check) {
      return next(errors.notFound('Eligibility Check Not Found.'));
    }

    const allowed = CONCIERGE_TRANSITIONS[check.concierge_state] || [];
    if (allowed.indexOf(toState) === -1) {
      return next(
        errors.conflict(
          'A Concierge Review In That State Cannot Move To The Requested State.'
        )
      );
    }

    // Pass the state the transition was validated against. The model guards
    // the update on it, so a concurrent staff change is detected rather than
    // silently overwritten.
    const updated = await insuranceModel.setConciergeState(
      check.id,
      toState,
      notes || null,
      check.concierge_state
    );
    if (!updated) {
      return next(
        errors.conflict(
          'This Concierge Review Was Just Updated By Someone Else. Please Reload And Try Again.'
        )
      );
    }

    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'insurance.concierge_advanced',
      entityType: 'insurance_eligibility_check',
      entityId: check.id,
      phiAccessed: false,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    });

    res.status(200).json({ check: presentCheck(updated) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  // Exported so the concierge state machine can be unit-tested.
  CONCIERGE_TRANSITIONS: CONCIERGE_TRANSITIONS,
  createPolicy: createPolicy,
  listPolicies: listPolicies,
  runCheck: runCheck,
  listChecks: listChecks,
  requestConcierge: requestConcierge,
  listConciergeQueue: listConciergeQueue,
  advanceConcierge: advanceConcierge,
};
