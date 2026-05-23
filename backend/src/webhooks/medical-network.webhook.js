'use strict';

// ============================================================================
// Medical network webhook receiver.
// ----------------------------------------------------------------------------
// Receives signed prescriptions and clinical review decisions from the medical
// network. The signature is checked against the raw body, the event is
// recorded for idempotency (a replay is a no-op), the PHI payload is stored
// encrypted, and the event is dispatched to prescription-sync.
// ============================================================================

const express = require('express');

const config = require('../config/env');
const logger = require('../utils/logger');
const { verifySignature } = require('./verify-signature');
const webhookEventModel = require('../models/webhook-event.model');
const encryptionService = require('../services/encryption.service');
const prescriptionSync = require('../services/medical-network/prescription-sync');

const router = express.Router();
const SECRET = config.integrations.medicalNetwork.webhookSecret;

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
    // A forged signed-prescription webhook must never be processed.
    if (config.isProduction) {
      logger.error(
        'Medical network webhook secret not set in production; rejecting unverified event'
      );
      return res.status(503).json({
        error: {
          code: 'webhook_unconfigured',
          message: 'Webhook verification is unavailable.',
        },
      });
    }
    logger.warn('Medical network webhook secret not set; signature check skipped');
  }

  const event = req.body || {};
  if (!event.id || !event.type) {
    return res.status(400).json({
      error: { code: 'bad_request', message: 'Webhook event is missing id or type.' },
    });
  }

  // 2. Record for idempotency. A null result means this event id was already
  // seen; the block below decides whether it is a true replay or a retry.
  let record;
  try {
    record = await webhookEventModel.recordReceived({
      source: 'medical_network',
      eventType: event.type,
      externalEventId: event.id,
      payloadEncrypted: encryptionService.encrypt(req.rawBody.toString('utf8')),
    });
  } catch (err) {
    logger.error('Medical network webhook could not be recorded', { message: err.message });
    return res.status(500).json({
      error: { code: 'webhook_record_failed', message: 'The webhook could not be recorded.' },
    });
  }
  if (!record) {
    // recordReceived hit the (source, external_event_id) unique constraint:
    // this event id was seen before. Re-process it only when the prior
    // attempt failed; a processed, ignored, or in-flight event stays a no-op
    // so an ordinary replay is safe, while a transient failure is retried
    // instead of being silently dropped.
    const prior = await webhookEventModel.findByExternalId('medical_network', event.id);
    if (!prior || prior.status !== 'failed') {
      return res.status(200).json({ status: 'duplicate_ignored' });
    }
    record = prior;
  }

  // 3. Dispatch by event type.
  try {
    await webhookEventModel.markProcessing(record.id);
    const data = event.data || {};

    if (event.type === 'prescription.signed') {
      await prescriptionSync.applySignedPrescription(data);
    } else if (event.type === 'submission.denied') {
      await prescriptionSync.applyReviewDecision(
        Object.assign({}, data, { decision: data.decision || 'denied' })
      );
    } else if (event.type === 'submission.needs_info') {
      await prescriptionSync.applyReviewDecision(
        Object.assign({}, data, { decision: 'needs_more_info' })
      );
    } else {
      await webhookEventModel.markIgnored(record.id);
      return res.status(200).json({ status: 'ignored' });
    }

    await webhookEventModel.markProcessed(record.id);
    return res.status(200).json({ status: 'processed' });
  } catch (err) {
    logger.error('Medical network webhook processing failed', { message: err.message });
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
