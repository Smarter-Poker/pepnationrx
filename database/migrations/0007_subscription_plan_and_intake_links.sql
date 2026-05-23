-- ============================================================================
-- Migration 0007: Add treatment_plan_id and intake_submission_id to subscriptions.
-- ----------------------------------------------------------------------------
-- treatment_plan_id links a subscription to the catalog plan that was
-- purchased, enabling catalog-side audits and renewal pricing lookups.
--
-- intake_submission_id links a subscription to the clinical intake that
-- preceded it, completing the audit trail: intake → subscription → prescription
-- → pharmacy order. Required for HIPAA-grade traceability. (W-05)
-- ============================================================================

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS treatment_plan_id   UUID REFERENCES treatment_plans (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS intake_submission_id UUID REFERENCES intake_submissions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subs_treatment_plan
  ON subscriptions (treatment_plan_id);

CREATE INDEX IF NOT EXISTS idx_subs_intake_submission
  ON subscriptions (intake_submission_id);

COMMENT ON COLUMN subscriptions.treatment_plan_id IS
  'The catalog plan purchased at checkout. Used for renewal pricing.';

COMMENT ON COLUMN subscriptions.intake_submission_id IS
  'The clinical intake that preceded this subscription. HIPAA audit trail.';
