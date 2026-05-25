-- ============================================================================
-- Migration 0015: Discount And Coupon Mechanism.
-- ----------------------------------------------------------------------------
-- A coupon is a reusable discount code redeemed once at checkout. A code is
-- either a percentage off the order or a flat amount off, in cents. Redemption
-- is one-time per order: the discount applies to that checkout's transaction,
-- not to future renewals.
--
-- coupons holds the catalog of codes and their terms; coupon_redemptions is the
-- ledger - one row per successful redemption, linked to the subscription and
-- transaction the discount was applied to. redemption_count is denormalized
-- onto coupons so the global cap can be enforced with a single guarded UPDATE
-- (no count-then-insert race).
-- ============================================================================

BEGIN;

-- How a coupon's value is interpreted.
--   percent - value is a whole percentage (1..100) off the order
--   fixed   - value is a flat amount, in cents, off the order
CREATE TYPE coupon_type AS ENUM ('percent', 'fixed');

CREATE TABLE coupons (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The redemption code. Stored uppercased; lookups uppercase the input so the
  -- code is effectively case-insensitive.
  code               TEXT NOT NULL,
  type               coupon_type NOT NULL,
  -- A percentage (1..100) when type = 'percent', or a cent amount when
  -- type = 'fixed'. Always a positive whole number.
  value              INTEGER NOT NULL,
  -- The global redemption cap. NULL means unlimited.
  max_redemptions    INTEGER,
  -- How many times the code has been successfully redeemed. Incremented by the
  -- guarded UPDATE in coupon.model.recordRedemption.
  redemption_count   INTEGER NOT NULL DEFAULT 0,
  -- How many times a single patient may redeem this code.
  per_user_limit     INTEGER NOT NULL DEFAULT 1,
  -- The minimum order subtotal, in cents, the code applies to.
  min_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  -- The redemption window. NULL on either side means open-ended.
  starts_at          TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  -- A short staff-facing label shown in the admin coupon panel.
  description        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coupons_value_positive CHECK (value > 0),
  -- A percentage discount may never exceed 100 percent.
  CONSTRAINT coupons_percent_range
    CHECK (type <> 'percent' OR value BETWEEN 1 AND 100),
  CONSTRAINT coupons_max_redemptions_positive
    CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  CONSTRAINT coupons_redemption_count_nonneg CHECK (redemption_count >= 0),
  CONSTRAINT coupons_per_user_limit_positive CHECK (per_user_limit > 0),
  CONSTRAINT coupons_min_subtotal_nonneg CHECK (min_subtotal_cents >= 0)
);

-- A code is unique case-insensitively: codes are stored uppercased, so a plain
-- unique index on the column enforces it.
CREATE UNIQUE INDEX uq_coupons_code ON coupons (code);

CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE coupon_redemptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id       UUID NOT NULL REFERENCES coupons (id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- The subscription and transaction the discount was applied to. SET NULL on
  -- delete so the redemption ledger survives a subscription or transaction
  -- being removed.
  subscription_id UUID REFERENCES subscriptions (id) ON DELETE SET NULL,
  transaction_id  UUID REFERENCES transactions (id) ON DELETE SET NULL,
  -- The actual amount discounted from the order, in cents.
  discount_cents  INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coupon_redemptions_discount_nonneg CHECK (discount_cents >= 0)
);

-- The redemption ledger for a coupon.
CREATE INDEX idx_coupon_redemptions_coupon
  ON coupon_redemptions (coupon_id, created_at DESC);

-- Supports the per-user redemption-limit check.
CREATE INDEX idx_coupon_redemptions_user_coupon
  ON coupon_redemptions (user_id, coupon_id);

COMMIT;
