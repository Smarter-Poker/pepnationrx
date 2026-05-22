'use strict';

// ============================================================================
// Auth routes: register, login, refresh, logout, and the /me profile read.
// The mutating credential endpoints sit behind the stricter authLimiter;
// /me sits behind the authenticate middleware.
// ============================================================================

const express = require('express');

const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rate-limit');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
} = require('../validators/auth.validator');

const router = express.Router();

// Create a patient account and open a session.
router.post('/register', authLimiter, validate(registerSchema), authController.register);

// Verify credentials and open a session.
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// Rotate the refresh token and issue a fresh access token.
router.post('/refresh', authLimiter, validate(refreshSchema), authController.refresh);

// Revoke the current refresh token. Rate-limited like the other credential
// endpoints so the token table cannot be probed in a tight loop.
router.post('/logout', authLimiter, validate(refreshSchema), authController.logout);

// Return the authenticated user's profile.
router.get('/me', authenticate, authController.me);

module.exports = router;
