'use strict';

// ============================================================================
// Unit tests for patient-to-provider secure messaging (Feature 3).
// ----------------------------------------------------------------------------
// Pure tests: they cover the model contract, PHI encryption of message bodies
// at rest, role authorization for the provider surface, and the new_message
// notification template. Database-backed behavior (post/read round-trip,
// unread-count accuracy) is exercised in the integration environment; the
// authorization and encryption guarantees below are the security-critical
// pieces and are fully testable in isolation. Run with: npm test
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');

const messageModel = require('../../src/models/message.model');
const encryptionService = require('../../src/services/encryption.service');
const templates = require('../../src/services/notification/templates');
const authorize = require('../../src/middleware/authorize');

test('message_model_exposes_thread_and_message_operations', function () {
  // Assert: the data-access surface the controller depends on is present.
  const fns = [
    'findOpenThreadByPatient',
    'findThreadById',
    'findThreadsByPatient',
    'findOpenThreads',
    'getOrCreateOpenThread',
    'assignProviderIfUnset',
    'addMessage',
    'findMessagesByThread',
    'markMessagesRead',
    'unreadCountForPatient',
    'unreadCountForClinicians',
    'unreadCountForThread',
  ];
  fns.forEach(function (name) {
    assert.equal(typeof messageModel[name], 'function', name + ' is exported');
  });
});

test('messaging_message_body_is_encrypted_at_rest_and_recoverable', function () {
  // Arrange: a realistic clinical message body.
  const plaintext = 'I have a question about my dose schedule this week.';
  // Act: encrypt as the controller does before the body reaches the database.
  const encrypted = encryptionService.encrypt(plaintext);
  // Assert: the stored value is a Buffer that does not expose the plaintext,
  // and decrypts back to exactly the original.
  assert.ok(Buffer.isBuffer(encrypted), 'ciphertext is a Buffer');
  assert.equal(
    encrypted.toString('latin1').indexOf('dose schedule'),
    -1,
    'plaintext does not survive in the ciphertext'
  );
  assert.equal(encryptionService.decrypt(encrypted), plaintext);
});

test('messaging_each_encryption_uses_a_fresh_iv', function () {
  // Arrange / Act: encrypt the same body twice.
  const a = encryptionService.encrypt('See you at the follow-up.');
  const b = encryptionService.encrypt('See you at the follow-up.');
  // Assert: a random IV per call means identical plaintext yields different
  // ciphertext, yet both decrypt correctly.
  assert.notDeepEqual(a, b);
  assert.equal(encryptionService.decrypt(a), 'See you at the follow-up.');
  assert.equal(encryptionService.decrypt(b), 'See you at the follow-up.');
});

test('messaging_provider_surface_rejects_a_patient_role', function () {
  // Arrange: the guard used by every /api/provider/messages route.
  const guard = authorize('provider', 'support');
  let captured = null;
  // Act: a patient attempts to reach the clinician surface.
  guard({ user: { role: 'patient' } }, {}, function (err) {
    captured = err;
  });
  // Assert: rejected with a 403.
  assert.ok(captured, 'a patient is rejected');
  assert.equal(captured.statusCode, 403);
});

test('messaging_provider_surface_admits_provider_and_support_roles', function () {
  const guard = authorize('provider', 'support');
  ['provider', 'support'].forEach(function (role) {
    let err;
    let passed = false;
    guard({ user: { role: role } }, {}, function (e) {
      if (e) err = e;
      else passed = true;
    });
    assert.equal(err, undefined, role + ' is not rejected');
    assert.equal(passed, true, role + ' is admitted');
  });
});

test('messaging_new_message_template_renders_and_omits_the_body', function () {
  // Act
  const out = templates.render('new_message', {
    firstName: 'Dana',
    senderName: 'Dr. Lee',
  });
  // Assert: the email names the sender but, for security, never carries the
  // message body itself.
  assert.ok(out, 'template rendered');
  assert.ok(out.subject.length > 0, 'subject not empty');
  assert.ok(out.text.indexOf('Dr. Lee') !== -1, 'sender name present');
  assert.ok(
    out.text.toLowerCase().indexOf('not included') !== -1,
    'body is explicitly not in the email'
  );
});

test('messaging_new_message_template_tolerates_missing_payload', function () {
  const out = templates.render('new_message', {});
  assert.ok(out);
  assert.equal(out.text.indexOf('undefined'), -1);
  assert.ok(out.text.length > 0);
});
