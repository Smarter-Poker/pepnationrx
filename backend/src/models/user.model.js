'use strict';

// ============================================================================
// User model - data-access layer for the users table.
// One module per table per the architecture. All SQL lives here; controllers
// and services never write SQL directly. password_hash is selected only by
// the explicit findByEmailWithSecret() path used during login.
// ============================================================================

const { query, queryOne } = require('../db/query');

// Columns safe to return to a caller. password_hash is deliberately excluded.
const PUBLIC_COLUMNS =
  'id, email, phone, role, account_status, first_name, last_name, ' +
  'date_of_birth, sex_at_birth, state, stripe_customer_id, mfa_enabled, ' +
  'email_verified_at, last_login_at, created_at, updated_at';

// Look up a user by id, returning public columns only.
async function findById(id) {
  return queryOne('SELECT ' + PUBLIC_COLUMNS + ' FROM users WHERE id = $1', [id]);
}

// Look up a user by email, returning public columns only.
async function findByEmail(email) {
  return queryOne('SELECT ' + PUBLIC_COLUMNS + ' FROM users WHERE email = $1', [email]);
}

// Look up a user by email including password_hash. Used only by the login
// flow, which needs the hash to verify the supplied password.
async function findByEmailWithSecret(email) {
  return queryOne(
    'SELECT ' + PUBLIC_COLUMNS + ', password_hash FROM users WHERE email = $1',
    [email]
  );
}

// Insert a new user. The caller supplies an already-hashed password. state is
// a two-letter US state code, stored uppercased, or null. An optional `client`
// runs the insert inside an open transaction (registration pairs it with the
// refresh-token insert so the two commit or roll back as one unit).
async function create(data, client) {
  return queryOne(
    'INSERT INTO users ' +
      '(email, phone, password_hash, role, first_name, last_name, ' +
      ' date_of_birth, sex_at_birth, state) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ' +
      'RETURNING ' + PUBLIC_COLUMNS,
    [
      data.email,
      data.phone || null,
      data.passwordHash,
      data.role || 'patient',
      data.firstName || null,
      data.lastName || null,
      data.dateOfBirth || null,
      data.sexAtBirth || null,
      data.state ? String(data.state).toUpperCase() : null,
    ],
    client
  );
}

// Stamp the last successful login time.
async function touchLastLogin(id) {
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
}

// True when an account already exists for the given email.
async function emailExists(email) {
  const row = await queryOne('SELECT 1 AS present FROM users WHERE email = $1', [email]);
  return row !== null;
}

module.exports = {
  PUBLIC_COLUMNS: PUBLIC_COLUMNS,
  findById: findById,
  findByEmail: findByEmail,
  findByEmailWithSecret: findByEmailWithSecret,
  create: create,
  touchLastLogin: touchLastLogin,
  emailExists: emailExists,
};
