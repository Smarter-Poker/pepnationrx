-- ============================================================================
-- Migration 0006: one prescription per intake submission.
-- ----------------------------------------------------------------------------
-- applySignedPrescription creates exactly one prescription per intake
-- submission. Its findByIntakeSubmissionId guard and the insert are two
-- separate statements, so two signed-prescription webhook events for the same
-- submission, processed concurrently, could both pass the guard and both
-- insert - producing duplicate prescriptions, and therefore duplicate
-- fulfillment and billing, for one approved intake.
--
-- This partial unique index makes the database the final arbiter: at most one
-- prescription may exist per non-null intake_submission_id. The column is
-- nullable (refill and subscription-origin prescriptions carry no intake), and
-- a partial index leaves those rows unconstrained. prescription-sync catches
-- the resulting SQLSTATE 23505 and resolves to the winning prescription.
-- ============================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_one_per_intake
  ON prescriptions (intake_submission_id)
  WHERE intake_submission_id IS NOT NULL;

COMMIT;
