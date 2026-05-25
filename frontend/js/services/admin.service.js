// ============================================================================
// admin.service.js - the PepNationRX admin API client.
// ----------------------------------------------------------------------------
// Wraps the staff-only /api/admin endpoints. The endpoints themselves are
// gated server-side to the admin and support roles; this client only shapes
// the requests and returns the parsed responses.
// ============================================================================

'use strict';

import { api } from './api.js';

// Fetch the platform operations overview: revenue, subscription and user
// counts, and the open intake count.
export function fetchAdminDashboard() {
  return api.get('/api/admin/dashboard');
}

// Fetch the recent audit-log entries. `limit` is optional and capped at 200
// server-side.
export function fetchAuditLog(limit) {
  const suffix =
    Number.isInteger(limit) && limit > 0 ? '?limit=' + limit : '';
  return api.get('/api/admin/audit-log' + suffix);
}

// Fetch every coupon for the staff coupon panel.
export function fetchCoupons() {
  return api.get('/api/admin/coupons');
}

// Create a coupon. `payload` carries code, type, value, and the optional
// limits and window fields.
export function createCoupon(payload) {
  return api.post('/api/admin/coupons', payload);
}

// Update a coupon's mutable terms. `fields` carries any of isActive,
// maxRedemptions, perUserLimit, minSubtotalCents, expiresAt, description.
export function updateCoupon(couponId, fields) {
  return api.patch('/api/admin/coupons/' + couponId, fields);
}
