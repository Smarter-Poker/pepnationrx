'use strict';

// ============================================================================
// Unit tests for webhooks/verify-signature.js.
// ----------------------------------------------------------------------------
// Covers the plain-HMAC verifier used by the medical-network and pharmacy
// partners, and the Stripe-specific verifier that parses the timestamped
// "t=,v1=" Stripe-Signature header. Run with: npm test
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  computeHmac,
  verifySignature,
  verifyStripeSignature,
} = require('../../src/webhooks/verify-signature');

const SECRET = 'test-webhook-secret';
const BODY = '{"id":"evt_1","type":"payment_intent.succeeded"}';

// -- Plain HMAC verifier (medical-network and pharmacy) ----------------------

test('verifySignature accepts a correct HMAC', function () {
  const sig = computeHmac(BODY, SECRET);
  assert.equal(verifySignature(BODY, sig, SECRET), 'verified');
});

test('verifySignature rejects a tampered body', function () {
  const sig = computeHmac(BODY, SECRET);
  assert.equal(verifySignature(BODY + 'x', sig, SECRET), 'invalid');
});

test('verifySignature reports unconfigured when no secret is set', function () {
  assert.equal(verifySignature(BODY, 'anything', ''), 'unconfigured');
});

test('verifySignature rejects a missing signature header', function () {
  assert.equal(verifySignature(BODY, '', SECRET), 'invalid');
});

// -- Stripe verifier ---------------------------------------------------------

// Build a valid Stripe-Signature header for a body at a given timestamp.
function stripeHeader(body, secret, timestamp) {
  const t = timestamp || Math.floor(Date.now() / 1000);
  const v1 = crypto
    .createHmac('sha256', secret)
    .update(t + '.' + body)
    .digest('hex');
  return 't=' + t + ',v1=' + v1;
}

test('verifyStripeSignature accepts a correctly signed recent event', function () {
  const header = stripeHeader(BODY, SECRET);
  assert.equal(verifyStripeSignature(BODY, header, SECRET), 'verified');
});

test('verifyStripeSignature rejects a tampered body', function () {
  const header = stripeHeader(BODY, SECRET);
  assert.equal(verifyStripeSignature(BODY + 'x', header, SECRET), 'invalid');
});

test('verifyStripeSignature rejects a signature made with the wrong secret', function () {
  const header = stripeHeader(BODY, 'a-different-secret');
  assert.equal(verifyStripeSignature(BODY, header, SECRET), 'invalid');
});

test('verifyStripeSignature rejects an event outside the timestamp tolerance', function () {
  const stale = Math.floor(Date.now() / 1000) - 3600; // one hour old
  const header = stripeHeader(BODY, SECRET, stale);
  assert.equal(verifyStripeSignature(BODY, header, SECRET), 'invalid');
});

test('verifyStripeSignature rejects a header missing the v1 scheme', function () {
  const t = Math.floor(Date.now() / 1000);
  assert.equal(verifyStripeSignature(BODY, 't=' + t, SECRET), 'invalid');
});

test('verifyStripeSignature reports unconfigured when no secret is set', function () {
  const header = stripeHeader(BODY, SECRET);
  assert.equal(verifyStripeSignature(BODY, header, ''), 'unconfigured');
});

test('verifyStripeSignature rejects a plain HMAC in the Stripe slot', function () {
  // A plain HMAC hex string (the old, wrong format) must not verify.
  const plain = computeHmac(BODY, SECRET);
  assert.equal(verifyStripeSignature(BODY, plain, SECRET), 'invalid');
});
