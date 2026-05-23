'use strict';

// ============================================================================
// Address model - data-access layer for the addresses table.
// ----------------------------------------------------------------------------
// A patient supplies a shipping address at checkout. Cold-chain pharmacy
// shipments resolve to one of these rows. Billing addresses share the table,
// distinguished by address_type.
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, user_id, address_type, line1, line2, city, state, postal_code, ' +
  'country, is_default, created_at, updated_at';

// Insert an address. address_type defaults to 'shipping'; state is a two-letter
// code and country defaults to 'US'. An optional `client` runs the insert
// inside an open transaction (checkout pairs it with the subscription and
// transaction inserts so the order is recorded as one unit).
async function create(data, client) {
  return queryOne(
    'INSERT INTO addresses ' +
      '(user_id, address_type, line1, line2, city, state, postal_code, ' +
      ' country, is_default) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ' +
      'RETURNING ' + COLUMNS,
    [
      data.userId,
      data.addressType || 'shipping',
      data.line1,
      data.line2 || null,
      data.city,
      data.state,
      data.postalCode,
      data.country || 'US',
      data.isDefault === true,
    ],
    client
  );
}

// Find an address by primary key.
async function findById(id) {
  return queryOne('SELECT ' + COLUMNS + ' FROM addresses WHERE id = $1', [id]);
}

// All addresses for a patient, default first then newest.
async function findByUserId(userId) {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM addresses WHERE user_id = $1 ' +
      'ORDER BY is_default DESC, created_at DESC',
    [userId]
  );
  return result.rows;
}

module.exports = {
  create: create,
  findById: findById,
  findByUserId: findByUserId,
};
