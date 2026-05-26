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

// Find an address by primary key. An optional `client` runs the query inside
// an open transaction (checkout passes its client so the ownership check and
// the subscription insert commit as one unit, closing the TOCTOU window).
async function findById(id, client) {
  return queryOne('SELECT ' + COLUMNS + ' FROM addresses WHERE id = $1', [id], client);
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

// Update mutable fields on an address row. The userId parameter is required:
// ownership is enforced in SQL (WHERE id = $7 AND user_id = $8) so this
// function is safe to call without a separate ownership pre-check — it returns
// null when the address does not belong to the caller. (S3-04)
async function update(id, data, client) {
  return queryOne(
    'UPDATE addresses ' +
      'SET line1 = $1, line2 = $2, city = $3, state = $4, postal_code = $5, ' +
      '    country = $6, updated_at = now() ' +
      'WHERE id = $7 AND user_id = $8 ' +
      'RETURNING ' + COLUMNS,
    [
      data.line1,
      data.line2 || null,
      data.city,
      data.state,
      data.postalCode,
      data.country || 'US',
      id,
      data.userId,
    ],
    client
  );
}

// Make one address the default for a user. Clears is_default on all other
// addresses first, then sets it on the target row inside one client session
// so callers inside a transaction can pass their client.
async function setDefault(id, userId, client) {
  const db = client || require('../db/query');
  // Step 1: strip the default flag from every address this user owns.
  await (client
    ? client.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId])
    : db.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]));
  // Step 2: set the flag on the target address (must belong to the user).
  return queryOne(
    'UPDATE addresses SET is_default = true, updated_at = now() ' +
      'WHERE id = $1 AND user_id = $2 ' +
      'RETURNING ' + COLUMNS,
    [id, userId],
    client
  );
}

// Hard-delete an address row the named user owns. Passing userId enforces
// ownership at the SQL layer (S3-08). Returns the deleted id, or null when
// the row did not exist or did not belong to userId.
async function remove(id, userId, client) {
  return queryOne(
    'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId],
    client
  );
}

module.exports = {
  create: create,
  findById: findById,
  findByUserId: findByUserId,
  update: update,
  setDefault: setDefault,
  remove: remove,
};
