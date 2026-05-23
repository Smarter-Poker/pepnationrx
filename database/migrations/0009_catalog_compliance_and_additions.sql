-- ============================================================================
-- Migration 0009: catalog compliance and additions.
-- ----------------------------------------------------------------------------
-- Reconciles the catalog against the PepNationRX product directive and current
-- (2026) FDA 503A compounding rules. Three parts:
--
--   1. ADD eight directive compounds not yet in the catalog. Five are legal to
--      compound and ship visible; three (leuprolide, goserelin, kisspeptin-10)
--      ship hidden (is_active = FALSE).
--   2. REPRICE six existing visible compounds to the directive's retail prices.
--      treatment_plans.price_cents is the per-month price; the 3- and 6-month
--      cadences keep the standard 10 / 18 percent discount.
--   3. HIDE thirteen existing compounds that are not currently lawful to
--      compound: the peptides pending the FDA PCAC review of July 23-24, 2026
--      (BPC-157, TB-500, KPV, MOTS-c, Semax, Selank, GHK-Cu and the BPC/GLOW/
--      KLOW blends), the investigational metabolic agents retatrutide and
--      cagrilintide, and tesamorelin (FDA-approved as Egrifta; copy-rule
--      restricted). Hidden = is_active FALSE + availability 'coming_soon'; the
--      catalog query and checkout both filter on is_active, so a hidden
--      compound cannot be browsed or purchased until the flag is flipped.
--
-- Every statement is idempotent (ON CONFLICT DO NOTHING / UPDATE by slug) so
-- the migration is safe to re-run.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- PART 1: New compounds (directive Phase 1 and Phase 2 individual compounds).
-- ----------------------------------------------------------------------------

-- Visible: legal to compound under 503A in 2026.
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'liraglutide', 'Liraglutide',
    'A Daily GLP-1 Injection Studied For Appetite Regulation And Weight Management.',
    'injection', TRUE, 'compounded', 'available', 'weight_management', 20
  FROM treatment_categories WHERE slug = 'weight-management'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'exenatide', 'Exenatide',
    'A GLP-1 Receptor Agonist Injection Studied For Glycemic And Metabolic Support.',
    'injection', TRUE, 'compounded', 'available', 'weight_management', 21
  FROM treatment_categories WHERE slug = 'weight-management'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'gonadorelin', 'Gonadorelin',
    'A GnRH Peptide Often Paired With Hormone Therapy To Support Natural Production.',
    'injection', TRUE, 'compounded', 'available', 'trt', 20
  FROM treatment_categories WHERE slug = 'testosterone'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'oxytocin', 'Oxytocin',
    'A Compounded Troche Or Nasal Spray Studied For Mood, Bonding, And Intimacy.',
    'troche', TRUE, 'compounded', 'available', 'sexual_health', 20
  FROM treatment_categories WHERE slug = 'sexual-health'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'l-carnitine', 'L-Carnitine',
    'An Injectable Amino Acid Studied For Fat Metabolism And Cellular Energy.',
    'injection', TRUE, 'compounded', 'available', 'longevity', 20
  FROM treatment_categories WHERE slug = 'longevity'
  ON CONFLICT (slug) DO NOTHING;

-- Hidden: not currently lawful to ship direct-to-consumer (is_active FALSE).
-- Leuprolide and goserelin are FDA-approved hormone-suppression drugs
-- (copy-rule restricted); kisspeptin-10 is pending the July 2026 PCAC review.
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order, is_active)
  SELECT id, 'leuprolide', 'Leuprolide',
    'A GnRH Agonist. Reserved Pending Clinical-Scope And Compounding Review.',
    'injection', TRUE, 'compounded', 'coming_soon', 'trt', 21, FALSE
  FROM treatment_categories WHERE slug = 'testosterone'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order, is_active)
  SELECT id, 'goserelin', 'Goserelin',
    'A GnRH Agonist. Reserved Pending Clinical-Scope And Compounding Review.',
    'injection', TRUE, 'compounded', 'coming_soon', 'trt', 22, FALSE
  FROM treatment_categories WHERE slug = 'testosterone'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order, is_active)
  SELECT id, 'kisspeptin-10', 'Kisspeptin-10',
    'A Peptide Studied For Endocrine Signaling. Pending The July 2026 FDA PCAC Review.',
    'injection', TRUE, 'compounded', 'coming_soon', 'peptide_therapy', 20, FALSE
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;

-- Plans for the new compounds. Monthly is the directive retail price; the
-- 3-month cadence carries the standard 10 percent per-month discount.
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 24900, FALSE FROM treatments WHERE slug = 'liraglutide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 22400, TRUE FROM treatments WHERE slug = 'liraglutide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 24900, FALSE FROM treatments WHERE slug = 'exenatide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 22400, TRUE FROM treatments WHERE slug = 'exenatide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 14900, FALSE FROM treatments WHERE slug = 'gonadorelin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 13400, TRUE FROM treatments WHERE slug = 'gonadorelin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 12900, FALSE FROM treatments WHERE slug = 'oxytocin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 11600, TRUE FROM treatments WHERE slug = 'oxytocin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 14900, FALSE FROM treatments WHERE slug = 'l-carnitine'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 13400, TRUE FROM treatments WHERE slug = 'l-carnitine'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 29900, FALSE FROM treatments WHERE slug = 'leuprolide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 26900, TRUE FROM treatments WHERE slug = 'leuprolide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 29900, FALSE FROM treatments WHERE slug = 'goserelin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 26900, TRUE FROM treatments WHERE slug = 'goserelin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 19900, FALSE FROM treatments WHERE slug = 'kisspeptin-10'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 17900, TRUE FROM treatments WHERE slug = 'kisspeptin-10'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;

-- ----------------------------------------------------------------------------
-- PART 2: Reprice six existing visible compounds to directive retail prices.
-- ----------------------------------------------------------------------------

UPDATE treatment_plans SET price_cents = 29900
  WHERE cadence_months = 1 AND treatment_id = (SELECT id FROM treatments WHERE slug = 'semaglutide');
UPDATE treatment_plans SET price_cents = 26900
  WHERE cadence_months = 3 AND treatment_id = (SELECT id FROM treatments WHERE slug = 'semaglutide');
UPDATE treatment_plans SET price_cents = 24500
  WHERE cadence_months = 6 AND treatment_id = (SELECT id FROM treatments WHERE slug = 'semaglutide');

UPDATE treatment_plans SET price_cents = 39900
  WHERE cadence_months = 1 AND treatment_id = (SELECT id FROM treatments WHERE slug = 'tirzepatide');
UPDATE treatment_plans SET price_cents = 35900
  WHERE cadence_months = 3 AND treatment_id = (SELECT id FROM treatments WHERE slug = 'tirzepatide');
UPDATE treatment_plans SET price_cents = 32700
  WHERE cadence_months = 6 AND treatment_id = (SELECT id FROM treatments WHERE slug = 'tirzepatide');

UPDATE treatment_plans SET price_cents = 29900
  WHERE cadence_months = 1 AND treatment_id = (SELECT id FROM treatments WHERE slug = 'sermorelin');
UPDATE treatment_plans SET price_cents = 26900
  WHERE cadence_months = 3 AND treatment_id = (SELECT id FROM treatments WHERE slug = 'sermorelin');

UPDATE treatment_plans SET price_cents = 19900
  WHERE cadence_months = 1 AND treatment_id = (SELECT id FROM treatments WHERE slug = 'pt-141');
UPDATE treatment_plans SET price_cents = 17900
  WHERE cadence_months = 3 AND treatment_id = (SELECT id FROM treatments WHERE slug = 'pt-141');

UPDATE treatment_plans SET price_cents = 17900
  WHERE cadence_months = 1 AND treatment_id = (SELECT id FROM treatments WHERE slug = 'glutathione');
UPDATE treatment_plans SET price_cents = 16100
  WHERE cadence_months = 3 AND treatment_id = (SELECT id FROM treatments WHERE slug = 'glutathione');

UPDATE treatment_plans SET price_cents = 34900
  WHERE cadence_months = 1 AND treatment_id = (SELECT id FROM treatments WHERE slug = 'nad-plus');
UPDATE treatment_plans SET price_cents = 31400
  WHERE cadence_months = 3 AND treatment_id = (SELECT id FROM treatments WHERE slug = 'nad-plus');

-- ----------------------------------------------------------------------------
-- PART 3: Hide compounds that are not currently lawful to ship.
-- ----------------------------------------------------------------------------

-- Peptides pending the FDA PCAC review of July 23-24, 2026.
UPDATE treatments SET is_active = FALSE, availability = 'coming_soon'
  WHERE slug IN (
    'bpc-157', 'tb-500', 'bpc-tb-blend', 'kpv', 'mots-c',
    'semax', 'selank', 'ghk-cu', 'glow-blend', 'klow-blend'
  );

-- Investigational metabolic agents not yet FDA-approved.
UPDATE treatments SET is_active = FALSE, availability = 'coming_soon'
  WHERE slug IN ('retatrutide', 'cagrilintide');

-- Tesamorelin: FDA-approved as Egrifta; 503A copy-rule restricted. Retired.
UPDATE treatments SET is_active = FALSE, availability = 'retired'
  WHERE slug = 'tesamorelin';

COMMIT;

-- ============================================================================
-- END OF MIGRATION 0009
-- ============================================================================
