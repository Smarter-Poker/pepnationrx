-- ============================================================================
-- Migration 0013: Insurance Eligibility And Concierge.
-- ----------------------------------------------------------------------------
-- Lets a patient submit an insurance policy, run a self-service eligibility
-- check, and request a concierge (assisted) review. The member id and group
-- number are insurance identifiers and are stored application-layer encrypted
-- (the _encrypted BYTEA convention used for PHI elsewhere in the schema).
-- Carrier and plan names are not identifiers and are stored in clear text for
-- display and filtering.
-- ============================================================================

BEGIN;

-- The outcome of an automated eligibility check.
CREATE TYPE insurance_eligibility_status AS ENUM (
  'pending', 'eligible', 'not_eligible', 'needs_review', 'error'
);

-- The lifecycle of an assisted concierge review.
CREATE TYPE concierge_state AS ENUM (
  'not_requested', 'requested', 'in_progress', 'resolved', 'closed'
);

CREATE TABLE insurance_policies (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  carrier_name           TEXT NOT NULL,
  plan_name              TEXT,
  member_id_encrypted    BYTEA NOT NULL,
  group_number_encrypted BYTEA,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_insurance_policies_user
  ON insurance_policies (user_id, created_at DESC);

CREATE TRIGGER trg_insurance_policies_updated_at
  BEFORE UPDATE ON insurance_policies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE insurance_eligibility_checks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id         UUID NOT NULL REFERENCES insurance_policies (id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  protocol_category protocol_category,
  status            insurance_eligibility_status NOT NULL DEFAULT 'pending',
  coverage_summary  TEXT,
  copay_cents       INTEGER,
  deductible_cents  INTEGER,
  concierge_state   concierge_state NOT NULL DEFAULT 'not_requested',
  concierge_notes   TEXT,
  checked_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT insurance_checks_copay_nonneg
    CHECK (copay_cents IS NULL OR copay_cents >= 0),
  CONSTRAINT insurance_checks_deductible_nonneg
    CHECK (deductible_cents IS NULL OR deductible_cents >= 0)
);

CREATE INDEX idx_insurance_checks_user
  ON insurance_eligibility_checks (user_id, created_at DESC);

-- Supports the concierge work queue: the open assisted reviews.
CREATE INDEX idx_insurance_checks_concierge
  ON insurance_eligibility_checks (concierge_state, created_at)
  WHERE concierge_state IN ('requested', 'in_progress');

CREATE TRIGGER trg_insurance_checks_updated_at
  BEFORE UPDATE ON insurance_eligibility_checks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
