-- ============================================================================
-- Migration 0012: Patient-To-Provider Secure Messaging.
-- ----------------------------------------------------------------------------
-- Adds a secure care-team messaging thread between a patient and the clinical
-- team. Message bodies are application-layer encrypted (the body_encrypted
-- BYTEA column mirrors the _encrypted convention used for PHI elsewhere in the
-- schema). Each patient has at most one open thread; closed threads are
-- retained for history.
-- ============================================================================

BEGIN;

CREATE TYPE message_sender_role AS ENUM ('patient', 'provider', 'support');
CREATE TYPE message_thread_status AS ENUM ('open', 'closed');

CREATE TABLE message_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider_id     UUID REFERENCES providers (id) ON DELETE SET NULL,
  subject         TEXT NOT NULL DEFAULT 'Care Team',
  status          message_thread_status NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one open thread per patient: the care-team thread. A closed thread
-- can coexist with a new open one, so the uniqueness is partial.
CREATE UNIQUE INDEX uq_message_threads_open_per_patient
  ON message_threads (patient_user_id) WHERE status = 'open';

CREATE INDEX idx_message_threads_patient
  ON message_threads (patient_user_id, last_message_at DESC);

CREATE INDEX idx_message_threads_status
  ON message_threads (status, last_message_at DESC);

CREATE TRIGGER trg_message_threads_updated_at BEFORE UPDATE ON message_threads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id      UUID NOT NULL REFERENCES message_threads (id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  sender_role    message_sender_role NOT NULL,
  body_encrypted BYTEA NOT NULL,
  read_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_thread ON messages (thread_id, created_at);

-- Supports the unread-count query: messages not yet read.
CREATE INDEX idx_messages_unread
  ON messages (thread_id, read_at) WHERE read_at IS NULL;

COMMIT;
