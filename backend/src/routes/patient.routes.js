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

// G-01: cancel a subscription the patient owns.
router.delete(
  '/subscriptions/:subscriptionId',
  authenticate,
  patientController.cancelSubscription
);

// G-02: address management.
router.patch('/addresses/:addressId', authenticate, patientController.updateAddress);
router.post(
  '/addresses/:addressId/set-default',
  authenticate,
  patientController.setDefaultAddress
);
router.delete('/addresses/:addressId', authenticate, patientController.deleteAddress);

// Notification preferences: the patient's per-channel opt-in.
router.get(
  '/notification-preferences',
  authenticate,
  patientController.getNotificationPreferences
);
router.put(
  '/notification-preferences',
  authenticate,
  patientController.updateNotificationPreferences
);

module.exports = router;
