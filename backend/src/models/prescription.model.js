'use strict';

// ============================================================================
// Prescription model - data-access layer for the prescriptions table.
// ----------------------------------------------------------------------------
// A prescription row is created from a signed prescription delivered by the
// medical network webhook. It is the authoritative record routed to a 503A
// pharmacy for fulfillment.
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, user_id, subscription_id, intake_submission_id, provider_id, ' +
  'pharmacy_id, drug_compound, strength, dosage_protocol, sig_directions, ' +
  'quantity, days_supply, refills_authorized, status, written_date, ' +
  'expiration_date, signed_payload_ref, created_at, updated_at';

// Insert a prescription. written_date and expiration_date are ISO date
// strings (YYYY-MM-DD); status defaults to 'pending_review'.
async function create(data) {
  return queryOne(
    'INSERT INTO prescriptions ' +
      '(user_id, subscription_id, intake_submission_id, provider_id, ' +
      ' pharmacy_id, drug_compound, strength, dosage_protocol, sig_directions, ' +
      ' quantity, days_supply, refills_authorized, status, written_date, ' +
      ' expiration_date, signed_payload_ref) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, ' +
      ' $14, $15, $16) ' +
      'RETURNING ' + COLUMNS,
    [
      data.userId,
      data.subscriptionId || null,
      data.intakeSubmissionId || null,
      data.providerId,
      data.pharmacyId || null,
      data.drugCompound,
      data.strength || null,
      data.dosageProtocol || null,
      data.sigDirections || null,
      data.quantity || null,
      data.daysSupply || null,
      data.refillsAuthorized || 0,
      data.status || 'pending_review',
      data.writtenDate || null,
      data.expirationDate || null,
      data.signedPayloadRef || null,
    ]
  );
}

// Find a prescription by primary key.
async function findById(id) {
  return queryOne('SELECT ' + COLUMNS + ' FROM prescriptions WHERE id = $1', [id]);
}

// All prescriptions for a patient, newest first.
async function findByUserId(userId) {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM prescriptions WHERE user_id = $1 ' +
      'ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

// Update the prescription status (for example to 'active' once fulfilled).
async function updateStatus(id, status) {
  await query('UPDATE prescriptions SET status = $2 WHERE id = $1', [id, status]);
}

module.exports = {
  create: create,
  findById: findById,
  findByUserId: findByUserId,
  updateStatus: updateStatus,
};
