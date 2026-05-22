'use strict';

// ============================================================================
// Intake request schemas (Zod).
// ----------------------------------------------------------------------------
// Validates the body posted to POST /api/intake. The shape matches the
// detail of the "triage:submit" event emitted by the pnrx-triage-form Web
// Component. A disqualified result is rejected: a disqualified patient must
// not be able to submit an intake for treatment.
// ============================================================================

const { z } = require('zod');

// Mirror of the protocol_category enum in database/schema.sql.
const protocolCategory = z.enum([
  'mens_optimization',
  'womens_wellness',
  'peptide_therapy',
  'trt',
  'longevity',
  'weight_management',
  'sexual_health',
]);

// A submittable risk level. 'disqualified' is intentionally excluded.
const riskLevel = z.enum(['low', 'moderate', 'high']);

const submitIntakeSchema = z.object({
  protocolId: z.string().trim().min(1).max(64).optional(),
  protocolCategory: protocolCategory,
  // The full answer set. Stored encrypted; not inspected field by field here.
  answers: z.record(z.string(), z.any()),
  // Derived non-PHI routing booleans.
  triageFlags: z.record(z.string(), z.any()).optional(),
  riskLevel: riskLevel,
});

module.exports = {
  submitIntakeSchema: submitIntakeSchema,
};
