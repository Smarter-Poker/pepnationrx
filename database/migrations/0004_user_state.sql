-- ============================================================================
-- Migration 0004: patient state of residence.
-- ----------------------------------------------------------------------------
-- A telehealth encounter must be routed by the patient's state: several states
-- require a synchronous (phone or video) visit rather than an asynchronous
-- review. The intake controller forwards that state to the medical network so
-- the correct visit modality is chosen.
--
-- State belongs on the user record because it is established once at
-- registration and is identity-level eligibility data, not per-submission PHI.
-- The column is a two-letter US state code and is nullable so accounts created
-- before this migration remain valid.
-- ============================================================================

BEGIN;

ALTER TABLE users
  ADD COLUMN state CHAR(2);

COMMIT;
