'use strict';

// ============================================================================
// Admin controller.
// ----------------------------------------------------------------------------
// Backs the staff admin dashboard. Every handler here runs behind the
// authenticate middleware and an authorize('admin', 'support') guard, so the
// route layer - not these handlers - enforces that only staff reach them.
// The dashboard handler assembles a platform overview; the audit-log handler
// returns the recent audit trail for compliance review.
// ============================================================================

const adminModel = require('../models/admin.model');
const audit = require('../services/audit.service');

// Collect the non-PHI request metadata recorded in audit_log.
function requestMeta(req) {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') || null };
}

// GET /api/admin/dashboard - the platform operations overview.
async function dashboard(req, res, next) {
  try {
    const [
      usersByRole,
      subscriptionsByStatus,
      liveMrrCents,
      settled,
      openIntakeCount,
    ] = await Promise.all([
      adminModel.userCountsByRole(),
      adminModel.subscriptionCountsByStatus(),
      adminModel.liveMrrCents(),
      adminModel.settledRevenue(),
      adminModel.openIntakeCount(),
    ]);

    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'admin.dashboard.viewed',
      entityType: 'admin',
      entityId: null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    res.status(200).json({
      summary: {
        liveMrrCents: liveMrrCents,
        settledGrossCents: settled.grossCents,
        settledTransactionCount: settled.count,
        openIntakeCount: openIntakeCount,
      },
      usersByRole: usersByRole,
      subscriptionsByStatus: subscriptionsByStatus,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/audit-log - the recent audit trail. Accepts ?limit=N.
async function auditLog(req, res, next) {
  try {
    const requested = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requested) ? requested : 50;
    const entries = await adminModel.recentAuditLog(limit);

    const meta = requestMeta(req);
    await audit.record({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'admin.audit_log.viewed',
      entityType: 'audit_log',
      entityId: null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    res.status(200).json({ entries: entries });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboard: dashboard,
  auditLog: auditLog,
};
