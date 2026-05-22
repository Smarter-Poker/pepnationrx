'use strict';

// ============================================================================
// Unit tests for config/constants.js.
// ----------------------------------------------------------------------------
// Confirms the enum mirrors, the tri-party fee split, and the MSO disclosure
// stay internally consistent. Run with: npm test
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');

const constants = require('../../src/config/constants');

test('USER_ROLES mirrors the database user_role enum', function () {
  assert.deepEqual(constants.USER_ROLES, [
    'patient',
    'provider',
    'pharmacist',
    'affiliate',
    'admin',
    'support',
  ]);
});

test('LOGIN_BLOCKED_STATUS blocks suspended and closed accounts', function () {
  assert.ok(constants.LOGIN_BLOCKED_STATUS.includes('suspended'));
  assert.ok(constants.LOGIN_BLOCKED_STATUS.includes('closed'));
  assert.ok(!constants.LOGIN_BLOCKED_STATUS.includes('active'));
});

test('CONSENT_TYPES carries the checkout-stage consent types', function () {
  assert.equal(constants.CONSENT_TYPES.MSO_BILLING_AGENT, 'mso_billing_agent');
  assert.equal(
    constants.CONSENT_TYPES.TELEHEALTH_INFORMED_CONSENT,
    'telehealth_informed_consent'
  );
});

test('FEE_SPLIT defines a flat consult fee and a percent management fee', function () {
  assert.equal(typeof constants.FEE_SPLIT.consultFeeCents, 'number');
  assert.ok(constants.FEE_SPLIT.consultFeeCents > 0);
  assert.ok(Number.isInteger(constants.FEE_SPLIT.consultFeeCents));
  assert.ok(constants.FEE_SPLIT.managementFeePct > 0);
  assert.ok(constants.FEE_SPLIT.managementFeePct < 100);
});

test('MSO_DISCLOSURE names PepNationRX as the designated billing agent', function () {
  assert.ok(constants.MSO_DISCLOSURE.includes('designated billing agent'));
  assert.ok(constants.MSO_DISCLOSURE.includes('503A'));
});

test('the constants module is frozen', function () {
  assert.ok(Object.isFrozen(constants));
  assert.ok(Object.isFrozen(constants.FEE_SPLIT));
});
