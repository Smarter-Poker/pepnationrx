'use strict';

// ============================================================================
// Pharmacy webhook receiver.
// ----------------------------------------------------------------------------
// Receives order and cold-chain shipping updates from the 503A pharmacy. The
// signature is checked against the raw body, the event is recorded for
// idempotency, and the update is dispatched to tracking-sync.
// ============================================================================

const express = require('express');

const config = require('../config/env');
const logger = require('../utils/logger');
const { verifySignature } = require('./verify-signature');
const webhookEventModel = require('../models/webhook-event.model');
const encryptionService = require('../services/encryption.service');
const trackingSync = require('../services/pharmacy/tracking-sync');

const router = express.Router();
const SECRET = config.integrations.pharmacy.webhookSecret;

router.post('/', async function (req, res) {
  // 1. Verify the signature over the exact received bytes.
  const signature = req.get('x-pnrx-signature');
  const verdict = verifySignature(req.rawBody, signature, SECRET);
  if (verdict === 'invalid') {
    return res.status(401).json({
      error: { code: 'invalid_signature', message: 'Webhook signature verification failed.' },
    });
  }
  if (verdict === 'unconfigured') {
    // In production a missing secret means an unverified event; refuse it.
    if (config.isProduction) {
      logger.error(
        'Pharmacy webhook secret not set in production; rejecting unverified event'
      );
      return res.status(503).json({
        error: {
          code: 'webhook_unconfigured',
          message: 'Webhook verification is unavailable.',
        },
      });
    }
    logger.warn('Pharmacy webhook secret not set; signature check skipped');
  }

  const event = req.body || {};
  if (!event.id || !event.type) {
    return res.status(400).json({
      error: { code: 'bad_request', message: 'Webhook event is missing id or type.' },
    });
  }

  // 2. Record for idempotency.
  let record;
  try {
    record = await webhookEventModel.recordReceived({
      source: 'pharmacy',
      eventType: event.type,
      externalEventId: event.id,
      payloadEncrypted: encryptionService.encrypt(req.rawBody.toString('utf8')),
    });
  } catch (err) {
    logger.error('Pharmacy webhook could not be recorded', { message: err.message });
    return res.status(500).json({
      error: { code: 'webhook_record_failed', message: 'The webhook could not be recorded.' },
    });
  }
  if (!record) {
    // Seen before: re-process only a previously failed attempt; a processed,
    // ignored, or in-flight event stays a no-op so a replay is safe.
    const prior = await webhookEventModel.findByExternalId('pharmacy', event.id);
    if (!prior || prior.status !== 'failed') {
      return res.status(200).json({ status: 'duplicate_ignored' });
    }
    record = prior;
  }

  // 3. Dispatch by event type.
  try {
    await webhookEventModel.markProcessing(record.id);
    const data = event.data || {};

    if (event.type === 'order.status_updated' || event.type === 'shipment.updated') {
      await trackingSync.applyTrackingUpdate(data);
    } else {
      await webhookEventModel.markIgnored(record.id);
      return res.status(200).json({ status: 'ignored' });
    }

    await webhookEventModel.markProcessed(record.id);
    return res.status(200).json({ status: 'processed' });
  } catch (err) {
    logger.error('Pharmacy webhook processing failed', { message: err.message });
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
