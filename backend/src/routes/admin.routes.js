'use strict';

// ============================================================================
// Admin routes: the staff operations dashboard and audit-log review.
// Every endpoint requires a valid access token and the admin or support role;
// authorize() runs after authenticate so it can read req.user.role.
// ============================================================================

const express = require('express');

const adminController = require('../controllers/admin.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

// Staff-only: every admin route is gated to the admin and support roles.
const staffOnly = [authenticate, authorize('admin', 'support')];

// Platform operations overview.
router.get('/dashboard', staffOnly, adminController.dashboard);

// Recent audit-log entries for compliance review.
router.get('/audit-log', staffOnly, adminController.auditLog);

module.exports = router;
