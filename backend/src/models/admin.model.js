'use strict';

// ============================================================================
// Admin model - aggregate read queries that back the staff admin dashboard.
// ----------------------------------------------------------------------------
// Every function here is read-only. Staff (admin and support roles) use these
// for an operational overview: who is registered, how many subscriptions are
// live, how much revenue has settled, how many intakes await clinical review,
// and the most recent audit-log activity. Amounts are in cents.
// ============================================================================

const { query, queryOne } = require('../db/query');

// Intake statuses that still need staff or clinician attention.
const OPEN_INTAKE_STATUSES = ['submitted', 'in_review', 'needs_more_info'];

// Subscription statuses that count as live recurring revenue.
const LIVE_SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due'];

// Count of users grouped by role. Returns an array of { role, count }.
async function userCountsByRole() {
  const result = await query(
    'SELECT role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY role'
  );
  return result.rows;
}

// Count of subscriptions grouped by status.
async function subscriptionCountsByStatus() {
  const result = await query(
    'SELECT status, COUNT(*)::int AS count FROM subscriptions ' +
      'GROUP BY status ORDER BY status'
  );
  return result.rows;
}

// Total monthly recurring revenue, in cents, across live subscriptions.
async function liveMrrCents() {
  const row = await queryOne(
    'SELECT COALESCE(SUM(mrr_cents), 0)::bigint AS total FROM subscriptions ' +
      'WHERE status = ANY($1)',
    [LIVE_SUBSCRIPTION_STATUSES]
  );
  return row ? Number(row.total) : 0;
}

// Settled gross revenue, in cents, and the count of succeeded transactions.
async function settledRevenue() {
  const row = await queryOne(
    "SELECT COALESCE(SUM(gross_amount_cents), 0)::bigint AS gross, " +
      "COUNT(*)::int AS count FROM transactions WHERE status = 'succeeded'"
  );
  return {
    grossCents: row ? Number(row.gross) : 0,
    count: row ? row.count : 0,
  };
}

// Count of intake submissions still awaiting clinical review or follow-up.
async function openIntakeCount() {
  const row = await queryOne(
    'SELECT COUNT(*)::int AS count FROM intake_submissions WHERE status = ANY($1)',
    [OPEN_INTAKE_STATUSES]
  );
  return row ? row.count : 0;
}

// The most recent audit-log entries, newest first. The controller caps the
// caller-supplied limit at 500; this model matches that ceiling so the two
// never silently diverge and return fewer rows than requested (S3-07).
async function recentAuditLog(limit) {
  const cap = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 500) : 50;
  const result = await query(
    'SELECT id, actor_user_id, actor_role, action, entity_type, entity_id, ' +
      'phi_accessed, ip_address, occurred_at FROM audit_log ' +
      'ORDER BY occurred_at DESC LIMIT $1',
    [cap]
  );
  return result.rows;
}

module.exports = {
  OPEN_INTAKE_STATUSES: OPEN_INTAKE_STATUSES,
  LIVE_SUBSCRIPTION_STATUSES: LIVE_SUBSCRIPTION_STATUSES,
  userCountsByRole: userCountsByRole,
  subscriptionCountsByStatus: subscriptionCountsByStatus,
  liveMrrCents: liveMrrCents,
  settledRevenue: settledRevenue,
  openIntakeCount: openIntakeCount,
  recentAuditLog: recentAuditLog,
};
