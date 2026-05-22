'use strict';

// ============================================================================
// Intake routes: submit a triage questionnaire and read a submission status.
// Both endpoints require a valid access token.
// ============================================================================

const express = require('express');

const intakeController = require('../controllers/intake.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { submitIntakeSchema } = require('../validators/intake.validator');

const router = express.Router();

// Submit a completed triage questionnaire for clinical review.
router.post('/', authenticate, validate(submitIntakeSchema), intakeController.submit);

// Read the status of one intake submission.
router.get('/:id', authenticate, intakeController.getOne);

module.exports = router;
