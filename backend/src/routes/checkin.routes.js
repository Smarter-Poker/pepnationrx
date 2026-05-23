'use strict';

// ============================================================================
// Check-in routes.
// ----------------------------------------------------------------------------
// GET  /api/subscriptions/:subscriptionId/checkins — list a subscription's
//       check-ins (patient or staff).
// POST /api/checkins/:checkinId/submit — patient submits monthly check-in
//       answers. The body is validated by submitCheckinSchema before reaching
//       the controller.
// Both routes require a valid access token.
// ============================================================================

const express = require('express');

const checkinController = require('../controllers/checkin.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { submitCheckinSchema } = require('../validators/checkin.validator');

const router = express.Router();

// List all check-ins for a subscription. The controller enforces that the
// caller is the subscription owner or an admin/support agent.
router.get(
  '/subscriptions/:subscriptionId/checkins',
  authenticate,
  checkinController.listBySubscription
);

// Patient submits answers for an open check-in. Answers are validated then
// encrypted in the controller before reaching the database.
router.post(
  '/checkins/:checkinId/submit',
  authenticate,
  validate(submitCheckinSchema),
  checkinController.submit
);

module.exports = router;
