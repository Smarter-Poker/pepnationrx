-- ============================================================================
-- Migration 0010: patient notifications.
-- ----------------------------------------------------------------------------
-- Adds the notification log and per-user channel preferences that back the
-- notification service. A notification row is the durable record of a message
-- the platform sent (or tried to send) to a patient: a prescription decision,
-- a shipment update, a billing renewal, a due check-in, or a subscription
-- change.
--
-- dedupe_key makes sends idempotent: a unique partial index rejects a second
-- notification for the same event, so a job that runs twice does not email a
-- patient twice. payload holds only non-PHI template variables (names, dates,
-- amounts, treatment names) - never clinical detail.
-- ============================================================================

BEGIN;

-- The delivery channel for a notification.
CREATE TYPE notification_channel AS ENUM ('email', 'sms');

-- The lifecycle state of a notification.
CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'failed', 'skipped');

-- ----------------------------------------------------------------------------
-- TABLE: notifications
-- One row per message the platform sent or attempted. Append-only in practice;
-- status moves queued -> sent | failed | skipped.
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  channel     notification_channel NOT NULL DEFAULT 'email',
  template    TEXT NOT NULL,
  subject     TEXT,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  status      notification_status NOT NULL DEFAULT 'queued',
  dedupe_key  TEXT,
  sent_at     TIMESTAMPTZ,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_status ON notifications (status);
-- Idempotency: at most one notification per event. A NULL dedupe_key is always
-- allowed (transient or non-deduplicated sends).
CREATE UNIQUE INDEX idx_notifications_dedupe ON notifications (dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- TABLE: notification_preferences
-- One row per user. Absence of a row means the defaults apply (email on, SMS
-- off). The notification service treats a missing row as the default.
-- ----------------------------------------------------------------------------
CREATE TABLE notification_preferences (
  user_id        UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  email_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

-- ============================================================================
-- END OF MIGRATION 0010
-- ============================================================================
