'use strict';

// ============================================================================
// Unit tests for insurance eligibility and concierge (Feature 4).
// ----------------------------------------------------------------------------
// Covers the four items in the roadmap test plan, all without a database:
//   - eligibility adapter contract (shape, valid status, determinism)
//   - concierge state machine (allowed transitions)
//   - funnel routing (eligible is self-service; the rest route to concierge)
//   - no PHI leakage (the member id never appears in an adapter result)
// Run with: npm test
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');

const adapter = require('../../src/services/insurance/eligibility-adapter');
const insuranceService = require('../../src/services/insurance');
const insuranceModel = require('../../src/models/insurance.model');
const insuranceController = require('../../src/controllers/insurance.controller');

// The insurance_eligibility_status enum values, mirrored from migration 0013.
const VALID_STATUSES = [
  'pending', 'eligible', 'not_eligible', 'needs_review', 'error',
];

test('insurance_adapter_returns_the_contract_shape', async function () {
  const result = await adapter.checkEligibility({
    carrierName: 'Aetna',
    memberId: 'A123456789',
    protocolCategory: 'weight_management',
  });
  assert.ok(result, 'a result is returned');
  assert.ok(
    VALID_STATUSES.indexOf(result.status) !== -1,
    'status is a known enum value'
  );
  assert.equal(typeof result.coverageSummary, 'string');
  assert.ok(result.coverageSummary.length > 0, 'summary is not empty');
  assert.ok(
    result.copayCents === null || typeof result.copayCents === 'number',
    'copayCents is a number or null'
  );
  assert.ok(
    result.deductibleCents === null ||
      typeof result.deductibleCents === 'number',
    'deductibleCents is a number or null'
  );
});

test('insurance_adapter_is_deterministic', async function () {
  // The stub must be repeatable: the same input always yields the same
  // result, so tests and the pre-integration product are predictable.
  const a = await adapter.checkEligibility({
    memberId: 'MEM-DETERMINISM-1',
    protocolCategory: 'trt',
  });
  const b = await adapter.checkEligibility({
    memberId: 'MEM-DETERMINISM-1',
    protocolCategory: 'trt',
  });
  assert.deepEqual(a, b);
});

test('insurance_adapter_empty_member_id_is_an_error', async function () {
  const result = await adapter.checkEligibility({
    memberId: '',
    protocolCategory: 'trt',
  });
  assert.equal(result.status, 'error');
});

test('insurance_adapter_eligible_results_carry_a_copay', async function () {
  // Every 'eligible' result must include a non-negative copay estimate so the
  // patient-facing cost line always has a value to show.
  let sawEligible = false;
  for (let i = 0; i < 60; i += 1) {
    const result = await adapter.checkEligibility({
      memberId: 'SCAN-' + i,
      protocolCategory: 'weight_management',
    });
    if (result.status === 'eligible') {
      sawEligible = true;
      assert.equal(typeof result.copayCents, 'number');
      assert.ok(result.copayCents >= 0);
    }
  }
  assert.equal(sawEligible, true, 'the stub produces eligible results');
});

test('insurance_adapter_never_leaks_the_member_id', async function () {
  // No PHI leakage: a distinctive member id must not surface anywhere in the
  // adapter's result - not in the summary, not in any field.
  const secret = 'SECRET-MEMBER-99887766';
  const result = await adapter.checkEligibility({
    memberId: secret,
    protocolCategory: 'longevity',
  });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.indexOf(secret), -1, 'member id absent from result');
  assert.equal(serialized.indexOf('99887766'), -1, 'member id digits absent');
});

test('insurance_adapter_produces_a_concierge_routing_spread', async function () {
  // Funnel routing: across a range of inputs the stub must produce both
  // self-service-clear ('eligible') and concierge-bound outcomes.
  const seen = {};
  for (let i = 0; i < 100; i += 1) {
    const result = await adapter.checkEligibility({
      memberId: 'SPREAD-' + i,
      protocolCategory: 'weight_management',
    });
    seen[result.status] = true;
  }
  assert.ok(seen.eligible, 'some checks are eligible (self-service clear)');
  assert.ok(
    seen.not_eligible || seen.needs_review,
    'some checks route toward concierge'
  );
});

test('insurance_service_routes_only_unclear_results_to_concierge', function () {
  // Funnel: an eligible check is handled self-service; needs_review,
  // not_eligible, and error are the ones steered to a concierge review.
  assert.deepEqual(insuranceService.CONCIERGE_RECOMMENDED_STATUSES, [
    'needs_review', 'not_eligible', 'error',
  ]);
  assert.equal(
    insuranceService.CONCIERGE_RECOMMENDED_STATUSES.indexOf('eligible'),
    -1,
    'an eligible result is not routed to concierge'
  );
});

test('insurance_concierge_state_machine_allows_only_valid_transitions', function () {
  const transitions = insuranceController.CONCIERGE_TRANSITIONS;
  // A requested review may be picked up or declined.
  assert.deepEqual(transitions.requested.slice().sort(), [
    'closed', 'in_progress',
  ]);
  // An in-progress review may be resolved or closed.
  assert.deepEqual(transitions.in_progress.slice().sort(), [
    'closed', 'resolved',
  ]);
  // Terminal states have no outgoing staff transitions.
  assert.equal(transitions.resolved, undefined);
  assert.equal(transitions.closed, undefined);
  // 'not_requested' -> 'requested' is patient-driven, not a staff transition.
  assert.equal(transitions.not_requested, undefined);
});

test('insurance_model_exposes_policy_and_check_operations', function () {
  const fns = [
    'createPolicy', 'findPolicyById', 'findPoliciesByUser',
    'createCheck', 'findCheckById', 'findChecksByUser',
    'findConciergeQueue', 'requestConcierge', 'setConciergeState',
  ];
  fns.forEach(function (name) {
    assert.equal(typeof insuranceModel[name], 'function', name + ' is exported');
  });
  assert.deepEqual(insuranceModel.OPEN_CONCIERGE_STATES, [
    'requested', 'in_progress',
  ]);
});
