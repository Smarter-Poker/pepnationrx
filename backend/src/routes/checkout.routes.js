'use strict';

// ============================================================================
// Checkout routes: place a treatment plan order.
// The endpoint requires a valid access token; a patient checks out for
// themselves only, so no role gate beyond authentication is applied.
// ============================================================================

const express = require('express');

const checkoutController = require('../controllers/checkout.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { checkoutSchema } = require('../validators/checkout.validator');

const router = express.Router();

// Place a treatment plan order: pending subscription plus pending transaction.
router.post('/', authenticate, validate(checkoutSchema), checkoutController.place);

module.exports = router;
