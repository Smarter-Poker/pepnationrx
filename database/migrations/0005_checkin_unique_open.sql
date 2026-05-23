-- ============================================================================
-- Migration 0005: one open monthly check-in per subscription.
-- ----------------------------------------------------------------------------
-- The refill-reminders job schedules a check-in for every active subscription
-- that has no open one. Its hasOpenCheckin guard and the insert are two
-- separate statements, so two overlapping job runs could both pass the guard
-- and both insert, producing duplicate open check-ins for one subscription.
--
-- This partial unique index makes the database the final arbiter: a
-- subscription may hold at most one check-in in an open ('due' or 'submitted')
-- state. monthly_checkins.create uses ON CONFLICT against it, so a duplicate
-- insert from a racing job run becomes a no-op instead of a second row.
-- ============================================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS monthly_checkins_one_open_per_subscription
  ON monthly_checkins (subscription_id)
  WHERE status IN ('due', 'submitted');

COMMIT;
