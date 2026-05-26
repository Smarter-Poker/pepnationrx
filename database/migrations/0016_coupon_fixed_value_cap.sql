-- ============================================================================
-- Migration 0016: Add DB-level cap on fixed coupon values. (F3-02)
-- ----------------------------------------------------------------------------
-- The application-layer validator (coupon.validator.js, B3-08) caps fixed
-- coupon values at 100 000 cents ($1 000.00). Without a matching database
-- CHECK constraint the cap can be bypassed by a direct SQL write, a migration
-- seed, or a future code path that skips the validator. Defense-in-depth
-- requires the database to be the final arbiter.
--
-- 100 000 cents ($1 000.00) is the same cap enforced by the validator. A
-- legitimate single-order coupon should never exceed this amount; if a larger
-- discount is ever needed a staff member can issue a custom subscription price
-- through the admin panel instead.
-- ============================================================================

BEGIN;

ALTER TABLE coupons
  ADD CONSTRAINT coupons_fixed_value_cap
    CHECK (type <> 'fixed' OR value <= 100000);

COMMENT ON CONSTRAINT coupons_fixed_value_cap ON coupons IS
  'A fixed-type coupon may not discount more than $1,000.00 (100,000 cents). '
  'Mirrors the application-layer cap in coupon.validator.js (B3-08).';

COMMIT;
