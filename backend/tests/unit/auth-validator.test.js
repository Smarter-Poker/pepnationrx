'use strict';

// ============================================================================
// Unit tests for validators/auth.validator.js.
// ----------------------------------------------------------------------------
// Focuses on the registration schema, in particular the state-of-residence
// field added so a telehealth encounter can be routed to the correct visit
// modality. Run with: npm test
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');

const { registerSchema } = require('../../src/validators/auth.validator');

// A minimal valid registration body, cloned per test.
function validRegistration() {
  return {
    email: 'patient@example.com',
    password: 'a-strong-password',
    firstName: 'Pat',
    lastName: 'Doe',
    state: 'TX',
  };
}

test('auth_register_well_formed_body_is_accepted', function () {
  const result = registerSchema.safeParse(validRegistration());
  assert.equal(result.success, true);
});

test('auth_register_state_is_uppercased', function () {
  const body = validRegistration();
  body.state = 'tx';
  const result = registerSchema.safeParse(body);
  assert.equal(result.success, true);
  assert.equal(result.data.state, 'TX');
});

test('auth_register_omitted_state_is_accepted', function () {
  // State is optional at the API layer so older clients still register.
  const body = validRegistration();
  delete body.state;
  assert.equal(registerSchema.safeParse(body).success, true);
});

test('auth_register_non_two_letter_state_is_rejected', function () {
  const body = validRegistration();
  body.state = 'Texas';
  assert.equal(registerSchema.safeParse(body).success, false);
});

test('auth_register_numeric_state_is_rejected', function () {
  const body = validRegistration();
  body.state = '12';
  assert.equal(registerSchema.safeParse(body).success, false);
});

test('auth_register_short_password_is_rejected', function () {
  const body = validRegistration();
  body.password = 'short';
  assert.equal(registerSchema.safeParse(body).success, false);
});

test('auth_register_malformed_email_is_rejected', function () {
  const body = validRegistration();
  body.email = 'not-an-email';
  assert.equal(registerSchema.safeParse(body).success, false);
});
