'use strict';

// ============================================================================
// Provider model - data-access layer for the providers table.
// ----------------------------------------------------------------------------
// Providers are independent, licensed practitioners surfaced through the
// medical network. PepNationRX does not employ them. When a signed
// prescription arrives, the named provider is resolved here by the external
// id the medical network assigns, creating a thin local record on first sight.
// ============================================================================

const { queryOne } = require('../db/query');

const COLUMNS =
  'id, user_id, external_provider_id, full_name, npi_number, ' +
  'credentials, licensed_states, is_active, created_at, updated_at';

// Find a provider by the id the medical network uses for them.
async function findByExternalId(externalProviderId) {
  return queryOne(
    'SELECT ' + COLUMNS + ' FROM providers WHERE external_provider_id = $1',
    [externalProviderId]
  );
}

// Find a provider by primary key.
async function findById(id) {
  return queryOne('SELECT ' + COLUMNS + ' FROM providers WHERE id = $1', [id]);
}

// Resolve a provider by external id, inserting a local record if none exists.
// The unique constraint on external_provider_id makes the upsert race-safe.
async function findOrCreateByExternalId(data) {
  const existing = await findByExternalId(data.externalProviderId);
  if (existing) return existing;
  return queryOne(
    'INSERT INTO providers ' +
      '(external_provider_id, full_name, npi_number, credentials, licensed_states) ' +
      'VALUES ($1, $2, $3, $4, $5) ' +
      'ON CONFLICT (external_provider_id) DO UPDATE SET full_name = EXCLUDED.full_name ' +
      'RETURNING ' + COLUMNS,
    [
      data.externalProviderId,
      data.fullName || 'Independent Licensed Provider',
      data.npiNumber || null,
      data.credentials || null,
      data.licensedStates || [],
    ]
  );
}

module.exports = {
  findByExternalId: findByExternalId,
  findById: findById,
  findOrCreateByExternalId: findOrCreateByExternalId,
};
