'use strict';

// ============================================================================
// Application constants: enum mirrors of the database types, role sets, and
// the MSO compliance disclosure text. Centralized so route handlers and
// validators reference a single source of truth.
// ============================================================================

// Mirror of the user_role enum in database/schema.sql.
const USER_ROLES = Object.freeze([
  'patient',
  'provider',
  'pharmacist',
  'affiliate',
  'admin',
  'support',
]);

// Mirror of the account_status enum.
const ACCOUNT_STATUS = Object.freeze({
  PENDING_VERIFICATION: 'pending_verification',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  CLOSED: 'closed',
});

// Account statuses that block authentication even with valid credentials.
const LOGIN_BLOCKED_STATUS = Object.freeze(['suspended', 'closed']);

// Mirror of the consent_type enum.
const CONSENT_TYPES = Object.freeze({
  MSO_BILLING_AGENT: 'mso_billing_agent',
  TELEHEALTH_INFORMED_CONSENT: 'telehealth_informed_consent',
  HIPAA_AUTHORIZATION: 'hipaa_authorization',
  TERMS_OF_SERVICE: 'terms_of_service',
  PRIVACY_POLICY: 'privacy_policy',
});

// Audit action names written to audit_log.action.
const AUDIT_ACTIONS = Object.freeze({
  USER_REGISTERED: 'user.registered',
  USER_LOGIN_SUCCESS: 'user.login.success',
  USER_LOGIN_FAILURE: 'user.login.failure',
  USER_LOGOUT: 'user.logout',
  TOKEN_REFRESHED: 'auth.token.refreshed',
  TOKEN_REUSE_DETECTED: 'auth.token.reuse_detected',
});

// Tri-party fee split applied at checkout. The medical practice is the
// Merchant of Record and keeps the gross amount minus these two fees; the
// provider receives the consult fee; PepNationRX receives the management fee.
//   consultFeeCents      flat per-charge clinical consult fee
//   managementFeePct     platform management fee, as a percent of the gross
const FEE_SPLIT = Object.freeze({
  consultFeeCents: 3900,
  managementFeePct: 20,
});

// The mandatory MSO billing-agent disclosure. Kept identical to the text
// in ARCHITECTURE.md Section V, the frontend shell footer, and the checkout
// consent.
const MSO_DISCLOSURE =
  'PepNationRX is a technology platform and management services organization. ' +
  'We do not provide medical advice or care. All clinical services are ' +
  'provided by independent, licensed medical practitioners. All compounded ' +
  'medications are fulfilled by licensed, independent 503A compounding ' +
  'pharmacies. By proceeding, you acknowledge that PepNationRX acts solely ' +
  'as the designated billing agent.';

module.exports = Object.freeze({
  USER_ROLES: USER_ROLES,
  ACCOUNT_STATUS: ACCOUNT_STATUS,
  LOGIN_BLOCKED_STATUS: LOGIN_BLOCKED_STATUS,
  CONSENT_TYPES: CONSENT_TYPES,
  AUDIT_ACTIONS: AUDIT_ACTIONS,
  FEE_SPLIT: FEE_SPLIT,
  MSO_DISCLOSURE: MSO_DISCLOSURE,
});
