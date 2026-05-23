'use strict';

// ============================================================================
// Auth routes: register, login, refresh, logout, and the /me profile read.
// The credential endpoints sit behind the strict credentialLimiter; refresh
// and logout sit behind the separate, more generous refreshLimiter; /me sits
// behind the authenticate middleware.
// ============================================================================

const express = require('express');

const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { credentialLimiter, refreshLimiter } = require('../middleware/rate-limit');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
} = require('../validators/auth.validator');

const router = express.Router();

// Create a patient account and open a session.
router.post('/register', credentialLimiter, validate(registerSchema), authController.register);

// Verify credentials and open a session.
router.post('/login', credentialLimiter, validate(loginSchema), authController.login);

// Rotate the refresh token and issue a fresh access token. The refresh
// limiter is far more generous than the credential limiter, since a normal
// app refreshes routinely; it is a separate bucket so refreshing never eats
// the login budget.
router.post('/refresh', refreshLimiter, validate(refreshSchema), authController.refresh);

// Revoke the current refresh token. Bounded by the refresh limiter so logging
// out cannot consume the credential budget or probe the token table tightly.
router.post('/logout', refreshLimiter, validate(refreshSchema), authController.logout);

// Return the authenticated user's profile.
router.get('/me', authenticate, authController.me);

module.exports = router;
