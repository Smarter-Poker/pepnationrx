-- ============================================================================
-- Migration 0014: Membership Tier - PepNationRX Plus.
-- ----------------------------------------------------------------------------
-- A recurring paid membership that bundles perks: a discount on every plan,
-- priority clinical review, free cold-chain shipping, and priority concierge
-- support. A patient with no row is implicitly a non-member; only paid
-- members have a memberships row. membership_perks is reference data shown on
-- the membership card and the checkout upsell.
-- ============================================================================

BEGIN;

CREATE TYPE membership_tier AS ENUM ('plus');
CREATE TYPE membership_status AS ENUM ('active', 'canceled', 'expired');

CREATE TABLE memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  tier        membership_tier NOT NULL DEFAULT 'plus',
  status      membership_status NOT NULL DEFAULT 'active',
  price_cents INTEGER NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  renews_at   TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT memberships_price_nonneg CHECK (price_cents >= 0)
);

-- At most one active membership per patient.
CREATE UNIQUE INDEX uq_memberships_active_per_user
  ON memberships (user_id) WHERE status = 'active';

CREATE INDEX idx_memberships_user ON memberships (user_id, created_at DESC);

-- Supports a future renewal sweep: active memberships due to renew.
CREATE INDEX idx_memberships_renewal
  ON memberships (renews_at) WHERE status = 'active';

CREATE TRIGGER trg_memberships_updated_at BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE membership_perks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier        membership_tier NOT NULL,
  perk_key    TEXT NOT NULL,
  label       TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_membership_perks_tier_key
  ON membership_perks (tier, perk_key);

INSERT INTO membership_perks (tier, perk_key, label, description, sort_order)
VALUES
  ('plus', 'plan_discount', 'Fifteen Percent Off Every Plan',
   'Save Fifteen Percent On Every Recurring Protocol Plan, On Every Renewal.', 1),
  ('plus', 'priority_review', 'Priority Clinical Review',
   'Your Intake And Check-Ins Move To The Front Of The Provider Review Queue.', 2),
  ('plus', 'free_shipping', 'Free Cold-Chain Shipping',
   'Temperature-Controlled Shipping Is Included On Every Order At No Extra Cost.', 3),
  ('plus', 'concierge_support', 'Priority Concierge Support',
   'Your Messages And Insurance Concierge Requests Are Handled First.', 4);

COMMIT;
