-- ============================================================================
-- PEPNATIONRX.COM - CORE DATABASE SCHEMA
-- Engine: PostgreSQL 15+
-- Format: SQL dump (DDL)
-- ============================================================================
-- This schema backs a HIPAA-aware telemedicine Management Services
-- Organization (MSO) platform. Relational integrity is enforced for all
-- medical and financial records.
--
-- PHI HANDLING POLICY
-- Columns suffixed with "_encrypted" hold application-layer encrypted
-- payloads (envelope encryption via a KMS-managed data key). They are typed
-- BYTEA and are never written or read in plaintext at the database layer.
-- Non-identifying clinical metadata is stored in typed columns to allow
-- indexing and triage logic without exposing PHI.
--
-- All access to PHI-bearing tables must be recorded in audit_log.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email storage

-- ----------------------------------------------------------------------------
-- ENUMERATED TYPES
-- ----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM (
  'patient', 'provider', 'pharmacist', 'affiliate', 'admin', 'support'
);

CREATE TYPE account_status AS ENUM (
  'pending_verification', 'active', 'suspended', 'closed'
);

CREATE TYPE biological_sex AS ENUM ('male', 'female', 'intersex');

CREATE TYPE address_type AS ENUM ('shipping', 'billing');

CREATE TYPE protocol_category AS ENUM (
  'mens_optimization', 'womens_wellness', 'peptide_therapy',
  'trt', 'longevity', 'weight_management', 'sexual_health'
);

CREATE TYPE pharmacy_class AS ENUM ('503a', '503b');

CREATE TYPE intake_status AS ENUM (
  'started', 'submitted', 'in_review', 'needs_more_info', 'approved', 'denied'
);

CREATE TYPE clinical_risk_level AS ENUM ('low', 'moderate', 'high', 'disqualified');

CREATE TYPE subscription_status AS ENUM (
  'trialing', 'pending_clinical_review', 'active', 'past_due',
  'paused', 'canceled', 'expired'
);

CREATE TYPE prescription_status AS ENUM (
  'pending_review', 'approved', 'denied', 'active', 'expired', 'discontinued'
);

CREATE TYPE pharmacy_order_status AS ENUM (
  'queued', 'submitted', 'accepted', 'compounding',
  'shipped', 'delivered', 'exception', 'canceled'
);

CREATE TYPE transaction_status AS ENUM (
  'requires_payment', 'processing', 'succeeded', 'failed', 'refunded', 'disputed'
);

CREATE TYPE payout_status AS ENUM ('pending', 'scheduled', 'paid', 'failed');

CREATE TYPE webhook_source AS ENUM ('medical_network', 'pharmacy', 'stripe');

CREATE TYPE webhook_status AS ENUM (
  'received', 'processing', 'processed', 'failed', 'ignored'
);

CREATE TYPE consent_type AS ENUM (
  'mso_billing_agent', 'telehealth_informed_consent',
  'hipaa_authorization', 'terms_of_service', 'privacy_policy'
);

CREATE TYPE checkin_status AS ENUM ('due', 'submitted', 'reviewed', 'missed');

-- ----------------------------------------------------------------------------
-- SHARED TRIGGER: maintain updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLE: users
-- Identity, authentication, and Stripe customer linkage for every actor.
-- ============================================================================
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               CITEXT NOT NULL UNIQUE,
  phone               TEXT,
  password_hash       TEXT NOT NULL,                 -- bcrypt
  role                user_role NOT NULL DEFAULT 'patient',
  account_status      account_status NOT NULL DEFAULT 'pending_verification',
  first_name          TEXT,
  last_name           TEXT,
  date_of_birth       DATE,
  sex_at_birth        biological_sex,
  stripe_customer_id  TEXT UNIQUE,
  mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at   TIMESTAMPTZ,
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_dob_past CHECK (date_of_birth IS NULL OR date_of_birth < CURRENT_DATE)
);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_account_status ON users (account_status);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TABLE: addresses
-- Shipping and billing addresses. Cold-chain shipments resolve to a shipping row.
-- ============================================================================
CREATE TABLE addresses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  address_type  address_type NOT NULL DEFAULT 'shipping',
  line1         TEXT NOT NULL,
  line2         TEXT,
  city          TEXT NOT NULL,
  state         CHAR(2) NOT NULL,
  postal_code   TEXT NOT NULL,
  country       CHAR(2) NOT NULL DEFAULT 'US',
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_addresses_user ON addresses (user_id);
CREATE TRIGGER trg_addresses_updated_at BEFORE UPDATE ON addresses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TABLE: providers
-- Independent, licensed medical practitioners surfaced through the medical
-- network API (Wheel / SteadyMD). PepNationRX does not employ providers.
-- ============================================================================
CREATE TABLE providers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID UNIQUE REFERENCES users (id) ON DELETE SET NULL,
  external_provider_id  TEXT UNIQUE,                  -- id from medical network
  full_name             TEXT NOT NULL,
  npi_number            TEXT UNIQUE,
  credentials           TEXT,                         -- e.g. MD, DO, NP
  licensed_states       CHAR(2)[] NOT NULL DEFAULT '{}',
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_providers_updated_at BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TABLE: pharmacies
-- Licensed, independent 503A compounding pharmacies (Hallandale / Empower).
-- ============================================================================
CREATE TABLE pharmacies (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  pharmacy_class     pharmacy_class NOT NULL DEFAULT '503a',
  license_number     TEXT,
  states_served      CHAR(2)[] NOT NULL DEFAULT '{}',
  api_endpoint_ref   TEXT,                            -- config key, not a secret
  cold_chain_capable BOOLEAN NOT NULL DEFAULT TRUE,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_pharmacies_updated_at BEFORE UPDATE ON pharmacies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TABLE: affiliates
-- Partner organizations (BJJ / CrossFit gyms) earning tracked revenue share.
-- Declared before subscriptions so attribution FKs resolve cleanly.
-- ============================================================================
CREATE TABLE affiliates (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID UNIQUE NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  affiliate_code            TEXT NOT NULL UNIQUE,
  organization_name         TEXT NOT NULL,
  organization_type         TEXT,                     -- bjj, crossfit, gym, clinic
  revenue_share_pct         NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  stripe_connect_account_id TEXT UNIQUE,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT affiliates_share_range CHECK (revenue_share_pct >= 0 AND revenue_share_pct <= 100)
);
CREATE INDEX idx_affiliates_code ON affiliates (affiliate_code);
CREATE TRIGGER trg_affiliates_updated_at BEFORE UPDATE ON affiliates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TABLE: medical_profiles  (PHI)
-- One clinical profile per patient. PHI fields are encrypted at the
-- application layer; access must be audited.
-- ============================================================================
CREATE TABLE medical_profiles (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  height_cm                     NUMERIC(5,1),
  weight_kg                     NUMERIC(5,1),
  blood_pressure_systolic       SMALLINT,
  blood_pressure_diastolic      SMALLINT,
  resting_heart_rate            SMALLINT,
  last_lab_panel_date           DATE,
  medical_history_encrypted     BYTEA,                -- encrypted JSON
  current_medications_encrypted BYTEA,                -- encrypted JSON
  allergies_encrypted           BYTEA,                -- encrypted JSON
  contraindications_encrypted   BYTEA,                -- encrypted JSON
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mp_bp_range CHECK (
    (blood_pressure_systolic IS NULL OR blood_pressure_systolic BETWEEN 50 AND 300) AND
    (blood_pressure_diastolic IS NULL OR blood_pressure_diastolic BETWEEN 30 AND 200)
  )
);
CREATE TRIGGER trg_medical_profiles_updated_at BEFORE UPDATE ON medical_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TABLE: intake_submissions  (PHI)
-- Multi-step clinical triage questionnaire results. The full branching answer
-- set is encrypted; triage_flags holds only the derived routing booleans
-- required by the medical network SOPs.
-- ============================================================================
CREATE TABLE intake_submissions (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  protocol_category             protocol_category NOT NULL,
  status                        intake_status NOT NULL DEFAULT 'started',
  risk_level                    clinical_risk_level,
  answers_encrypted             BYTEA,                -- encrypted JSON of all answers
  triage_flags                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  medical_network_submission_id TEXT UNIQUE,          -- id returned by Wheel / SteadyMD
  submitted_at                  TIMESTAMPTZ,
  reviewed_at                   TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_intake_user ON intake_submissions (user_id);
CREATE INDEX idx_intake_status ON intake_submissions (status);
CREATE TRIGGER trg_intake_updated_at BEFORE UPDATE ON intake_submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TABLE: subscriptions
-- Active recurring protocols. MRR is tracked in cents to avoid float drift.
-- ============================================================================
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  protocol_category       protocol_category NOT NULL,
  plan_name               TEXT NOT NULL,
  status                  subscription_status NOT NULL DEFAULT 'pending_clinical_review',
  stripe_subscription_id  TEXT UNIQUE,
  mrr_cents               INTEGER NOT NULL DEFAULT 0,
  currency                CHAR(3) NOT NULL DEFAULT 'USD',
  refill_count            INTEGER NOT NULL DEFAULT 0,
  refills_remaining       INTEGER NOT NULL DEFAULT 0,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  next_billing_date       DATE,
  affiliate_id            UUID REFERENCES affiliates (id) ON DELETE SET NULL,
  started_at              TIMESTAMPTZ,
  paused_at               TIMESTAMPTZ,
  canceled_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subs_mrr_nonneg CHECK (mrr_cents >= 0),
  CONSTRAINT subs_refills_nonneg CHECK (refill_count >= 0 AND refills_remaining >= 0)
);
CREATE INDEX idx_subs_user ON subscriptions (user_id);
CREATE INDEX idx_subs_status ON subscriptions (status);
CREATE INDEX idx_subs_next_billing ON subscriptions (next_billing_date);
CREATE INDEX idx_subs_affiliate ON subscriptions (affiliate_id);
CREATE TRIGGER trg_subs_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TABLE: prescriptions
-- Signed prescription records returned by the medical network webhook.
-- ============================================================================
CREATE TABLE prescriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  subscription_id       UUID REFERENCES subscriptions (id) ON DELETE SET NULL,
  intake_submission_id  UUID REFERENCES intake_submissions (id) ON DELETE SET NULL,
  provider_id           UUID NOT NULL REFERENCES providers (id),
  pharmacy_id           UUID REFERENCES pharmacies (id),
  drug_compound         TEXT NOT NULL,
  strength              TEXT,
  dosage_protocol       TEXT,
  sig_directions        TEXT,
  quantity              INTEGER,
  days_supply           INTEGER,
  refills_authorized    INTEGER NOT NULL DEFAULT 0,
  status                prescription_status NOT NULL DEFAULT 'pending_review',
  written_date          DATE,
  expiration_date       DATE,
  signed_payload_ref    TEXT,                          -- pointer to signed Rx document
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rx_refills_nonneg CHECK (refills_authorized >= 0),
  CONSTRAINT rx_expiry_after_written CHECK (
    expiration_date IS NULL OR written_date IS NULL OR expiration_date >= written_date
  )
);
CREATE INDEX idx_rx_user ON prescriptions (user_id);
CREATE INDEX idx_rx_subscription ON prescriptions (subscription_id);
CREATE INDEX idx_rx_status ON prescriptions (status);
CREATE TRIGGER trg_rx_updated_at BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TABLE: pharmacy_orders
-- Approved scripts routed to a 503A pharmacy B2B endpoint, with cold-chain
-- FedEx tracking synced back via webhook.
-- ============================================================================
CREATE TABLE pharmacy_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id       UUID NOT NULL REFERENCES prescriptions (id) ON DELETE CASCADE,
  pharmacy_id           UUID NOT NULL REFERENCES pharmacies (id),
  user_id               UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  shipping_address_id   UUID REFERENCES addresses (id),
  status                pharmacy_order_status NOT NULL DEFAULT 'queued',
  external_order_id     TEXT UNIQUE,                   -- pharmacy B2B order id
  tracking_carrier      TEXT DEFAULT 'fedex',
  tracking_number       TEXT,
  cold_chain            BOOLEAN NOT NULL DEFAULT TRUE,
  estimated_delivery    DATE,
  shipped_at            TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pharmorder_user ON pharmacy_orders (user_id);
CREATE INDEX idx_pharmorder_rx ON pharmacy_orders (prescription_id);
CREATE INDEX idx_pharmorder_status ON pharmacy_orders (status);
CREATE TRIGGER trg_pharmorder_updated_at BEFORE UPDATE ON pharmacy_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TABLE: transactions
-- Stripe Connect tri-party split records. The medical practice is the
-- Merchant of Record; the management fee is routed to PepNationRX LLC and the
-- consult fee remains in the provider account.
-- ============================================================================
CREATE TABLE transactions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  subscription_id           UUID REFERENCES subscriptions (id) ON DELETE SET NULL,
  stripe_payment_intent_id  TEXT UNIQUE,
  stripe_charge_id          TEXT,
  merchant_of_record        TEXT NOT NULL,             -- medical practice account id
  provider_account_id       TEXT,                      -- destination for consult fee
  platform_account_id       TEXT,                      -- PepNationRX LLC account id
  gross_amount_cents        INTEGER NOT NULL,
  consult_fee_cents         INTEGER NOT NULL DEFAULT 0,
  management_fee_cents      INTEGER NOT NULL DEFAULT 0,
  currency                  CHAR(3) NOT NULL DEFAULT 'USD',
  status                    transaction_status NOT NULL DEFAULT 'requires_payment',
  processed_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT txn_amounts_nonneg CHECK (
    gross_amount_cents >= 0 AND consult_fee_cents >= 0 AND management_fee_cents >= 0
  ),
  CONSTRAINT txn_split_balances CHECK (
    consult_fee_cents + management_fee_cents <= gross_amount_cents
  )
);
CREATE INDEX idx_txn_user ON transactions (user_id);
CREATE INDEX idx_txn_subscription ON transactions (subscription_id);
CREATE INDEX idx_txn_status ON transactions (status);
CREATE TRIGGER trg_txn_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TABLE: affiliate_referrals
-- Attribution from a referral link landing through to a converted subscription.
-- ============================================================================
CREATE TABLE affiliate_referrals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id        UUID NOT NULL REFERENCES affiliates (id) ON DELETE CASCADE,
  referred_user_id    UUID REFERENCES users (id) ON DELETE SET NULL,
  subscription_id     UUID REFERENCES subscriptions (id) ON DELETE SET NULL,
  referral_link_slug  TEXT NOT NULL,
  landed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_affref_affiliate ON affiliate_referrals (affiliate_id);
CREATE INDEX idx_affref_user ON affiliate_referrals (referred_user_id);

-- ============================================================================
-- TABLE: affiliate_payouts
-- Payout ledger for tracked revenue-share kickbacks.
-- ============================================================================
CREATE TABLE affiliate_payouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id        UUID NOT NULL REFERENCES affiliates (id) ON DELETE CASCADE,
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  amount_cents        INTEGER NOT NULL DEFAULT 0,
  currency            CHAR(3) NOT NULL DEFAULT 'USD',
  status              payout_status NOT NULL DEFAULT 'pending',
  stripe_transfer_id  TEXT UNIQUE,
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payout_amount_nonneg CHECK (amount_cents >= 0),
  CONSTRAINT payout_period_order CHECK (period_end >= period_start)
);
CREATE INDEX idx_affpayout_affiliate ON affiliate_payouts (affiliate_id);
CREATE TRIGGER trg_affpayout_updated_at BEFORE UPDATE ON affiliate_payouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TABLE: monthly_checkins  (PHI)
-- Automated monthly check-in forms required to authorize prescription renewals.
-- ============================================================================
CREATE TABLE monthly_checkins (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  subscription_id     UUID NOT NULL REFERENCES subscriptions (id) ON DELETE CASCADE,
  prescription_id     UUID REFERENCES prescriptions (id) ON DELETE SET NULL,
  status              checkin_status NOT NULL DEFAULT 'due',
  due_date            DATE NOT NULL,
  answers_encrypted   BYTEA,
  submitted_at        TIMESTAMPTZ,
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkin_user ON monthly_checkins (user_id);
CREATE INDEX idx_checkin_due ON monthly_checkins (due_date, status);
CREATE TRIGGER trg_checkin_updated_at BEFORE UPDATE ON monthly_checkins
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- TABLE: consents
-- Immutable record of mandatory acknowledgments, including the MSO billing
-- agent disclosure presented at checkout.
-- ============================================================================
CREATE TABLE consents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  consent_type     consent_type NOT NULL,
  document_version TEXT NOT NULL,
  accepted         BOOLEAN NOT NULL,
  ip_address       INET,
  user_agent       TEXT,
  accepted_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_consents_user ON consents (user_id, consent_type);

-- ============================================================================
-- TABLE: webhook_events
-- Idempotency and audit ledger for inbound events from the three external
-- APIs. (source, external_event_id) is unique to make replays safe.
-- ============================================================================
CREATE TABLE webhook_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source             webhook_source NOT NULL,
  event_type         TEXT NOT NULL,
  external_event_id  TEXT NOT NULL,
  payload_encrypted  BYTEA,                            -- may contain PHI
  status             webhook_status NOT NULL DEFAULT 'received',
  retry_count        INTEGER NOT NULL DEFAULT 0,
  error_detail       TEXT,
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at       TIMESTAMPTZ,
  CONSTRAINT webhook_unique_event UNIQUE (source, external_event_id)
);
CREATE INDEX idx_webhook_status ON webhook_events (status);

-- ============================================================================
-- TABLE: refresh_tokens
-- Server-side store for JWT refresh tokens, enabling revocation.
-- ============================================================================
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  ip_address  INET,
  user_agent  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user ON refresh_tokens (user_id);

-- ============================================================================
-- TABLE: audit_log
-- Append-only HIPAA access and action trail. High-volume, hence BIGSERIAL.
-- ============================================================================
CREATE TABLE audit_log (
  id            BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  actor_role    user_role,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     UUID,
  phi_accessed  BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address    INET,
  user_agent    TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor ON audit_log (actor_user_id);
CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_occurred ON audit_log (occurred_at);

COMMIT;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
