'use strict';

// ============================================================================
// Route table aggregator.
// Mounts every feature router under /api. Phase 2 shipped authentication;
// Phase 4 adds the clinical intake endpoint and the three Triad webhook
// receivers. Later phases add subscription, prescription, checkout, patient,
// affiliate, and admin routers here.
// ============================================================================

const express = require('express');
const { query } = require('../db/query');
const authRoutes = require('./auth.routes');
const intakeRoutes = require('./intake.routes');
const checkoutRoutes = require('./checkout.routes');
const patientRoutes = require('./patient.routes');
const affiliateRoutes = require('./affiliate.routes');
const adminRoutes = require('./admin.routes');
const medicalNetworkWebhook = require('../webhooks/medical-network.webhook');
const pharmacyWebhook = require('../webhooks/pharmacy.webhook');
const stripeWebhook = require('../webhooks/stripe.webhook');

const router = express.Router();

// Lightweight liveness probe for the load balancer. No database call so it
// stays green even during a brief database blip.
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'pepnationrx-api' });
});

// Readiness probe: confirms the database is reachable before the instance is
// routed traffic. Returns 503 when the database cannot be queried, so an
// orchestrator holds traffic back until the dependency is healthy.
router.get('/health/ready', async (req, res) => {
  try {
    await query('SELECT 1');
    res.status(200).json({ status: 'ready', service: 'pepnationrx-api' });
  } catch (err) {
    res.status(503).json({ status: 'unavailable', service: 'pepnationrx-api' });
  }
});

// Feature routers.
router.use('/auth', authRoutes);
router.use('/intake', intakeRoutes);
router.use('/checkout', checkoutRoutes);
router.use('/patient', patientRoutes);
router.use('/affiliate', affiliateRoutes);
router.use('/admin', adminRoutes);

// Triad webhook receivers. Each verifies a per-source signature internally.
router.use('/webhooks/medical-network', medicalNetworkWebhook);
router.use('/webhooks/pharmacy', pharmacyWebhook);
router.use('/webhooks/stripe', stripeWebhook);

module.exports = router;
