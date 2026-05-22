'use strict';

// ============================================================================
// Patient routes: the patient dashboard. Requires a valid access token; the
// dashboard always reflects the authenticated user.
// ============================================================================

const express = require('express');

const patientController = require('../controllers/patient.controller');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// The authenticated patient's dashboard: profile, subscriptions,
// prescriptions, orders, and billing.
router.get('/dashboard', authenticate, patientController.dashboard);

module.exports = router;
