-- ============================================================================
-- Migration 0008: Signature Protocols catalog.
-- ----------------------------------------------------------------------------
-- Adds the "Signature Protocols" category and 16 branded multi-compound
-- protocol stacks to the catalog tables created by migration 0001.
--
-- Two tiers:
--   Phase 1 (7 stacks) - amino-acid, coenzyme, vitamin, and mineral blends.
--     availability 'available', is_active TRUE. Live and purchasable.
--   Phase 2 (9 stacks) - next-generation peptide and metabolic protocols.
--     availability 'coming_soon', is_active FALSE. Present in the database
--     but UI-dormant: the catalog query and checkout both filter on
--     is_active = TRUE, so a Phase 2 stack cannot be browsed or purchased
--     until is_active is flipped to TRUE at launch.
--
-- Pricing mirrors frontend/js/data/treatment-catalog.js: price_cents is the
-- per-month price; the 3-month cadence carries the standard 10 percent
-- per-month discount, rounded to the nearest dollar. Every statement is
-- ON CONFLICT DO NOTHING so the migration is safe to re-run.
-- ============================================================================

BEGIN;

-- Category ------------------------------------------------------------------
INSERT INTO treatment_categories (slug, name, summary, audience, sort_order)
  VALUES ('signature-protocols', 'Signature Protocols',
    'Branded Multi-Compound Protocol Stacks Engineered For Targeted Optimization.',
    'all', 13)
  ON CONFLICT (slug) DO NOTHING;

-- Treatments: Phase 1 - Launch Today (available, is_active TRUE) -------------
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'kinetic-protocol', 'The Kinetic Protocol',
    'An Injectable Glutamine, Arginine, And Carnitine Blend Studied For Athletic Recovery And Cellular Energy.',
    'injection', TRUE, 'compounded', 'available', 'longevity', 1
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'vaso-drive-protocol', 'The Vaso-Drive Protocol',
    'An Arginine, Ornithine, And Citrulline Blend Studied For Circulatory Health And Vascular Flow.',
    'injection', TRUE, 'compounded', 'available', 'longevity', 2
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'metabolic-flux-protocol', 'The Metabolic Flux Protocol',
    'A Lipotropic MIC Plus B12 Injection Studied As A Co-Therapy For Metabolic And Weight Support.',
    'injection', TRUE, 'compounded', 'available', 'weight_management', 3
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'lumen-protocol', 'The Lumen Protocol',
    'A Dual-Vial NAD+ And Glutathione Stack Studied For Cellular Energy And Antioxidant Support.',
    'injection', TRUE, 'compounded', 'available', 'longevity', 4
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'aegis-protocol', 'The Aegis Protocol',
    'A Tri-Immune Vitamin C, Zinc, And Glutathione Injection Studied For Antioxidant And Immune Support.',
    'injection', TRUE, 'compounded', 'available', 'longevity', 5
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'zenith-protocol', 'The Zenith Protocol',
    'A Theanine, Taurine, And GABA Blend Studied For Calm Focus And Restful Sleep.',
    'injection', TRUE, 'compounded', 'available', 'longevity', 6
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'kera-matrix-protocol', 'The Kera-Matrix Protocol',
    'A High-Dose Biotin And B5 Stack Studied For Hair, Skin, And Follicular Support.',
    'injection', TRUE, 'compounded', 'available', NULL, 7
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;

-- Treatments: Phase 2 - Build But Hide (coming_soon, is_active FALSE) --------
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order, is_active)
  SELECT id, 'wolverine-protocol', 'The Wolverine Protocol',
    'A BPC-157 And TB-500 Peptide Stack Studied For Tissue Repair And Recovery.',
    'injection', TRUE, 'compounded', 'coming_soon', 'peptide_therapy', 8, FALSE
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order, is_active)
  SELECT id, 'glow-protocol', 'The Glow Protocol',
    'A GHK-Cu, BPC-157, And TB-500 Blend Studied For Soft-Tissue Repair And Skin Renewal.',
    'injection', TRUE, 'compounded', 'coming_soon', 'peptide_therapy', 9, FALSE
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order, is_active)
  SELECT id, 'klow-protocol', 'The Klow Protocol',
    'The Glow Blend Plus KPV, Studied For Structural Repair And Anti-Inflammatory Support.',
    'injection', TRUE, 'compounded', 'coming_soon', 'peptide_therapy', 10, FALSE
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order, is_active)
  SELECT id, 'neuro-apex-protocol', 'The Neuro-Apex Protocol',
    'A Semax And Selank Pairing Studied For Focus And A Balanced Stress Response.',
    'nasal_spray', TRUE, 'compounded', 'coming_soon', 'peptide_therapy', 11, FALSE
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order, is_active)
  SELECT id, 'chronos-protocol', 'The Chronos Protocol',
    'An Epitalon And DSIP Stack Studied For Deep Sleep And Cellular Longevity.',
    'injection', TRUE, 'compounded', 'coming_soon', 'peptide_therapy', 12, FALSE
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order, is_active)
  SELECT id, 'titan-protocol', 'The Titan Protocol',
    'A Retatrutide Triple-Receptor Agonist Studied For Significant Metabolic Weight Loss.',
    'injection', TRUE, 'compounded', 'coming_soon', 'weight_management', 13, FALSE
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order, is_active)
  SELECT id, 'apex-dual-protocol', 'The Apex-Dual Protocol',
    'A Cagrilintide And Semaglutide Stack Studied For Appetite Control And Plateau Breaking.',
    'injection', TRUE, 'compounded', 'coming_soon', 'weight_management', 14, FALSE
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order, is_active)
  SELECT id, 'hepatic-flux-protocol', 'The Hepatic Flux Protocol',
    'A Survodutide Glucagon And GLP-1 Dual Agonist Studied For Metabolic And Hepatic Support.',
    'injection', TRUE, 'compounded', 'coming_soon', 'weight_management', 15, FALSE
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order, is_active)
  SELECT id, 'myo-preserve-protocol', 'The Myo-Preserve Protocol',
    'An Activin Receptor Modulator Studied For Lean-Mass Preservation During Weight Loss.',
    'injection', TRUE, 'compounded', 'coming_soon', 'weight_management', 16, FALSE
  FROM treatment_categories WHERE slug = 'signature-protocols'
  ON CONFLICT (slug) DO NOTHING;

-- Plans: Phase 1 - Monthly (cadence 1) and 3-Month (cadence 3, default) ------
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 19900, FALSE FROM treatments WHERE slug = 'kinetic-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 17900, TRUE FROM treatments WHERE slug = 'kinetic-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 19900, FALSE FROM treatments WHERE slug = 'vaso-drive-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 17900, TRUE FROM treatments WHERE slug = 'vaso-drive-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 14900, FALSE FROM treatments WHERE slug = 'metabolic-flux-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 13400, TRUE FROM treatments WHERE slug = 'metabolic-flux-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 44900, FALSE FROM treatments WHERE slug = 'lumen-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 40400, TRUE FROM treatments WHERE slug = 'lumen-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 14900, FALSE FROM treatments WHERE slug = 'aegis-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 13400, TRUE FROM treatments WHERE slug = 'aegis-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 12900, FALSE FROM treatments WHERE slug = 'zenith-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 11600, TRUE FROM treatments WHERE slug = 'zenith-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 12900, FALSE FROM treatments WHERE slug = 'kera-matrix-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 11600, TRUE FROM treatments WHERE slug = 'kera-matrix-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;

-- Plans: Phase 2 - seeded now so a launch only needs the is_active flip ------
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 34900, FALSE FROM treatments WHERE slug = 'wolverine-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 31400, TRUE FROM treatments WHERE slug = 'wolverine-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 44900, FALSE FROM treatments WHERE slug = 'glow-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 40400, TRUE FROM treatments WHERE slug = 'glow-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 49900, FALSE FROM treatments WHERE slug = 'klow-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 44900, TRUE FROM treatments WHERE slug = 'klow-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 29900, FALSE FROM treatments WHERE slug = 'neuro-apex-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 26900, TRUE FROM treatments WHERE slug = 'neuro-apex-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 39900, FALSE FROM treatments WHERE slug = 'chronos-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 35900, TRUE FROM treatments WHERE slug = 'chronos-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 49900, FALSE FROM treatments WHERE slug = 'titan-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 44900, TRUE FROM treatments WHERE slug = 'titan-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 44900, FALSE FROM treatments WHERE slug = 'apex-dual-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 40400, TRUE FROM treatments WHERE slug = 'apex-dual-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 39900, FALSE FROM treatments WHERE slug = 'hepatic-flux-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 35900, TRUE FROM treatments WHERE slug = 'hepatic-flux-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 59900, FALSE FROM treatments WHERE slug = 'myo-preserve-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 53900, TRUE FROM treatments WHERE slug = 'myo-preserve-protocol'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;

COMMIT;

-- ============================================================================
-- END OF MIGRATION 0008
-- ============================================================================
