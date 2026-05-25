'use strict';

// ============================================================================
// Unit tests for self-service subscription management (Feature 2).
// ----------------------------------------------------------------------------
// These are pure tests: they assert the model contracts and the patient-facing
// notification template. Requiring a model does not open a database connection
// (the pg Pool connects lazily on first query), so no database is touched.
// The pause/resume WHERE-clause guards are exercised against the live database
// in the integration environment. Run with: npm test
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');

const subscriptionModel = require('../../src/models/subscription.model');
const subscriptionEventModel = require('../../src/models/subscription-event.model');
const templates = require('../../src/services/notification/templates');

test('subscription_model_exposes_pause_and_resume_functions', function () {
  // Arrange / Act: the model is loaded above.
  // Assert: the two new self-service transitions are exported.
  assert.equal(typeof subscriptionModel.pause, 'function');
  assert.equal(typeof subscriptionModel.resume, 'function');
});

test('subscription_model_pausable_statuses_exclude_past_due', function () {
  // Arrange / Act: read the exported allow-list.
  const pausable = subscriptionModel.PAUSABLE_STATUSES;
  // Assert: only genuinely live plans are pausable. A past_due plan must not
  // be pausable - pausing it would mask an unpaid balance. A canceled or
  // already-paused plan is likewise excluded.
  assert.deepEqual(pausable, ['trialing', 'active']);
  assert.equal(pausable.indexOf('past_due'), -1);
  assert.equal(pausable.indexOf('canceled'), -1);
  assert.equal(pausable.indexOf('paused'), -1);
});

test('subscription_event_model_event_types_match_migration_enum', function () {
  // Assert: the event types mirror the subscription_event_type enum defined
  // in migration 0011, in declaration order.
  assert.deepEqual(subscriptionEventModel.EVENT_TYPES, [
    'paused',
    'resumed',
    'canceled',
    'plan_changed',
  ]);
});

test('subscription_event_model_exposes_record_and_lookups', function () {
  // Assert: the append-only audit log model exposes its full surface.
  assert.equal(typeof subscriptionEventModel.record, 'function');
  assert.equal(typeof subscriptionEventModel.findBySubscriptionId, 'function');
  assert.equal(typeof subscriptionEventModel.findByUserId, 'function');
});

test('subscription_changed_template_renders_plan_name_and_change', function () {
  // Arrange
  const payload = {
    firstName: 'Dana',
    planName: 'Metabolic Monthly',
    change: 'Your Plan Was Paused.',
  };
  // Act
  const out = templates.render('subscription_changed', payload);
  // Assert: the rendered body carries both the plan name and the change text.
  assert.ok(out, 'template rendered a result');
  assert.ok(out.text.indexOf('Metabolic Monthly') !== -1, 'plan name present');
  assert.ok(out.text.indexOf('Your Plan Was Paused.') !== -1, 'change present');
  assert.ok(out.subject.length > 0, 'subject not empty');
});

test('subscription_changed_template_tolerates_missing_payload', function () {
  // Arrange / Act: render with no payload fields supplied.
  const out = templates.render('subscription_changed', {});
  // Assert: missing fields fall back to safe defaults, never a literal
  // "undefined" leak.
  assert.ok(out);
  assert.equal(out.text.indexOf('undefined'), -1);
  assert.ok(out.text.length > 0);
});
