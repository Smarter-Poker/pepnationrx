-- ============================================================================
-- MIGRATION 0001 - TREATMENT CATALOG
-- Engine: PostgreSQL 15+
-- Applies on top of database/schema.sql.
-- ----------------------------------------------------------------------------
-- Adds the product catalog that backs the PepNationRX storefront: categories,
-- treatments (individual medications and peptides), and the per-treatment plan
-- cadences that carry pricing. Treatments link back to the protocol_category
-- enum so a catalog selection can open the matching triage flow.
--
-- The catalog is reference data. It contains no PHI and is safe to read at the
-- database layer without an audit_log entry.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- ENUMERATED TYPES
-- ----------------------------------------------------------------------------

-- Which audience a category is presented to. 'all' shows in both funnels.
CREATE TYPE category_audience AS ENUM ('men', 'women', 'all');

-- The delivery form of a treatment.
CREATE TYPE treatment_form AS ENUM (
  'injection', 'oral', 'sublingual', 'topical', 'nasal_spray',
  'troche', 'patch', 'device', 'iv_therapy'
);

-- Regulatory and sourcing posture of a treatment. This is tracked explicitly
-- so the platform can change what it offers without a code change, for
-- example if a compounded formulation must be withdrawn.
CREATE TYPE compound_type AS ENUM ('branded', 'compounded', 'otc');

-- Whether a treatment can be ordered now.
CREATE TYPE treatment_availability AS ENUM ('available', 'coming_soon', 'retired');

-- ----------------------------------------------------------------------------
-- TABLE: treatment_categories
-- The top level of the catalog taxonomy (Weight Management, Sexual Health,
-- Peptide Therapy, and so on).
-- ----------------------------------------------------------------------------
CREATE TABLE treatment_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  summary     TEXT,
  audience    category_audience NOT NULL DEFAULT 'all',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_treatment_categories_active ON treatment_categories (is_active, sort_order);
CREATE TRIGGER trg_treatment_categories_updated_at BEFORE UPDATE ON treatment_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- TABLE: treatments
-- One row per orderable medication or peptide. protocol_category links the
-- treatment to the triage flow a patient must complete to be prescribed it.
-- ----------------------------------------------------------------------------
CREATE TABLE treatments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id           UUID NOT NULL REFERENCES treatment_categories (id) ON DELETE RESTRICT,
  slug                  TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  summary               TEXT,
  form                  treatment_form NOT NULL,
  prescription_required BOOLEAN NOT NULL DEFAULT TRUE,
  compound              compound_type NOT NULL DEFAULT 'compounded',
  availability          treatment_availability NOT NULL DEFAULT 'available',
  protocol_category     protocol_category,            -- triage flow, when applicable
  sort_order            INTEGER NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_treatments_category ON treatments (category_id, sort_order);
CREATE INDEX idx_treatments_availability ON treatments (availability);
CREATE INDEX idx_treatments_protocol ON treatments (protocol_category);
CREATE TRIGGER trg_treatments_updated_at BEFORE UPDATE ON treatments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- TABLE: treatment_plans
-- A purchasable cadence for a treatment. Longer cadences carry a lower
-- price_cents (the per-month price), matching the multi-month plan model.
-- ----------------------------------------------------------------------------
CREATE TABLE treatment_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id    UUID NOT NULL REFERENCES treatments (id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  cadence_months  SMALLINT NOT NULL,
  price_cents     INTEGER NOT NULL,                   -- price per month, in cents
  currency        CHAR(3) NOT NULL DEFAULT 'USD',
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT treatment_plans_cadence_positive CHECK (cadence_months >= 1),
  CONSTRAINT treatment_plans_price_nonneg CHECK (price_cents >= 0),
  CONSTRAINT treatment_plans_unique_cadence UNIQUE (treatment_id, cadence_months)
);
CREATE INDEX idx_treatment_plans_treatment ON treatment_plans (treatment_id);
CREATE TRIGGER trg_treatment_plans_updated_at BEFORE UPDATE ON treatment_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- LINK: subscriptions -> treatment_plans
-- A subscription created from a catalog purchase records which plan it came
-- from. Nullable so historical and protocol-only subscriptions remain valid.
-- ----------------------------------------------------------------------------
ALTER TABLE subscriptions
  ADD COLUMN treatment_plan_id UUID REFERENCES treatment_plans (id) ON DELETE SET NULL;
CREATE INDEX idx_subscriptions_treatment_plan ON subscriptions (treatment_plan_id);

COMMIT;

-- ============================================================================
-- END OF MIGRATION 0001
-- ============================================================================
