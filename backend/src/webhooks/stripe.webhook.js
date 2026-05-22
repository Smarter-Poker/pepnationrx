'use strict';

// ============================================================================
// Stripe webhook receiver.
// ----------------------------------------------------------------------------
// Receives payment and subscription events from Stripe. The signature is
// checked against the raw body, the event is recorded for idempotency, and the
// event is classified and audited. Posting the resulting state onto the
// transactions and subscriptions tables is the responsibility of the checkout
// flow built in a later phase; this receiver establishes the verified,
// idempotent, audited intake of those events.
// ============================================================================

const express = require('express');

const config = require('../config/env');
const logger = require('../utils/logger');
const { verifyStripeSignature } = require('./verify-signature');
const webhookEventModel = require('../models/webhook-event.model');
const audit = require('../services/audit.service');
const stripeSubscription = require('../services/stripe/subscription');

const router = express.Router();
const SECRET = config.integrations.stripe.webhookSecret;

// Event types this receiver acts on. Anything else is recorded and ignored.
const HANDLED_TYPES = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

router.post('/', async function (req, res) {
  // 1. Verify the signature over the exact received bytes. Stripe's header is
  // a timestamped, multi-scheme value, so it needs the Stripe-specific check.
  const signature = req.get('stripe-signature');
  const verdict = verifyStripeSignature(req.rawBody, signature, SECRET);
  if (verdict === 'invalid') {
    return res.status(401).json({
      error: { code: 'invalid_signature', message: 'Webhook signature verification failed.' },
    });
  }
  if (verdict === 'unconfigured') {
    logger.warn('Stripe webhook secret not set; signature check skipped');
  }

  const event = req.body || {};
  if (!event.id || !event.type) {
    return res.status(400).json({
      error: { code: 'bad_request', message: 'Webhook event is missing id or type.' },
    });
  }

  // 2. Record for idempotency. Stripe payloads are financial, not clinical, so
  // they are not encrypted at rest here.
  let record;
  try {
    record = await webhookEventModel.recordReceived({
      source: 'stripe',
      eventType: event.type,
      externalEventId: event.id,
      payloadEncrypted: null,
    });
  } catch (err) {
    logger.error('Stripe webhook could not be recorded', { message: err.message });
    return res.status(500).json({
      error: { code: 'webhook_record_failed', message: 'The webhook could not be recorded.' },
    });
  }
  if (!record) {
    return res.status(200).json({ status: 'duplicate_ignored' });
  }

  // 3. Classify and audit.
  try {
    await webhookEventModel.markProcessing(record.id);

    if (HANDLED_TYPES.indexOf(event.type) === -1) {
      await webhookEventModel.markIgnored(record.id);
      return res.status(200).json({ status: 'ignored' });
    }

    const object = (event.data && event.data.object) || {};
    const metadata = {};
    if (event.type.indexOf('subscription') !== -1) {
      metadata.subscriptionStatus =
        stripeSubscription.mapStripeStatusToSubscriptionStatus(object.status);
    }

    await audit.record({
      action: 'stripe.event.' + event.type,
      entityType: 'stripe_event',
      metadata: metadata,
    });

    await webhookEventModel.markProcessed(record.id);
    return res.status(200).json({ status: 'processed' });
  } catch (err) {
    logger.error('Stripe webhook processing failed', { message: err.message });
    await webhookEventModel.markFailed(record.id, err.message);
    return res.status(500).json({
      error: {
        code: 'webhook_processing_failed',
        message: 'The webhook could not be processed.',
      },
    });
  }
});

module.exports = router;
