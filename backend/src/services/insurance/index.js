'use strict';

// ============================================================================
// Insurance service - orchestrates an eligibility check.
// ----------------------------------------------------------------------------
// runEligibilityCheck() is the single entry point used by the controller. It
// runs the eligibility adapter, persists an insurance_eligibility_checks row,
// and tells the caller whether the result should steer the patient toward a
// concierge (assisted) review.
//
// The service receives an already-decrypted member id from the controller and
// never touches ciphertext or the encryption service directly.
// ============================================================================

const adapter = require('./eligibility-adapter');
const insuranceModel = require('../../models/insurance.model');

// Result statuses that should route the patient to a concierge review: an
// undetermined, denied, or errored check all benefit from a human follow-up.
const CONCIERGE_RECOMMENDED_STATUSES = ['needs_review', 'not_eligible', 'error'];

// Run an eligibility check and record it. `input` carries:
//   userId            the patient
//   policyId          the insurance_policies row being checked
//   carrierName       the carrier (for the adapter)
//   memberId          the decrypted member id (for the adapter)
//   groupNumber       the decrypted group number, or '' (for the adapter)
//   protocolCategory  the protocol_category being priced, or null
// Returns { check, conciergeRecommended }.
async function runEligibilityCheck(input) {
  const result = await adapter.checkEligibility({
    carrierName: input.carrierName,
    memberId: input.memberId,
    groupNumber: input.groupNumber,
    protocolCategory: input.protocolCategory,
  });

  const check = await insuranceModel.createCheck({
    policyId: input.policyId,
    userId: input.userId,
    protocolCategory: input.protocolCategory,
    status: result.status,
    coverageSummary: result.coverageSummary,
    copayCents: result.copayCents,
    deductibleCents: result.deductibleCents,
  });

  return {
    check: check,
    conciergeRecommended:
      CONCIERGE_RECOMMENDED_STATUSES.indexOf(result.status) !== -1,
  };
}

module.exports = {
  CONCIERGE_RECOMMENDED_STATUSES: CONCIERGE_RECOMMENDED_STATUSES,
  runEligibilityCheck: runEligibilityCheck,
};
