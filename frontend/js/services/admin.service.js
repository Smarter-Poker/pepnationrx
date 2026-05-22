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
