'use strict';

// ============================================================================
// PHI access audit middleware.
// ----------------------------------------------------------------------------
// Returns a middleware that writes one audit_log entry after a PHI-bearing
// request completes successfully. It is the declarative counterpart to an
// explicit audit.service.record() call: mount it on a route and every
// successful access is recorded with no handler code.
//
// The entry is written on the response 'finish' event, so it reflects the
// actual outcome and only records requests that returned a 2xx or 3xx status.
// Audit writes never throw into the request (audit.service swallows failures),
// so this middleware cannot break a route.
// ============================================================================

const audit = require('../services/audit.service');

// Build a PHI-access audit middleware.
//   action        the audit_log action string, for example 'prescription.viewed'
//   options.entityType    the entity_type to record (optional)
//   options.entityIdParam a req.params key whose value is the entity_id (optional)
//   options.phiAccessed   whether this access touches PHI (defaults to true)
function auditPhiAccess(action, options) {
  const opts = options || {};
  const phiAccessed = opts.phiAccessed !== false;

  return function auditMiddleware(req, res, next) {
    res.on('finish', function () {
      // Only record successful access; failures are not PHI disclosures.
      if (res.statusCode >= 400) return;

      const entityId =
        opts.entityIdParam && req.params
          ? req.params[opts.entityIdParam] || null
          : null;

      audit.record({
        actorUserId: req.user ? req.user.id : null,
        actorRole: req.user ? req.user.role : null,
        action: action,
        entityType: opts.entityType || null,
        entityId: entityId,
        phiAccessed: phiAccessed,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
      });
    });
    next();
  };
}

module.exports = auditPhiAccess;
