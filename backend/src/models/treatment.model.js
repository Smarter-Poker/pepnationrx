'use strict';

// ============================================================================
// Treatment model - data-access layer for the treatment catalog tables.
// ----------------------------------------------------------------------------
// The catalog (treatment_categories, treatments, treatment_plans) is reference
// data seeded by migration 0003. This model is the backend's price authority:
// checkout resolves the per-month price from treatment_plans here rather than
// trusting a price supplied by the client.
// ============================================================================

const { queryOne } = require('../db/query');

// Resolve an active, purchasable plan by treatment slug and cadence. Returns a
// flat row with the treatment context and the authoritative price, or null
// when no active plan exists for that slug and cadence.
//   treatmentSlug   the catalog slug, for example 'semaglutide'
//   cadenceMonths   the plan cadence in months (1, 3, 6, or 12)
async function findActivePlan(treatmentSlug, cadenceMonths) {
  return queryOne(
    'SELECT ' +
      'tp.id AS plan_id, tp.name AS plan_name, tp.cadence_months, ' +
      'tp.price_cents, tp.currency, ' +
      't.id AS treatment_id, t.slug AS treatment_slug, ' +
      't.name AS treatment_name, t.protocol_category, t.availability ' +
      'FROM treatment_plans tp ' +
      'JOIN treatments t ON t.id = tp.treatment_id ' +
      'WHERE t.slug = $1 AND tp.cadence_months = $2 ' +
      'AND tp.is_active = TRUE AND t.is_active = TRUE',
    [treatmentSlug, cadenceMonths]
  );
}

module.exports = {
  findActivePlan: findActivePlan,
};
