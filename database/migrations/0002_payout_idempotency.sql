-- ============================================================================
-- Migration 0002: affiliate payout idempotency constraint.
-- ----------------------------------------------------------------------------
-- The payout-run job settles one affiliate_payouts row per affiliate per
-- period. It guards against duplicates with an existsForPeriod check, but that
-- check and the insert are not atomic: two overlapping job runs could both
-- pass the check and both insert, double-paying the affiliate.
--
-- This unique constraint makes the database the final arbiter. With it, the
-- model's INSERT ... ON CONFLICT DO NOTHING turns a duplicate into a no-op
-- instead of a second payout row.
-- ============================================================================

BEGIN;

ALTER TABLE affiliate_payouts
  ADD CONSTRAINT affiliate_payouts_period_unique
  UNIQUE (affiliate_id, period_start, period_end);

COMMIT;
