'use strict';

// ============================================================================
// Affiliate routes: the affiliate dashboard, referral link, and payouts.
// Requires a valid access token; the affiliate record is resolved from the user.
// ============================================================================

const express = require('express');

const affiliateController = require('../controllers/affiliate.controller');
const payoutController = require('../controllers/affiliate-payout.controller');
const authenticate = require('../middleware/authenticate');
const { credentialLimiter } = require('../middleware/rate-limit');

const router = express.Router();

// The authenticated affiliate's dashboard: profile, referral funnel,
// attributed revenue, and payout ledger.
router.get('/dashboard', authenticate, affiliateController.dashboard);

// The affiliate's shareable referral link.
router.get('/referral-link', authenticate, affiliateController.referralLink);

// Record a referral landing from a /?ref= link. Public on purpose: a landing
// happens before the visitor has signed in or has an account. Bounded by the
// credentialLimiter (10 req/window per IP) to prevent affiliate code
// enumeration by an attacker probing valid codes. W-07.
router.post('/track-referral', credentialLimiter, affiliateController.trackReferral);

// -- Payout Endpoints (W-04) ------------------------------------------------
// Affiliate self-service payout request. Stripe Transfer execution is STUBBED;
// rows are created 'pending' and will be processed in the payment phase.
router.get('/payouts', authenticate, payoutController.list);
router.post('/payouts/request', authenticate, payoutController.request);

// Admin-only payout management.
router.post('/payouts/:payoutId/schedule', authenticate, payoutController.schedule);
router.post('/payouts/:payoutId/mark-paid', authenticate, payoutController.markPaid);

module.exports = router;
