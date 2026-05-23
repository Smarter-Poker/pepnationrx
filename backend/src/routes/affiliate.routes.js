'use strict';

// ============================================================================
// Affiliate routes: the affiliate dashboard and referral link. Requires a
// valid access token; the affiliate record is resolved from the user.
// ============================================================================

const express = require('express');

const affiliateController = require('../controllers/affiliate.controller');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// The authenticated affiliate's dashboard: profile, referral funnel,
// attributed revenue, and payout ledger.
router.get('/dashboard', authenticate, affiliateController.dashboard);

// The affiliate's shareable referral link.
router.get('/referral-link', authenticate, affiliateController.referralLink);

// Record a referral landing from a /?ref= link. Public on purpose: a landing
// happens before the visitor has signed in or has an account. Bounded by the
// general per-IP rate limiter mounted on the whole API.
router.post('/track-referral', affiliateController.trackReferral);

module.exports = router;
