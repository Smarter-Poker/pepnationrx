'use strict';

// ============================================================================
// Audit service.
// Writes append-only entries to the audit_log table. Every authentication
// event and every PHI access must produce a record here. Audit writes never
// throw into the caller: a logging failure must not block the user action it
// describes, so failures are captured to the application logger instead.
// ============================================================================

const { query } = require('../db/query');
const logger = require('../utils/logger');

// Record an audited action. The fields map one-to-one onto audit_log columns.
//   actorUserId  - users.id of the actor, or null for anonymous attempts
//   actorRole    - the actor's user_role, or null
//   action       - a value from constants.AUDIT_ACTIONS
//   entityType   - the table or domain object touched, e.g. 'user'
//   entityId     - the affected row id, when applicable
//   phiAccessed  - true when the action read or wrote PHI
//   ipAddress    - request IP
//   userAgent    - request User-Agent header
//   metadata     - any non-PHI JSON detail
async function record(entry) {
  const params = [
    entry.actorUserId || null,
    entry.actorRole || null,
    entry.action,
    entry.entityType || null,
    entry.entityId || null,
    entry.phiAccessed === true,
    entry.ipAddress || null,
    entry.userAgent || null,
    JSON.stringify(entry.metadata || {}),
  ];
  try {
    await query(
      'INSERT INTO audit_log ' +
        '(actor_user_id, actor_role, action, entity_type, entity_id, ' +
        ' phi_accessed, ip_address, user_agent, metadata) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      params
    );
  } catch (err) {
    logger.error('Audit log write failed', {
      action: entry.action,
      message: err.message,
    });
  }
}

module.exports = {
  record: record,
};
