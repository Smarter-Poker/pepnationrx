'use strict';

// ============================================================================
// Patient routes: the patient dashboard. Requires a valid access token; the
// dashboard always reflects the authenticated user.
// ============================================================================

const express = require('express');

const patientController = require('../controllers/patient.controller');
const messageController = require('../controllers/message.controller');
const insuranceController = require('../controllers/insurance.controller');
const membershipController = require('../controllers/membership.controller');
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

// Self-service subscription management: pause, resume, or cancel via an
// `action` field in the request body.
router.patch(
  '/subscriptions/:subscriptionId',
  authenticate,
  patientController.patchSubscription
);

// G-02: address management.
router.patch('/addresses/:addressId', authenticate, patientController.updateAddress);
router.post(
  '/addresses/:addressId/set-default',
  authenticate,
  patientController.setDefaultAddress
);
router.delete('/addresses/:addressId', authenticate, patientController.deleteAddress);

// Secure care-team messaging: list threads, read a thread, post a message.
router.get('/messages', authenticate, messageController.listPatientThreads);
router.get(
  '/messages/:threadId',
  authenticate,
  messageController.getPatientThread
);
router.post('/messages', authenticate, messageController.postPatientMessage);

// Insurance eligibility and concierge: submit a policy, run a self-service
// eligibility check, and request an assisted concierge review.
router.post(
  '/insurance/policies',
  authenticate,
  insuranceController.createPolicy
);
router.get('/insurance/policies', authenticate, insuranceController.listPolicies);
router.post('/insurance/checks', authenticate, insuranceController.runCheck);
router.get('/insurance/checks', authenticate, insuranceController.listChecks);
router.post(
  '/insurance/checks/:checkId/concierge',
  authenticate,
  insuranceController.requestConcierge
);

// PepNationRX Plus membership: read the membership and perks, enroll, cancel.
router.get('/membership', authenticate, membershipController.getMembership);
router.post('/membership', authenticate, membershipController.enroll);
router.delete('/membership', authenticate, membershipController.cancel);

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
