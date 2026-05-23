'use strict';

// ============================================================================
// Check-in request schemas (Zod).
// ============================================================================

const { z } = require('zod');

// The patient's check-in answers are a free-form object or array whose exact
// shape is determined by the protocol's questionnaire template. We accept any
// record or array of unknowns and encrypt the whole payload before storage.
const submitCheckinSchema = z.object({
  answers: z.union([z.record(z.unknown()), z.array(z.unknown())]).optional(),
});

module.exports = {
  submitCheckinSchema: submitCheckinSchema,
};
