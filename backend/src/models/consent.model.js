'use strict';

// ============================================================================
// Consent model - data-access layer for the consents table.
// ----------------------------------------------------------------------------
// Every binding acknowledgement a user makes - the MSO billing-agent
// disclosure, the telehealth informed-consent, the HIPAA authorization, the
// terms of service, and the privacy policy - is recorded as one row. The row
// captures the document version accepted and the request metadata so the
// acceptance is auditable. Rows are immutable; a new acceptance is a new row.
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, user_id, consent_type, document_version, accepted, ip_address, ' +
  'user_agent, accepted_at';

// Record one consent acknowledgement. consent_type is a consent_type enum
// value; document_version identifies the exact text the user accepted;
// accepted is the boolean the user submitted. An optional `client` runs the
// insert inside an open transaction (checkout records every consent row, the
// address, the subscription, and the transaction as one unit).
async function record(data, client) {
  return queryOne(
    'INSERT INTO consents ' +
      '(user_id, consent_type, document_version, accepted, ip_address, user_agent) ' +
      'VALUES ($1, $2, $3, $4, $5, $6) ' +
      'RETURNING ' + COLUMNS,
    [
      data.userId,
      data.consentType,
      data.documentVersion,
      data.accepted === true,
      data.ipAddress || null,
      data.userAgent || null,
    ],
    client
  );
}

// Every consent row for a user, newest first.
async function findByUserId(userId) {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM consents WHERE user_id = $1 ' +
      'ORDER BY accepted_at DESC',
    [userId]
  );
  return result.rows;
}

// True when a user has an accepted consent of a given type on file.
async function hasAccepted(userId, consentType) {
  const row = await queryOne(
    'SELECT 1 AS present FROM consents ' +
      'WHERE user_id = $1 AND consent_type = $2 AND accepted = TRUE LIMIT 1',
    [userId, consentType]
  );
  return row !== null;
}

module.exports = {
  record: record,
  findByUserId: findByUserId,
  hasAccepted: hasAccepted,
};
