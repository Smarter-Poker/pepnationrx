'use strict';

// ============================================================================
// Webhook signature verification.
// ----------------------------------------------------------------------------
// Every inbound webhook is signed by its source with a shared secret. The
// sender computes an HMAC-SHA256 over the raw request body and sends it in a
// header; this module recomputes that HMAC and compares it in constant time.
//
// When a source has no secret configured (local development), verification is
// skipped and the caller is told so it can log a warning - it must never be
// skipped silently in production.
// ============================================================================

const crypto = require('crypto');

// Compute the hex HMAC-SHA256 of a raw body buffer with a secret.
function computeHmac(rawBody, secret) {
  const buffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''));
  return crypto.createHmac('sha256', secret).update(buffer).digest('hex');
}

// Constant-time comparison of two signature strings. Both inputs are padded
// to the same length before calling timingSafeEqual so a length mismatch does
// not leak the expected length as a timing side-channel. B-03.
function safeEqual(a, b) {
  const bufferA = Buffer.from(String(a || ''), 'utf8');
  const bufferB = Buffer.from(String(b || ''), 'utf8');
  const maxLen = Math.max(bufferA.length, bufferB.length);
  const paddedA = Buffer.concat([bufferA, Buffer.alloc(maxLen - bufferA.length)]);
  const paddedB = Buffer.concat([bufferB, Buffer.alloc(maxLen - bufferB.length)]);
  return crypto.timingSafeEqual(paddedA, paddedB) && bufferA.length === bufferB.length;
}

// Verify a webhook signature.
//   rawBody          the exact request body buffer (req.rawBody)
//   providedSignature the signature header value the sender supplied
//   secret           the shared secret for this source, or '' when unset
// Returns one of: 'verified', 'invalid', 'unconfigured'.
//
// This is the plain-HMAC scheme used by the medical-network and pharmacy
// partners, whose header carries only the hex digest. Stripe uses a different
// header format and has its own verifier below.
function verifySignature(rawBody, providedSignature, secret) {
  if (!secret) return 'unconfigured';
  if (!providedSignature) return 'invalid';
  const expected = computeHmac(rawBody, secret);
  return safeEqual(expected, providedSignature) ? 'verified' : 'invalid';
}

// How far the Stripe event timestamp may be from now, in seconds. A signed
// payload older than this is rejected to blunt replay attacks.
const STRIPE_TOLERANCE_SECONDS = 300;

// Verify a Stripe webhook signature.
// ----------------------------------------------------------------------------
// Stripe does NOT send a plain HMAC of the body. Its Stripe-Signature header
// is a comma-separated list, for example "t=1700000000,v1=<hex>,v0=<hex>".
// The signed payload is the timestamp, a literal ".", then the raw body; the
// v1 entry is the HMAC-SHA256 of that string. This implements the scheme
// directly so no Stripe SDK dependency is needed.
//   rawBody  the exact request body buffer (req.rawBody)
//   header   the full Stripe-Signature header value
//   secret   the Stripe webhook signing secret, or '' when unset
// Returns one of: 'verified', 'invalid', 'unconfigured'.
function verifyStripeSignature(rawBody, header, secret) {
  if (!secret) return 'unconfigured';
  if (!header) return 'invalid';

  // Parse the comma-separated "key=value" segments.
  const parts = {};
  for (const segment of String(header).split(',')) {
    const eq = segment.indexOf('=');
    if (eq === -1) continue;
    parts[segment.slice(0, eq).trim()] = segment.slice(eq + 1).trim();
  }
  const timestamp = parts.t;
  const provided = parts.v1;
  if (!timestamp || !provided) return 'invalid';

  // Reject a timestamp outside the tolerance window before doing crypto work.
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > STRIPE_TOLERANCE_SECONDS) {
    return 'invalid';
  }

  const body = Buffer.isBuffer(rawBody)
    ? rawBody.toString('utf8')
    : String(rawBody || '');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(timestamp + '.' + body)
    .digest('hex');
  return safeEqual(expected, provided) ? 'verified' : 'invalid';
}

module.exports = {
  computeHmac: computeHmac,
  safeEqual: safeEqual,
  verifySignature: verifySignature,
  verifyStripeSignature: verifyStripeSignature,
};
