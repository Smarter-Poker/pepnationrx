'use strict';

// ============================================================================
// Pharmacy model - data-access layer for the pharmacies table.
// ----------------------------------------------------------------------------
// The pharmacies table holds the 503A / 503B compounding pharmacies the
// platform routes fulfillment through. PepNationRX contracts a single default
// 503A pharmacy; findDefaultActive resolves it for the order router so a
// signed prescription can be routed without the caller naming a pharmacy.
// ============================================================================

const { queryOne } = require('../db/query');

const COLUMNS =
  'id, name, pharmacy_class, license_number, states_served, ' +
  'api_endpoint_ref, cold_chain_capable, is_active, created_at, updated_at';

// The default fulfillment pharmacy: the earliest-created active pharmacy.
// Returns null when no pharmacy has been contracted yet, so a caller can
// degrade gracefully rather than failing.
async function findDefaultActive() {
  return queryOne(
    'SELECT ' + COLUMNS + ' FROM pharmacies WHERE is_active = TRUE ' +
      'ORDER BY created_at ASC LIMIT 1',
    []
  );
}

// Find a pharmacy by primary key.
async function findById(id) {
  return queryOne('SELECT ' + COLUMNS + ' FROM pharmacies WHERE id = $1', [id]);
}

module.exports = {
  findDefaultActive: findDefaultActive,
  findById: findById,
};
