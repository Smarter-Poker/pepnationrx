-- ============================================================================
-- Migration 0003: treatment catalog seed.
-- ----------------------------------------------------------------------------
-- Loads the catalog (categories, treatments, per-cadence plans) into the
-- tables created by migration 0001. The backend checkout flow reads
-- treatment_plans.price_cents as the authoritative price, so this data must
-- exist server-side - the client-supplied price is no longer trusted.
--
-- Generated from frontend/js/data/treatment-catalog.js so the storefront and
-- the backend price authority are derived from one source. Every statement
-- is ON CONFLICT DO NOTHING so the seed is safe to re-run.
-- ============================================================================

BEGIN;

-- Categories ----------------------------------------------------------------
INSERT INTO treatment_categories (slug, name, summary, audience, sort_order)
  VALUES ('weight-management', 'Weight Management', 'Medically Supervised Programs Built Around GLP-1 And Metabolic Therapy.', 'all', 1)
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatment_categories (slug, name, summary, audience, sort_order)
  VALUES ('sexual-health', 'Sexual Health', 'Discreet, Clinician-Reviewed Care For Erectile Function And Libido.', 'all', 2)
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatment_categories (slug, name, summary, audience, sort_order)
  VALUES ('testosterone', 'Testosterone And Hormones', 'Hormone Optimization For Energy, Strength, And Vitality.', 'men', 3)
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatment_categories (slug, name, summary, audience, sort_order)
  VALUES ('womens-hormone', 'Womens Hormone Health', 'Hormone Care Across Every Life Stage, Including Perimenopause And Menopause.', 'women', 4)
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatment_categories (slug, name, summary, audience, sort_order)
  VALUES ('birth-control', 'Birth Control', 'Online Birth Control Prescribed And Delivered, Refilled Automatically.', 'women', 5)
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatment_categories (slug, name, summary, audience, sort_order)
  VALUES ('hair', 'Hair', 'Prescription And Topical Treatments For Thinning Hair And Regrowth.', 'all', 6)
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatment_categories (slug, name, summary, audience, sort_order)
  VALUES ('skin', 'Skin And Dermatology', 'Anti-Aging, Acne, And Cosmetic Peptide Regimens.', 'all', 7)
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatment_categories (slug, name, summary, audience, sort_order)
  VALUES ('mental-health', 'Mental Health', 'Provider-Managed Care For Anxiety, Depression, And Stress.', 'all', 8)
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatment_categories (slug, name, summary, audience, sort_order)
  VALUES ('sleep', 'Sleep', 'Treatments And Support For Better, More Consistent Sleep.', 'all', 9)
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatment_categories (slug, name, summary, audience, sort_order)
  VALUES ('peptide-therapy', 'Peptide Therapy', 'Targeted Peptides For Recovery, Repair, Growth, And Cognition.', 'all', 10)
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatment_categories (slug, name, summary, audience, sort_order)
  VALUES ('longevity', 'Longevity And Wellness', 'Cellular Health, Antioxidant, And Foundational Wellness Therapies.', 'all', 11)
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatment_categories (slug, name, summary, audience, sort_order)
  VALUES ('primary-care', 'Primary Care And Labs', 'Comprehensive Lab Panels To Establish And Track Your Baseline.', 'all', 12)
  ON CONFLICT (slug) DO NOTHING;

-- Treatments ----------------------------------------------------------------
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'semaglutide', 'Semaglutide', 'A Weekly GLP-1 Injection That Reduces Appetite And Supports Steady Weight Loss.', 'injection', TRUE, 'compounded', 'available', 'weight_management', 1
  FROM treatment_categories WHERE slug = 'weight-management'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'tirzepatide', 'Tirzepatide', 'A Dual GLP-1 And GIP Injection For Patients Seeking Greater Weight Loss.', 'injection', TRUE, 'compounded', 'available', 'weight_management', 2
  FROM treatment_categories WHERE slug = 'weight-management'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'retatrutide', 'Retatrutide', 'A Next-Generation Triple-Agonist Weight Loss Injection. Coming Soon.', 'injection', TRUE, 'compounded', 'coming_soon', 'weight_management', 3
  FROM treatment_categories WHERE slug = 'weight-management'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'cagrilintide', 'Cagrilintide', 'An Amylin Analog Used Alone Or Blended With A GLP-1 For Appetite Control.', 'injection', TRUE, 'compounded', 'available', 'weight_management', 4
  FROM treatment_categories WHERE slug = 'weight-management'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'aod-9604', 'AOD9604', 'A Peptide Fragment Studied For Fat Metabolism Without Affecting Blood Sugar.', 'injection', TRUE, 'compounded', 'available', 'weight_management', 5
  FROM treatment_categories WHERE slug = 'weight-management'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'lipo-c', 'LIPO-C Injection', 'An L-Carnitine And Lipotropic Blend That Supports Fat Metabolism And Energy.', 'injection', TRUE, 'compounded', 'available', 'weight_management', 6
  FROM treatment_categories WHERE slug = 'weight-management'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'sildenafil', 'Sildenafil', 'The Active Ingredient In Viagra, Taken As Needed For Erectile Function.', 'oral', TRUE, 'branded', 'available', 'sexual_health', 7
  FROM treatment_categories WHERE slug = 'sexual-health'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'tadalafil', 'Tadalafil', 'The Active Ingredient In Cialis, Available As Needed Or As A Daily Dose.', 'oral', TRUE, 'branded', 'available', 'sexual_health', 8
  FROM treatment_categories WHERE slug = 'sexual-health'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'ed-troche', 'Sildenafil And Tadalafil Troche', 'A Dissolvable Combination Troche For A Faster, Longer Window Of Effect.', 'troche', TRUE, 'compounded', 'available', 'sexual_health', 9
  FROM treatment_categories WHERE slug = 'sexual-health'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'pt-141', 'PT-141', 'A Melanocortin Peptide That Supports Libido And Arousal In Men And Women.', 'injection', TRUE, 'compounded', 'available', 'sexual_health', 10
  FROM treatment_categories WHERE slug = 'sexual-health'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'premature-ejaculation', 'Premature Ejaculation Treatment', 'An Off-Label Oral Treatment To Improve Control And Confidence.', 'oral', TRUE, 'branded', 'available', 'sexual_health', 11
  FROM treatment_categories WHERE slug = 'sexual-health'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'enclomiphene', 'Enclomiphene', 'An Oral Treatment That Raises Natural Testosterone While Preserving Fertility.', 'oral', TRUE, 'compounded', 'available', 'trt', 12
  FROM treatment_categories WHERE slug = 'testosterone'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'testosterone-cypionate', 'Testosterone Cypionate', 'A Classic Injectable Testosterone Protocol For Confirmed Low Testosterone.', 'injection', TRUE, 'branded', 'available', 'trt', 13
  FROM treatment_categories WHERE slug = 'testosterone'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'testosterone-cream', 'Testosterone Cream', 'A Daily Topical Testosterone For Patients Who Prefer To Avoid Injections.', 'topical', TRUE, 'compounded', 'available', 'trt', 14
  FROM treatment_categories WHERE slug = 'testosterone'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'oral-testosterone', 'Oral Testosterone', 'A Branded, FDA-Approved Oral Testosterone Capsule. Coming Soon.', 'oral', TRUE, 'branded', 'coming_soon', 'trt', 15
  FROM treatment_categories WHERE slug = 'testosterone'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'hcg', 'HCG', 'Often Paired With Testosterone Therapy To Help Maintain Fertility.', 'injection', TRUE, 'compounded', 'available', 'trt', 16
  FROM treatment_categories WHERE slug = 'testosterone'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'estradiol-therapy', 'Estradiol Therapy', 'Estrogen Replacement For Perimenopause And Menopause Symptom Relief.', 'patch', TRUE, 'branded', 'available', 'womens_wellness', 17
  FROM treatment_categories WHERE slug = 'womens-hormone'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'progesterone', 'Progesterone', 'Often Paired With Estrogen Therapy For Balanced Hormone Support.', 'oral', TRUE, 'branded', 'available', 'womens_wellness', 18
  FROM treatment_categories WHERE slug = 'womens-hormone'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'vaginal-estrogen', 'Vaginal Estrogen', 'A Localized Estrogen Treatment For Vaginal And Urinary Symptoms.', 'topical', TRUE, 'branded', 'available', 'womens_wellness', 19
  FROM treatment_categories WHERE slug = 'womens-hormone'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'womens-testosterone', 'Womens Testosterone', 'A Low-Dose Topical Testosterone To Support Energy And Libido In Women.', 'topical', TRUE, 'compounded', 'available', 'womens_wellness', 20
  FROM treatment_categories WHERE slug = 'womens-hormone'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'birth-control-pill', 'Birth Control Pill', 'A Daily Oral Contraceptive Prescribed Online And Refilled Automatically.', 'oral', TRUE, 'branded', 'available', NULL, 21
  FROM treatment_categories WHERE slug = 'birth-control'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'birth-control-patch', 'Birth Control Patch', 'A Weekly Transdermal Contraceptive Patch.', 'patch', TRUE, 'branded', 'available', NULL, 22
  FROM treatment_categories WHERE slug = 'birth-control'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'birth-control-ring', 'Birth Control Ring', 'A Monthly Vaginal Ring Contraceptive.', 'device', TRUE, 'branded', 'available', NULL, 23
  FROM treatment_categories WHERE slug = 'birth-control'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'emergency-contraception', 'Emergency Contraception', 'On-Hand Emergency Contraception, Available Without A Prescription.', 'oral', FALSE, 'otc', 'available', NULL, 24
  FROM treatment_categories WHERE slug = 'birth-control'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'finasteride', 'Finasteride', 'A Daily Oral Tablet That Slows Hair Loss And Supports Regrowth In Men.', 'oral', TRUE, 'branded', 'available', NULL, 25
  FROM treatment_categories WHERE slug = 'hair'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'topical-hair-formula', 'Topical Finasteride And Minoxidil', 'A Compounded Topical That Combines Two Proven Ingredients In One Application.', 'topical', TRUE, 'compounded', 'available', NULL, 26
  FROM treatment_categories WHERE slug = 'hair'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'minoxidil', 'Minoxidil Topical', 'A Topical Solution That Stimulates Regrowth. Available Without A Prescription.', 'topical', FALSE, 'otc', 'available', NULL, 27
  FROM treatment_categories WHERE slug = 'hair'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'oral-minoxidil', 'Oral Minoxidil', 'A Low-Dose Oral Tablet Prescribed For Hair Density.', 'oral', TRUE, 'branded', 'available', NULL, 28
  FROM treatment_categories WHERE slug = 'hair'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'biotin-gummies', 'Biotin Gummies', 'A Daily Supplement That Supports Hair, Skin, And Nail Health.', 'oral', FALSE, 'otc', 'available', NULL, 29
  FROM treatment_categories WHERE slug = 'hair'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'tretinoin', 'Tretinoin', 'A Prescription Retinoid For Fine Lines, Texture, And Overall Skin Renewal.', 'topical', TRUE, 'branded', 'available', NULL, 30
  FROM treatment_categories WHERE slug = 'skin'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'anti-aging-cream', 'Custom Anti-Aging Cream', 'A Compounded Nightly Cream Personalized To Your Skin Goals.', 'topical', TRUE, 'compounded', 'available', NULL, 31
  FROM treatment_categories WHERE slug = 'skin'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'acne-treatment', 'Acne Treatment', 'A Provider-Directed Regimen For Persistent And Hormonal Acne.', 'topical', TRUE, 'branded', 'available', NULL, 32
  FROM treatment_categories WHERE slug = 'skin'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'ghk-cu', 'GHK-Cu', 'A Copper Peptide Studied For Skin Firmness, Repair, And Collagen Support.', 'topical', TRUE, 'compounded', 'available', NULL, 33
  FROM treatment_categories WHERE slug = 'skin'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'glow-blend', 'GLOW Blend', 'A Cosmetic Peptide Blend Of TB-500, BPC-157, And GHK For Skin And Recovery.', 'injection', TRUE, 'compounded', 'available', NULL, 34
  FROM treatment_categories WHERE slug = 'skin'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'klow-blend', 'KLOW Blend', 'The GLOW Blend Plus KPV, Adding Anti-Inflammatory Support For Skin Health.', 'injection', TRUE, 'compounded', 'available', NULL, 35
  FROM treatment_categories WHERE slug = 'skin'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'snap-8', 'SNAP-8', 'A Topical Peptide Studied For The Appearance Of Expression Lines.', 'topical', TRUE, 'compounded', 'available', NULL, 36
  FROM treatment_categories WHERE slug = 'skin'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'argireline', 'Argireline', 'A Topical Peptide That Targets The Look Of Fine Lines And Wrinkles.', 'topical', TRUE, 'compounded', 'available', NULL, 37
  FROM treatment_categories WHERE slug = 'skin'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'matrixyl', 'Matrixyl', 'A Topical Peptide Studied For Collagen Support And Skin Smoothness.', 'topical', TRUE, 'compounded', 'available', NULL, 38
  FROM treatment_categories WHERE slug = 'skin'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'melanotan-2', 'MT-2 Melanotan 2', 'A Melanocortin Peptide Studied For Tanning Response. Provider Reviewed.', 'injection', TRUE, 'compounded', 'available', NULL, 39
  FROM treatment_categories WHERE slug = 'skin'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'anxiety-depression', 'Anxiety And Depression Treatment', 'Provider-Managed Medication For Anxiety And Depression, Adjusted Over Time.', 'oral', TRUE, 'branded', 'available', NULL, 40
  FROM treatment_categories WHERE slug = 'mental-health'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'selank', 'Selank', 'A Peptide Studied For Calm Focus And A Balanced Stress Response.', 'nasal_spray', TRUE, 'compounded', 'available', NULL, 41
  FROM treatment_categories WHERE slug = 'mental-health'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'semax', 'Semax', 'A Peptide Studied For Cognitive Clarity And Mental Stamina.', 'nasal_spray', TRUE, 'compounded', 'available', NULL, 42
  FROM treatment_categories WHERE slug = 'mental-health'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'sleep-support', 'Prescription Sleep Support', 'A Provider-Directed Treatment For Difficulty Falling Or Staying Asleep.', 'oral', TRUE, 'branded', 'available', NULL, 43
  FROM treatment_categories WHERE slug = 'sleep'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'melatonin', 'Melatonin', 'A Nightly Supplement To Support A Consistent Sleep Routine.', 'oral', FALSE, 'otc', 'available', NULL, 44
  FROM treatment_categories WHERE slug = 'sleep'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'bpc-157', 'BPC-157', 'A Peptide Widely Studied For Tissue Repair And Recovery Support.', 'injection', TRUE, 'compounded', 'available', 'peptide_therapy', 45
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'tb-500', 'TB-500 Thymosin Beta-4', 'A Peptide Studied For Flexibility, Recovery, And Tissue Repair.', 'injection', TRUE, 'compounded', 'available', 'peptide_therapy', 46
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'bpc-tb-blend', 'BPC-157 And TB-500 Blend', 'A Combined 10mg And 10mg Recovery Blend In A Single Protocol.', 'injection', TRUE, 'compounded', 'available', 'peptide_therapy', 47
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'cjc-ipamorelin', 'CJC-1295 And Ipamorelin', 'A Growth-Hormone Secretagogue Pairing Studied For Recovery And Body Composition.', 'injection', TRUE, 'compounded', 'available', 'peptide_therapy', 48
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'ipamorelin', 'Ipamorelin', 'A Selective Growth-Hormone Secretagogue Used As A Standalone Protocol.', 'injection', TRUE, 'compounded', 'available', 'peptide_therapy', 49
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'sermorelin', 'Sermorelin', 'A Growth-Hormone-Releasing Peptide Studied For Recovery And Sleep Quality.', 'injection', TRUE, 'compounded', 'available', 'peptide_therapy', 50
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'tesamorelin', 'Tesamorelin', 'A Growth-Hormone-Releasing Peptide Studied For Visceral Fat Reduction.', 'injection', TRUE, 'compounded', 'available', 'peptide_therapy', 51
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'hgh-fragment-176-191', 'HGH Fragment 176-191', 'A Growth-Hormone Fragment Studied For Fat Metabolism.', 'injection', TRUE, 'compounded', 'available', 'peptide_therapy', 52
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'peg-mgf', 'PEG-MGF', 'A Mechano Growth Factor Variant Studied For Muscle Recovery.', 'injection', TRUE, 'compounded', 'available', 'peptide_therapy', 53
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'mots-c', 'MOTS-c', 'A Mitochondrial-Derived Peptide Studied For Metabolism And Endurance.', 'injection', TRUE, 'compounded', 'available', 'peptide_therapy', 54
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'thymosin-alpha-1', 'Thymosin Alpha-1', 'A Peptide Studied For Immune Regulation And Resilience.', 'injection', TRUE, 'compounded', 'available', 'peptide_therapy', 55
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'kpv', 'KPV', 'A Short Peptide Studied For Anti-Inflammatory And Gut Health Support.', 'injection', TRUE, 'compounded', 'available', 'peptide_therapy', 56
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'five-amino-1mq', '5-Amino-1MQ', 'An Oral Compound Studied For Metabolic Activity And Body Composition.', 'oral', TRUE, 'compounded', 'available', 'peptide_therapy', 57
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'dihexa', 'Dihexa', 'A Peptide Studied For Cognitive Performance And Neural Support.', 'oral', TRUE, 'compounded', 'available', 'peptide_therapy', 58
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'humanin', 'Humanin', 'A Mitochondrial-Derived Peptide Studied For Cellular Resilience.', 'injection', TRUE, 'compounded', 'available', 'peptide_therapy', 59
  FROM treatment_categories WHERE slug = 'peptide-therapy'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'nad-plus', 'NAD+', 'A Coenzyme Therapy Studied For Cellular Energy And Healthy Aging.', 'injection', TRUE, 'compounded', 'available', 'longevity', 60
  FROM treatment_categories WHERE slug = 'longevity'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'glutathione', 'Glutathione', 'A Master Antioxidant Therapy Studied For Detoxification And Skin Clarity.', 'injection', TRUE, 'compounded', 'available', 'longevity', 61
  FROM treatment_categories WHERE slug = 'longevity'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'vitamin-b12', 'Vitamin B12', 'A B12 Injection To Support Energy And Healthy Metabolism.', 'injection', TRUE, 'compounded', 'available', 'longevity', 62
  FROM treatment_categories WHERE slug = 'longevity'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'comprehensive-lab-panel', 'Comprehensive Lab Panel', 'A Broad Blood Panel To Establish Your Baseline Health Picture.', 'device', FALSE, 'otc', 'available', NULL, 63
  FROM treatment_categories WHERE slug = 'primary-care'
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO treatments (category_id, slug, name, summary, form, prescription_required, compound, availability, protocol_category, sort_order)
  SELECT id, 'hormone-lab-panel', 'Hormone Lab Panel', 'A Focused Hormone Panel To Guide Testosterone And Hormone Therapy.', 'device', FALSE, 'otc', 'available', NULL, 64
  FROM treatment_categories WHERE slug = 'primary-care'
  ON CONFLICT (slug) DO NOTHING;

-- Treatment plans -----------------------------------------------------------
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 24900, FALSE
  FROM treatments WHERE slug = 'semaglutide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 22400, TRUE
  FROM treatments WHERE slug = 'semaglutide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '6-Month Plan', 6, 20400, FALSE
  FROM treatments WHERE slug = 'semaglutide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 32900, FALSE
  FROM treatments WHERE slug = 'tirzepatide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 29600, TRUE
  FROM treatments WHERE slug = 'tirzepatide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '6-Month Plan', 6, 27000, FALSE
  FROM treatments WHERE slug = 'tirzepatide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 39900, FALSE
  FROM treatments WHERE slug = 'retatrutide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 35900, TRUE
  FROM treatments WHERE slug = 'retatrutide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 29900, FALSE
  FROM treatments WHERE slug = 'cagrilintide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 26900, TRUE
  FROM treatments WHERE slug = 'cagrilintide'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 17900, FALSE
  FROM treatments WHERE slug = 'aod-9604'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 16100, TRUE
  FROM treatments WHERE slug = 'aod-9604'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 9900, FALSE
  FROM treatments WHERE slug = 'lipo-c'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 8900, TRUE
  FROM treatments WHERE slug = 'lipo-c'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 7900, FALSE
  FROM treatments WHERE slug = 'sildenafil'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 7100, TRUE
  FROM treatments WHERE slug = 'sildenafil'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 8900, FALSE
  FROM treatments WHERE slug = 'tadalafil'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 8000, TRUE
  FROM treatments WHERE slug = 'tadalafil'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 11900, FALSE
  FROM treatments WHERE slug = 'ed-troche'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 10700, TRUE
  FROM treatments WHERE slug = 'ed-troche'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 14900, FALSE
  FROM treatments WHERE slug = 'pt-141'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 13400, TRUE
  FROM treatments WHERE slug = 'pt-141'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 6900, FALSE
  FROM treatments WHERE slug = 'premature-ejaculation'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 6200, TRUE
  FROM treatments WHERE slug = 'premature-ejaculation'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 12900, FALSE
  FROM treatments WHERE slug = 'enclomiphene'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 11600, TRUE
  FROM treatments WHERE slug = 'enclomiphene'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '6-Month Plan', 6, 10600, FALSE
  FROM treatments WHERE slug = 'enclomiphene'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 9900, FALSE
  FROM treatments WHERE slug = 'testosterone-cypionate'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 8900, TRUE
  FROM treatments WHERE slug = 'testosterone-cypionate'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '6-Month Plan', 6, 8100, FALSE
  FROM treatments WHERE slug = 'testosterone-cypionate'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 11900, FALSE
  FROM treatments WHERE slug = 'testosterone-cream'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 10700, TRUE
  FROM treatments WHERE slug = 'testosterone-cream'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 19900, FALSE
  FROM treatments WHERE slug = 'oral-testosterone'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 17900, TRUE
  FROM treatments WHERE slug = 'oral-testosterone'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 13900, FALSE
  FROM treatments WHERE slug = 'hcg'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 12500, TRUE
  FROM treatments WHERE slug = 'hcg'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 13900, FALSE
  FROM treatments WHERE slug = 'estradiol-therapy'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 12500, TRUE
  FROM treatments WHERE slug = 'estradiol-therapy'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '6-Month Plan', 6, 11400, FALSE
  FROM treatments WHERE slug = 'estradiol-therapy'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 9900, FALSE
  FROM treatments WHERE slug = 'progesterone'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 8900, TRUE
  FROM treatments WHERE slug = 'progesterone'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 10900, FALSE
  FROM treatments WHERE slug = 'vaginal-estrogen'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 9800, TRUE
  FROM treatments WHERE slug = 'vaginal-estrogen'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 11900, FALSE
  FROM treatments WHERE slug = 'womens-testosterone'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 10700, TRUE
  FROM treatments WHERE slug = 'womens-testosterone'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 2400, FALSE
  FROM treatments WHERE slug = 'birth-control-pill'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 2200, TRUE
  FROM treatments WHERE slug = 'birth-control-pill'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '12-Month Plan', 12, 1800, FALSE
  FROM treatments WHERE slug = 'birth-control-pill'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 3200, FALSE
  FROM treatments WHERE slug = 'birth-control-patch'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 2900, TRUE
  FROM treatments WHERE slug = 'birth-control-patch'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 3900, FALSE
  FROM treatments WHERE slug = 'birth-control-ring'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 3500, TRUE
  FROM treatments WHERE slug = 'birth-control-ring'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 3500, TRUE
  FROM treatments WHERE slug = 'emergency-contraception'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 2500, FALSE
  FROM treatments WHERE slug = 'finasteride'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 2300, TRUE
  FROM treatments WHERE slug = 'finasteride'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '12-Month Plan', 12, 1900, FALSE
  FROM treatments WHERE slug = 'finasteride'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 4400, FALSE
  FROM treatments WHERE slug = 'topical-hair-formula'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 4000, TRUE
  FROM treatments WHERE slug = 'topical-hair-formula'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 1900, FALSE
  FROM treatments WHERE slug = 'minoxidil'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 1700, TRUE
  FROM treatments WHERE slug = 'minoxidil'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 2900, FALSE
  FROM treatments WHERE slug = 'oral-minoxidil'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 2600, TRUE
  FROM treatments WHERE slug = 'oral-minoxidil'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 1600, FALSE
  FROM treatments WHERE slug = 'biotin-gummies'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 1400, TRUE
  FROM treatments WHERE slug = 'biotin-gummies'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 3300, FALSE
  FROM treatments WHERE slug = 'tretinoin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 3000, TRUE
  FROM treatments WHERE slug = 'tretinoin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 4900, FALSE
  FROM treatments WHERE slug = 'anti-aging-cream'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 4400, TRUE
  FROM treatments WHERE slug = 'anti-aging-cream'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 3000, FALSE
  FROM treatments WHERE slug = 'acne-treatment'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 2700, TRUE
  FROM treatments WHERE slug = 'acne-treatment'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 8900, FALSE
  FROM treatments WHERE slug = 'ghk-cu'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 8000, TRUE
  FROM treatments WHERE slug = 'ghk-cu'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 16900, FALSE
  FROM treatments WHERE slug = 'glow-blend'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 15200, TRUE
  FROM treatments WHERE slug = 'glow-blend'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 18900, FALSE
  FROM treatments WHERE slug = 'klow-blend'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 17000, TRUE
  FROM treatments WHERE slug = 'klow-blend'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 7900, FALSE
  FROM treatments WHERE slug = 'snap-8'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 7100, TRUE
  FROM treatments WHERE slug = 'snap-8'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 7900, FALSE
  FROM treatments WHERE slug = 'argireline'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 7100, TRUE
  FROM treatments WHERE slug = 'argireline'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 7900, FALSE
  FROM treatments WHERE slug = 'matrixyl'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 7100, TRUE
  FROM treatments WHERE slug = 'matrixyl'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 12900, FALSE
  FROM treatments WHERE slug = 'melanotan-2'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 11600, TRUE
  FROM treatments WHERE slug = 'melanotan-2'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 4900, FALSE
  FROM treatments WHERE slug = 'anxiety-depression'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 4400, TRUE
  FROM treatments WHERE slug = 'anxiety-depression'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 9900, FALSE
  FROM treatments WHERE slug = 'selank'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 8900, TRUE
  FROM treatments WHERE slug = 'selank'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 9900, FALSE
  FROM treatments WHERE slug = 'semax'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 8900, TRUE
  FROM treatments WHERE slug = 'semax'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 3900, FALSE
  FROM treatments WHERE slug = 'sleep-support'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 3500, TRUE
  FROM treatments WHERE slug = 'sleep-support'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 1400, FALSE
  FROM treatments WHERE slug = 'melatonin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 1300, TRUE
  FROM treatments WHERE slug = 'melatonin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 13900, FALSE
  FROM treatments WHERE slug = 'bpc-157'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 12500, TRUE
  FROM treatments WHERE slug = 'bpc-157'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 14900, FALSE
  FROM treatments WHERE slug = 'tb-500'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 13400, TRUE
  FROM treatments WHERE slug = 'tb-500'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 19900, FALSE
  FROM treatments WHERE slug = 'bpc-tb-blend'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 17900, TRUE
  FROM treatments WHERE slug = 'bpc-tb-blend'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 17900, FALSE
  FROM treatments WHERE slug = 'cjc-ipamorelin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 16100, TRUE
  FROM treatments WHERE slug = 'cjc-ipamorelin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 13900, FALSE
  FROM treatments WHERE slug = 'ipamorelin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 12500, TRUE
  FROM treatments WHERE slug = 'ipamorelin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 13900, FALSE
  FROM treatments WHERE slug = 'sermorelin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 12500, TRUE
  FROM treatments WHERE slug = 'sermorelin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 21900, FALSE
  FROM treatments WHERE slug = 'tesamorelin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 19700, TRUE
  FROM treatments WHERE slug = 'tesamorelin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 15900, FALSE
  FROM treatments WHERE slug = 'hgh-fragment-176-191'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 14300, TRUE
  FROM treatments WHERE slug = 'hgh-fragment-176-191'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 16900, FALSE
  FROM treatments WHERE slug = 'peg-mgf'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 15200, TRUE
  FROM treatments WHERE slug = 'peg-mgf'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 16900, FALSE
  FROM treatments WHERE slug = 'mots-c'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 15200, TRUE
  FROM treatments WHERE slug = 'mots-c'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 17900, FALSE
  FROM treatments WHERE slug = 'thymosin-alpha-1'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 16100, TRUE
  FROM treatments WHERE slug = 'thymosin-alpha-1'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 12900, FALSE
  FROM treatments WHERE slug = 'kpv'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 11600, TRUE
  FROM treatments WHERE slug = 'kpv'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 13900, FALSE
  FROM treatments WHERE slug = 'five-amino-1mq'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 12500, TRUE
  FROM treatments WHERE slug = 'five-amino-1mq'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 18900, FALSE
  FROM treatments WHERE slug = 'dihexa'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 17000, TRUE
  FROM treatments WHERE slug = 'dihexa'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 17900, FALSE
  FROM treatments WHERE slug = 'humanin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 16100, TRUE
  FROM treatments WHERE slug = 'humanin'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 19900, FALSE
  FROM treatments WHERE slug = 'nad-plus'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 17900, TRUE
  FROM treatments WHERE slug = 'nad-plus'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 9900, FALSE
  FROM treatments WHERE slug = 'glutathione'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 8900, TRUE
  FROM treatments WHERE slug = 'glutathione'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 4900, FALSE
  FROM treatments WHERE slug = 'vitamin-b12'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, '3-Month Plan', 3, 4400, TRUE
  FROM treatments WHERE slug = 'vitamin-b12'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 9900, TRUE
  FROM treatments WHERE slug = 'comprehensive-lab-panel'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;
INSERT INTO treatment_plans (treatment_id, name, cadence_months, price_cents, is_default)
  SELECT id, 'Monthly', 1, 7900, TRUE
  FROM treatments WHERE slug = 'hormone-lab-panel'
  ON CONFLICT (treatment_id, cadence_months) DO NOTHING;

COMMIT;
