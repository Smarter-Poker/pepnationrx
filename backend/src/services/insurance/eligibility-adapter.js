'use strict';

// ============================================================================
// Insurance eligibility adapter.
// ----------------------------------------------------------------------------
// A single interface, checkEligibility(input), behind which a real benefits
// API (Stedi, Availity, a clearinghouse, etc.) can later be wired without
// changing any caller. Until that integration exists, a deterministic stub
// resolves every check: the same member id and protocol category always yield
// the same result, so tests and the pre-integration product behave
// predictably.
//
// The adapter is pure: it performs no database or network I/O. It receives a
// plaintext member id from the controller (which owns decryption) and never
// stores or logs it.
// ============================================================================

const crypto = require('crypto');

// The result shape every adapter implementation must return:
//   status           one of insurance_eligibility_status (not 'pending')
//   coverageSummary  a non-PHI, Title Case, patient-facing sentence
//   copayCents       estimated patient copay, or null when unknown
//   deductibleCents  remaining deductible, or null when unknown

// Derive stable pseudo-random bytes from the member id and protocol category.
// A hash keeps the stub deterministic without storing any lookup table.
function deterministicBytes(memberId, protocolCategory) {
  return crypto
    .createHash('sha256')
    .update(String(memberId) + '|' + String(protocolCategory || ''))
    .digest();
}

// The deterministic stub. Roughly 60% of member ids resolve eligible, 20%
// not eligible, 20% needs-review - a spread that exercises every downstream
// path (copay display, self-pay messaging, concierge routing).
function stubCheck(input) {
  const memberId = input && input.memberId ? String(input.memberId).trim() : '';
  if (memberId === '') {
    return {
      status: 'error',
      coverageSummary: 'A Member ID Is Required To Check Eligibility.',
      copayCents: null,
      deductibleCents: null,
    };
  }

  const bytes = deterministicBytes(memberId, input.protocolCategory);
  const bucket = bytes[0] % 10;

  if (bucket < 6) {
    return {
      status: 'eligible',
      coverageSummary:
        'Your Plan Appears To Cover This Protocol Category. An Estimated ' +
        'Copay Is Shown Below. Final Cost Is Confirmed With Your Carrier.',
      copayCents: 1500 + (bytes[1] % 60) * 100,
      deductibleCents: (bytes[2] % 5) * 10000,
    };
  }
  if (bucket < 8) {
    return {
      status: 'not_eligible',
      coverageSummary:
        'Your Plan Does Not Appear To Cover This Protocol Category. You May ' +
        'Still Proceed As A Self-Pay Patient At Our Standard Pricing.',
      copayCents: null,
      deductibleCents: null,
    };
  }
  return {
    status: 'needs_review',
    coverageSummary:
      'Your Coverage Could Not Be Determined Automatically. A Concierge ' +
      'Review By Our Team Is Recommended.',
    copayCents: null,
    deductibleCents: null,
  };
}

// Check eligibility for one policy and protocol category. Always resolves to a
// result object; never rejects - an adapter failure is reported as an 'error'
// status so the caller can route the patient to concierge help.
async function checkEligibility(input) {
  try {
    return stubCheck(input || {});
  } catch (err) {
    return {
      status: 'error',
      coverageSummary:
        'We Could Not Check Your Eligibility Right Now. A Concierge Review ' +
        'Is Recommended.',
      copayCents: null,
      deductibleCents: null,
    };
  }
}

module.exports = {
  checkEligibility: checkEligibility,
};
