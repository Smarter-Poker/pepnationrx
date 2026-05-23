'use strict';

// ============================================================================
// Unit tests for services/notification/templates.js.
// ----------------------------------------------------------------------------
// Templates are pure functions: a non-PHI payload in, a { subject, text } pair
// out. These tests confirm every template renders, tolerates missing payload
// fields, keeps the subject in Title Case, and that an unknown key fails
// safely. Run with: npm test
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');

const templates = require('../../src/services/notification/templates');

test('every known template renders a subject and text', function () {
  templates.TEMPLATE_KEYS.forEach(function (key) {
    const out = templates.render(key, {
      firstName: 'Dana',
      treatmentName: 'Semaglutide',
      planName: 'Monthly',
      status: 'shipped',
      trackingNumber: '1Z999',
      renewalDate: '2026-06-01',
      amount: '$299.00',
      dueDate: '2026-06-10',
      change: 'paused',
    });
    assert.ok(out, 'render returned a result for ' + key);
    assert.equal(typeof out.subject, 'string');
    assert.equal(typeof out.text, 'string');
    assert.ok(out.subject.length > 0, 'subject not empty for ' + key);
    assert.ok(out.text.length > 0, 'text not empty for ' + key);
  });
});

test('templates tolerate a missing payload', function () {
  templates.TEMPLATE_KEYS.forEach(function (key) {
    const out = templates.render(key, {});
    assert.ok(out, 'render with empty payload for ' + key);
    assert.ok(out.text.indexOf('undefined') === -1, 'no undefined leak in ' + key);
    assert.ok(out.subject.length > 0);
  });
});

test('templates tolerate a null payload', function () {
  const out = templates.render('prescription_signed', null);
  assert.ok(out);
  assert.ok(out.text.indexOf('there') !== -1, 'falls back to a generic greeting');
});

test('subject lines are Title Case (every word capitalized)', function () {
  templates.TEMPLATE_KEYS.forEach(function (key) {
    const subject = templates.render(key, {}).subject;
    subject.split(' ').forEach(function (word) {
      const first = word.charAt(0);
      if (first >= 'a' && first <= 'z') {
        assert.fail('Subject for ' + key + ' is not Title Case: ' + subject);
      }
    });
  });
});

test('an unknown template key returns null, not a partial render', function () {
  assert.equal(templates.render('does_not_exist', {}), null);
  assert.equal(templates.exists('does_not_exist'), false);
});

test('exists() is true for every advertised key', function () {
  templates.TEMPLATE_KEYS.forEach(function (key) {
    assert.equal(templates.exists(key), true, key + ' should exist');
  });
});

test('shipment_update includes the tracking number when supplied', function () {
  const withTracking = templates.render('shipment_update', {
    trackingNumber: 'TRK-12345',
  });
  assert.ok(withTracking.text.indexOf('TRK-12345') !== -1);
  const withoutTracking = templates.render('shipment_update', {});
  assert.ok(withoutTracking.text.indexOf('Tracking number') === -1);
});

test('no template body contains an emoji', function () {
  // The platform forbids emojis anywhere. Scan rendered output across the
  // common pictographic and symbol ranges.
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
  templates.TEMPLATE_KEYS.forEach(function (key) {
    const out = templates.render(key, { firstName: 'Dana' });
    assert.equal(emoji.test(out.subject), false, 'subject emoji in ' + key);
    assert.equal(emoji.test(out.text), false, 'body emoji in ' + key);
  });
});
