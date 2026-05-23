-- ============================================================================
-- Migration 0011: Subscription Events.
-- ----------------------------------------------------------------------------
-- Adds an append-only audit log of patient-driven subscription state changes
-- (pause, resume, cancel, plan change). Each row records the transition so the
-- patient dashboard and support tooling can show an accurate plan history.
-- ============================================================================

BEGIN;

CREATE TYPE subscription_event_type AS ENUM (
  'paused',
  'resumed',
  'canceled',
  'plan_changed'
);

CREATE TABLE subscription_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions (id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  event_type      subscription_event_type NOT NULL,
  from_status     subscription_status,
  to_status       subscription_status,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_events_sub
  ON subscription_events (subscription_id, created_at DESC);

CREATE INDEX idx_subscription_events_user
  ON subscription_events (user_id, created_at DESC);

COMMIT;
