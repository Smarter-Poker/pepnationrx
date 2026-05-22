// ============================================================================
// intake.service.js - the PepNationRX intake API client.
// ----------------------------------------------------------------------------
// Persists a completed triage questionnaire to POST /api/intake. The triage
// form screens the patient in the browser, but the answers must reach the
// backend so they are stored (PHI-encrypted) and forwarded to the medical
// network for clinical review. Without this call the triage result would be
// discarded and no provider could ever review it.
// ============================================================================

'use strict';

import { api } from './api.js';

// Submit a completed triage questionnaire. `triage` is the detail object the
// pnrx-triage-form component emits on its "triage:submit" event. Resolves with
// the { submission } envelope the backend returns.
export function submitIntake(triage) {
  return api.post('/api/intake', {
    protocolId: triage.protocolId,
    protocolCategory: triage.protocolCategory,
    answers: triage.answers || {},
    triageFlags: triage.triageFlags || {},
    riskLevel: triage.riskLevel,
  });
}
