'use strict';

// ============================================================================
// Provider routes: the clinician-facing surface. Every route requires a valid
// access token and the provider or support role - patients can never reach
// these endpoints.
// ============================================================================

const express = require('express');

const messageController = require('../controllers/message.controller');
const insuranceController = require('../controllers/insurance.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

// Only a clinician (provider) or a support agent may use this surface.
const clinicianOnly = authorize('provider', 'support');

// Secure care-team messaging, clinician side: list open threads, read a
// thread, reply to a thread.
router.get(
  '/messages',
  authenticate,
  clinicianOnly,
  messageController.listProviderThreads
);
router.get(
  '/messages/:threadId',
  authenticate,
  clinicianOnly,
  messageController.getProviderThread
);
router.post(
  '/messages/:threadId',
  authenticate,
  clinicianOnly,
  messageController.postProviderMessage
);

// Insurance concierge work queue: list open assisted reviews and advance one.
router.get(
  '/insurance/concierge',
  authenticate,
  clinicianOnly,
  insuranceController.listConciergeQueue
);
router.post(
  '/insurance/concierge/:checkId',
  authenticate,
  clinicianOnly,
  insuranceController.advanceConcierge
);

module.exports = router;
